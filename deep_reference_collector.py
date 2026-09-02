from __future__ import annotations

import argparse
import csv
import hashlib
import heapq
import html as html_lib
import io
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
import urllib3
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
MANIFEST_JSON = ROOT / "manifest.json"
MANIFEST_CSV = ROOT / "manifest.csv"
PRIORITY_JSON = ROOT / "priority_companies.json"

MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
DEFAULT_WORKERS = min(6, max(3, (os.cpu_count() or 4) // 2))

DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
)
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36"
)

LOGO_RE = re.compile(r"(?:^|[\W_])(logo|wordmark|brand|bi|ci|로고)(?:[\W_]|$)", re.I)
BANNER_RE = re.compile(
    r"(?:^|[\W_])(hero|banner|visual|keyvisual|key-visual|kv|masthead|cover|campaign|promo|promotion|main[-_ ]?slide|main[-_ ]?visual|메인|배너|프로모션|이벤트)(?:[\W_]|$)",
    re.I,
)
NOISE_RE = re.compile(
    r"(?:^|[\W_])(icon|ico|badge|button|arrow|chevron|sprite|pixel|tracking|qr|appstore|googleplay|award|flag|avatar|loading|spinner|captcha)(?:[\W_]|$)",
    re.I,
)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

RELEVANT_RE = re.compile(
    r"((?:^|[^a-z])(rent|rental|lease|leasing|auto|car|vehicle|long[-_]?term|product|service|event|promotion|campaign|benefit|brand|business|company|main)(?:[^a-z]|$)|렌트|렌터|리스|자동차|차량|신차|장기|상품|서비스|이벤트|프로모션|혜택|브랜드|회사)",
    re.I,
)
HIGH_VALUE_RE = re.compile(
    r"((?:^|[^a-z])(rent|rental|lease|leasing|auto|car|vehicle|event|promotion|campaign)(?:[^a-z]|$)|렌트|렌터|리스|자동차|신차|장기|이벤트|프로모션)",
    re.I,
)
EXCLUDE_PAGE_RE = re.compile(
    r"(login|logout|signin|signup|auth|member|mypage|my-page|privacy|terms|policy|agreement|reservation|reserve|booking|search|download|fileDown|recruit|career|employment|javascript:|mailto:|tel:|채용|로그인|회원|예약|개인정보|약관)",
    re.I,
)
NON_HTML_RE = re.compile(r"\.(?:pdf|zip|hwp|docx?|xlsx?|pptx?|mp4|mov|avi|mp3|wav)(?:$|[?#])", re.I)
IMAGE_LITERAL_RE = re.compile(
    r"(?P<quote>['\"])(?P<url>(?:https?:)?//[^'\"<>\s]+?\.(?:avif|webp|png|jpe?g|gif|svg)(?:\?[^'\"<>\s]*)?|/[^'\"<>\s]+?\.(?:avif|webp|png|jpe?g|gif|svg)(?:\?[^'\"<>\s]*)?)(?P=quote)",
    re.I,
)
SCRIPT_IMAGE_RE = re.compile(
    r"(?P<quote>['\"])(?P<url>(?:(?:https?:)?//|(?:\.\.?/)?)[A-Za-z0-9_@%+~./:=?-]+\.(?:avif|webp|png|jpe?g|gif|svg)(?:\?[^'\"<>\s]*)?)(?P=quote)",
    re.I,
)
CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I)
IMAGE_ATTRS = (
    "src", "data-src", "data-original", "data-lazy-src", "data-image", "data-bg",
    "data-background", "data-background-image", "data-pc", "data-mo", "data-mobile",
    "data-desktop", "data-pc-src", "data-mo-src", "data-mobile-src", "data-web-src",
)


@dataclass
class Candidate:
    url: str
    scores: dict[str, int] = field(default_factory=lambda: {"logo": 0, "banner": 0, "social": 0, "reference": 0})
    variants: set[str] = field(default_factory=set)
    pages: set[str] = field(default_factory=set)
    tags: set[str] = field(default_factory=set)
    context: str = ""

    def add(self, kind: str, score: int, variant: str, page_url: str, tag: str, context: str) -> None:
        self.scores[kind] = max(self.scores.get(kind, 0), score)
        self.variants.add(variant)
        self.pages.add(page_url)
        self.tags.add(tag)
        if len(context) > len(self.context):
            self.context = context[:400]


def clean_slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or hashlib.sha1(value.encode()).hexdigest()[:12]


def normalize_url(value: str | None, base: str) -> str | None:
    if not value:
        return None
    value = html_lib.unescape(str(value).strip().strip("'\"")).replace("\\/", "/")
    if not value or value.startswith(("data:", "blob:", "javascript:", "mailto:", "tel:")):
        return None
    if value.startswith("//"):
        value = "https:" + value
    url = urljoin(base, value)
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None
    query = urlencode([(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if not k.lower().startswith("utm_")])
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.params, query, ""))


def site_domain(hostname: str) -> str:
    host = hostname.lower().split(":", 1)[0].lstrip("www.")
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    if ".".join(parts[-2:]) in {"co.kr", "or.kr", "go.kr", "ne.kr", "co.jp", "com.au"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def same_site(a: str, b: str) -> bool:
    return site_domain(urlparse(a).hostname or "") == site_domain(urlparse(b).hostname or "")


def variant_from_text(text: str, fallback: str) -> str:
    lowered = text.lower()
    if re.search(r"(mobile|\bmo\b|(^|[-_/])m([-_/]|$)|max-width|모바일)", lowered):
        return "mobile"
    if re.search(r"(desktop|\bpc\b|min-width|데스크톱)", lowered):
        return "desktop"
    return fallback


def srcset_urls(value: str | None, base: str) -> list[str]:
    if not value:
        return []
    found: list[str] = []
    for item in str(value).split(","):
        raw = item.strip().split()[0] if item.strip() else ""
        url = normalize_url(raw, base)
        if url and url not in found:
            found.append(url)
    return found


def add_candidate(
    pool: dict[str, Candidate], raw_url: str | None, base: str, kind: str, score: int,
    variant: str, page_url: str, tag: str, context: str = "",
) -> None:
    url = normalize_url(raw_url, base)
    if not url:
        return
    candidate = pool.setdefault(url, Candidate(url=url))
    candidate.add(kind, score, variant, page_url, tag, context)


def collect_html_candidates(soup: BeautifulSoup, page_url: str, variant: str, pool: dict[str, Candidate]) -> set[str]:
    stylesheets: set[str] = set()

    for meta in soup.find_all("meta"):
        key = " ".join([str(meta.get("property", "")), str(meta.get("name", ""))]).lower()
        if "image" in key and meta.get("content"):
            add_candidate(pool, meta.get("content"), page_url, "social", 230, variant, page_url, f"meta:{key}", key)

    for link in soup.find_all("link", href=True):
        rel = " ".join(link.get("rel", [])).lower()
        href = normalize_url(link.get("href"), page_url)
        if not href:
            continue
        if "stylesheet" in rel:
            stylesheets.add(href)
        if "image_src" in rel or str(link.get("as", "")).lower() == "image":
            context = f"{rel} {link.get('media', '')} {href}"
            inferred = variant_from_text(context, variant)
            add_candidate(pool, href, page_url, "reference", 85, inferred, page_url, f"link:{rel}", context)
            if BANNER_RE.search(context):
                add_candidate(pool, href, page_url, "banner", 180, inferred, page_url, f"link:{rel}", context)

    image_nodes = list(soup.find_all(["img", "source", "picture", "video"]))
    for index, node in enumerate(image_nodes):
        ancestry = " ".join(
            " ".join(filter(None, [ancestor.name, str(ancestor.get("id", "")), " ".join(ancestor.get("class", [])), str(ancestor.get("aria-label", ""))]))
            for ancestor in list(node.parents)[:5] if getattr(ancestor, "name", None)
        )
        context = " ".join(filter(None, [
            node.name, str(node.get("id", "")), " ".join(node.get("class", [])),
            str(node.get("alt", "")), str(node.get("title", "")), str(node.get("aria-label", "")), ancestry,
        ]))
        found: list[tuple[str, str]] = []
        for attr in IMAGE_ATTRS:
            url = normalize_url(node.get(attr), page_url)
            if url:
                found.append((url, variant_from_text(f"{attr} {url} {node.get('media', '')}", variant)))
        for attr in ("srcset", "data-srcset"):
            for url in srcset_urls(node.get(attr), page_url):
                found.append((url, variant_from_text(f"{attr} {node.get('media', '')} {url}", variant)))
        for attr, raw in node.attrs.items():
            attr_name = str(attr).lower()
            if not any(token in attr_name for token in ("src", "image", "background", "banner", "visual", "mobile", "desktop", "-pc", "-mo")):
                continue
            values = raw if isinstance(raw, list) else [raw]
            for value in values:
                url = normalize_url(str(value), page_url)
                if url and re.search(r"\.(?:avif|webp|png|jpe?g|gif|svg)(?:$|[?#])", url, re.I):
                    found.append((url, variant_from_text(f"{attr_name} {url}", variant)))

        position_bonus = max(0, 80 - index * 2)
        is_noise = bool(NOISE_RE.search(context))
        in_header = bool(re.search(r"\b(header|nav|gnb|lnb)\b", ancestry, re.I))
        in_main = bool(re.search(r"\b(main|article|section|contents?)\b", ancestry, re.I))
        for url, item_variant in dict.fromkeys(found):
            combined = f"{context} {url}"
            logo_score = 35 + (220 if LOGO_RE.search(combined) else 0) + (55 if in_header else 0)
            banner_score = 40 + position_bonus + (220 if BANNER_RE.search(combined) else 0) + (35 if in_main else 0)
            reference_score = 65 + position_bonus + (25 if in_main else 0)
            if is_noise or NOISE_RE.search(url):
                logo_score -= 120
                banner_score -= 150
                reference_score -= 130
            if logo_score >= 100:
                add_candidate(pool, url, page_url, "logo", logo_score, item_variant, page_url, f"{node.name}:logo", context)
            if banner_score >= 115:
                add_candidate(pool, url, page_url, "banner", banner_score, item_variant, page_url, f"{node.name}:banner", context)
            if reference_score >= 50:
                add_candidate(pool, url, page_url, "reference", reference_score, item_variant, page_url, f"{node.name}:image", context)

    for node in soup.find_all(style=True):
        style = str(node.get("style", ""))
        context = f"{node.name} {node.get('id', '')} {' '.join(node.get('class', []))} {style[:500]}"
        for _, raw_url in CSS_URL_RE.findall(style):
            inferred = variant_from_text(context, variant)
            add_candidate(pool, raw_url, page_url, "reference", 110, inferred, page_url, "inline-css", context)
            if BANNER_RE.search(context):
                add_candidate(pool, raw_url, page_url, "banner", 205, inferred, page_url, "inline-css", context)

    for style in soup.find_all("style"):
        collect_css_candidates(style.get_text(" "), page_url, page_url, variant, pool)

    raw_html = str(soup)
    for match in IMAGE_LITERAL_RE.finditer(raw_html):
        raw_url = match.group("url")
        context = raw_html[max(0, match.start() - 180): match.end() + 120]
        inferred = variant_from_text(context, variant)
        score = 175 if BANNER_RE.search(context) else 72
        add_candidate(pool, raw_url, page_url, "reference", 80, inferred, page_url, "html-data", context)
        if BANNER_RE.search(context):
            add_candidate(pool, raw_url, page_url, "banner", score, inferred, page_url, "html-data", context)
        if LOGO_RE.search(context):
            add_candidate(pool, raw_url, page_url, "logo", 190, inferred, page_url, "html-data", context)
    return stylesheets


def collect_css_candidates(css: str, css_url: str, page_url: str, variant: str, pool: dict[str, Candidate]) -> None:
    for match in CSS_URL_RE.finditer(css):
        raw_url = match.group(2)
        context = css[max(0, match.start() - 260): match.end() + 160]
        inferred = variant_from_text(context, variant)
        if NOISE_RE.search(context) and not BANNER_RE.search(context):
            continue
        add_candidate(pool, raw_url, css_url, "reference", 92, inferred, page_url, "external-css", context)
        if BANNER_RE.search(context):
            add_candidate(pool, raw_url, css_url, "banner", 210, inferred, page_url, "external-css", context)
        if LOGO_RE.search(context):
            add_candidate(pool, raw_url, css_url, "logo", 205, inferred, page_url, "external-css", context)


def score_page(url: str, label: str, depth: int, start_url: str) -> int:
    if not same_site(url, start_url) or NON_HTML_RE.search(url):
        return -1
    is_start = url.rstrip("/") == start_url.rstrip("/")
    # A curated entry URL can legitimately contain words such as `search`
    # (for example a vehicle quotation page). Always allow that first page.
    if not is_start and EXCLUDE_PAGE_RE.search(url):
        return -1
    text = f"{url} {label}"
    score = 400 - depth * 45
    if HIGH_VALUE_RE.search(text):
        score += 300
    elif RELEVANT_RE.search(text):
        score += 150
    if is_start:
        score += 1000
    if len(urlparse(url).query) > 180:
        score -= 120
    return score


def make_session(user_agent: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": user_agent,
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.5",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    })
    return session


def request(
    session: requests.Session, url: str, *, timeout: tuple[int, int] = (8, 28),
    headers: dict[str, str] | None = None, stream: bool = False,
) -> requests.Response:
    try:
        response = session.get(url, timeout=timeout, allow_redirects=True, headers=headers, stream=stream)
    except requests.exceptions.SSLError:
        response = session.get(url, timeout=timeout, allow_redirects=True, headers=headers, verify=False, stream=stream)
    response.raise_for_status()
    return response


def discover_sitemaps(session: requests.Session, start_url: str, max_urls: int = 240) -> list[str]:
    parsed = urlparse(start_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    sitemap_queue = [f"{origin}/sitemap.xml"]
    try:
        robots = request(session, f"{origin}/robots.txt", timeout=(5, 12)).text
        sitemap_queue.extend(re.findall(r"(?im)^\s*Sitemap:\s*(\S+)", robots))
    except Exception:
        pass
    page_urls: list[str] = []
    seen_maps: set[str] = set()
    while sitemap_queue and len(seen_maps) < 6 and len(page_urls) < max_urls:
        sitemap = normalize_url(sitemap_queue.pop(0), origin)
        if not sitemap or sitemap in seen_maps:
            continue
        seen_maps.add(sitemap)
        try:
            response = request(session, sitemap, timeout=(6, 18))
            xml = response.text
        except Exception:
            continue
        for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml, re.I):
            url = normalize_url(loc, sitemap)
            if not url:
                continue
            if url.lower().endswith((".xml", ".xml.gz")):
                sitemap_queue.append(url)
            elif same_site(url, start_url) and score_page(url, "sitemap", 2, start_url) >= 500:
                page_urls.append(url)
                if len(page_urls) >= max_urls:
                    break
    return list(dict.fromkeys(page_urls))


def crawl_company(row: dict[str, Any], max_pages: int, max_assets: int, max_attempts: int) -> dict[str, Any]:
    updated = dict(row)
    start_url = str(row.get("requested_url") or row.get("page_url") or "")
    destination = ASSETS / str(row["category"]) / str(row["slug"])
    destination.mkdir(parents=True, exist_ok=True)
    desktop = make_session(DESKTOP_UA)
    mobile = make_session(MOBILE_UA)
    pool: dict[str, Candidate] = {}
    errors: list[str] = []
    crawled_logical: set[str] = set()
    fetched_variants = {"desktop": 0, "mobile": 0}
    stylesheet_urls: dict[str, tuple[str, str]] = {}
    script_urls: dict[str, tuple[str, str]] = {}
    queue: list[tuple[int, int, int, str]] = []
    queued: set[str] = set()
    counter = 0

    for seed in row.get("seed_assets", []):
        if not isinstance(seed, dict) or not seed.get("url"):
            continue
        kind = str(seed.get("type") or "reference")
        if kind not in {"logo", "banner", "social", "reference"}:
            kind = "reference"
        add_candidate(
            pool, str(seed["url"]), start_url, kind, 320,
            str(seed.get("variant") or "shared"), start_url, "curated-rendered-page",
            f"curated rendered-page {kind}",
        )

    def enqueue(url: str, label: str, depth: int) -> None:
        nonlocal counter
        normalized = normalize_url(url, start_url)
        if not normalized or normalized in queued or normalized in crawled_logical:
            return
        score = score_page(normalized, label, depth, start_url)
        if score < 0:
            return
        queued.add(normalized)
        counter += 1
        heapq.heappush(queue, (-score, depth, counter, normalized))

    enqueue(start_url, row.get("company", ""), 0)
    for sitemap_url in discover_sitemaps(desktop, start_url):
        enqueue(sitemap_url, "sitemap", 2)

    while queue and len(crawled_logical) < max_pages:
        _, depth, _, logical_url = heapq.heappop(queue)
        if logical_url in crawled_logical:
            continue
        crawled_logical.add(logical_url)
        for variant, session in (("desktop", desktop), ("mobile", mobile)):
            try:
                response = request(session, logical_url)
                content_type = response.headers.get("Content-Type", "").lower()
                if "html" not in content_type and "xhtml" not in content_type and not response.text.lstrip().startswith("<"):
                    continue
                page_url = str(response.url)
                fetched_variants[variant] += 1
                soup = BeautifulSoup(response.content, "html.parser")
                for css_url in collect_html_candidates(soup, page_url, variant, pool):
                    stylesheet_urls.setdefault(css_url, (page_url, variant))
                for script in soup.find_all("script", src=True):
                    script_url = normalize_url(script.get("src"), page_url)
                    if script_url and same_site(script_url, start_url):
                        script_urls.setdefault(script_url, (page_url, variant))
                for link in soup.find_all("a", href=True):
                    href = normalize_url(link.get("href"), page_url)
                    if href:
                        enqueue(href, link.get_text(" ", strip=True)[:160], depth + 1)
            except Exception as exc:
                errors.append(f"{variant}:{logical_url}:{type(exc).__name__}")

    css_count = 0
    for css_url, (page_url, variant) in list(stylesheet_urls.items())[:28]:
        try:
            response = request(desktop if variant == "desktop" else mobile, css_url, timeout=(6, 20), headers={"Referer": page_url})
            collect_css_candidates(response.text, str(response.url), page_url, variant, pool)
            css_count += 1
        except Exception as exc:
            errors.append(f"css:{css_url}:{type(exc).__name__}")

    script_count = 0
    for script_url, (page_url, variant) in list(script_urls.items())[:36]:
        try:
            with request(desktop if variant == "desktop" else mobile, script_url, timeout=(6, 16), headers={"Referer": page_url}, stream=True) as response:
                script = response.raw.read(6 * 1024 * 1024 + 1, decode_content=True)
                final_script_url = str(response.url)
            if len(script) > 6 * 1024 * 1024:
                continue
            text = script.decode("utf-8", "ignore")
            for match in SCRIPT_IMAGE_RE.finditer(text):
                raw_url = match.group("url")
                context = text[max(0, match.start() - 180): match.end() + 120]
                inferred = variant_from_text(context, variant)
                add_candidate(pool, raw_url, final_script_url, "reference", 80, inferred, page_url, "script-data", context)
                if BANNER_RE.search(context):
                    add_candidate(pool, raw_url, final_script_url, "banner", 190, inferred, page_url, "script-data", context)
                if LOGO_RE.search(context):
                    add_candidate(pool, raw_url, final_script_url, "logo", 185, inferred, page_url, "script-data", context)
            script_count += 1
        except Exception as exc:
            errors.append(f"script:{script_url}:{type(exc).__name__}")

    existing = [asset for asset in row.get("assets", []) if asset.get("type") in {"favicon"} and (ROOT / str(asset.get("path", ""))).exists()]
    assets: list[dict[str, Any]] = [dict(asset) for asset in existing]
    seen_source_urls: set[str] = set()
    seen_source_hashes: set[str] = set()
    perceptual: list[tuple[str, float, str]] = []
    kind_counts = {"logo": 0, "banner": 0, "social": 0, "reference": 0}

    ranked = sorted(pool.values(), key=lambda item: max(item.scores.values()) + len(item.pages) * 3, reverse=True)
    downloaded = 0
    attempted = 0
    for candidate in ranked:
        if max_assets and downloaded >= max_assets:
            break
        if max_attempts and attempted >= max_attempts:
            break
        if candidate.url in seen_source_urls:
            continue
        attempted += 1
        referer = next(iter(candidate.pages), start_url)
        try:
            with request(desktop, candidate.url, timeout=(5, 12), stream=True, headers={
                "Referer": referer,
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            }) as response:
                payload = response.raw.read(MAX_DOWNLOAD_BYTES + 1, decode_content=True)
                final_url = str(response.url)
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
            if not payload or len(payload) > MAX_DOWNLOAD_BYTES:
                raise ValueError("empty or oversized")
            width, height, fmt = image_dimensions(payload, content_type, final_url)
            variant = "shared" if len(candidate.variants) > 1 else next(iter(candidate.variants), "shared")
            kind = classify_candidate(candidate, width, height, fmt, variant)
            if not kind:
                continue
            source_hash = hashlib.sha256(payload).hexdigest()
            ratio = width / height if height else 0
            dhash = perceptual_hash(payload, fmt)
            if source_hash in seen_source_hashes or is_near_duplicate(dhash, ratio, perceptual):
                seen_source_urls.add(candidate.url)
                continue
            kind_counts[kind] += 1
            output, out_width, out_height, out_mime, out_dhash = save_asset(
                payload, fmt, destination, kind, kind_counts[kind], width, height,
            )
            saved = output.read_bytes()
            asset = {
                "type": kind,
                "path": output.relative_to(ROOT).as_posix(),
                "source_url": final_url,
                "source_tag": ", ".join(sorted(candidate.tags))[:240],
                "context": candidate.context,
                "content_type": out_mime,
                "bytes": len(saved),
                "sha256": hashlib.sha256(saved).hexdigest(),
                "source_sha256": source_hash,
                "dhash": out_dhash or dhash,
                "width": out_width,
                "height": out_height,
                "variant": variant,
                "source_pages": sorted(candidate.pages),
            }
            assets.append(asset)
            seen_source_urls.add(candidate.url)
            seen_source_urls.add(final_url)
            seen_source_hashes.add(source_hash)
            if dhash:
                perceptual.append((dhash, ratio, asset["path"]))
            downloaded += 1
        except Exception as exc:
            errors.append(f"asset:{candidate.url}:{type(exc).__name__}")

    referenced = {str(asset.get("path", "")) for asset in assets}
    for kind in ("logo", "banner", "social", "reference"):
        for path in destination.glob(f"{kind}-*.*"):
            if path.relative_to(ROOT).as_posix() not in referenced:
                path.unlink(missing_ok=True)

    updated["page_url"] = start_url
    updated["asset_page_url"] = start_url
    updated["assets"] = assets
    for kind in ("logo", "banner", "reference"):
        updated[f"{kind}_count"] = sum(asset.get("type") == kind for asset in assets)
    updated["social_count"] = sum(asset.get("type") == "social" for asset in assets)
    updated["asset_count"] = len(assets)
    updated["collection_status"] = "complete" if updated["logo_count"] and updated["banner_count"] else "partial"
    updated["collection_error"] = "; ".join(errors[-12:])
    updated["crawl_stats"] = {
        "logical_pages": len(crawled_logical),
        "desktop_pages": fetched_variants["desktop"],
        "mobile_pages": fetched_variants["mobile"],
        "stylesheets": css_count,
        "scripts": script_count,
        "candidates": len(pool),
        "attempted_assets": attempted,
        "errors": len(errors),
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }
    write_company_source(updated, destination)
    return updated


def image_dimensions(payload: bytes, content_type: str, url: str) -> tuple[int, int, str]:
    head = payload[:2048].lstrip()
    is_svg = "svg" in content_type.lower() or urlparse(url).path.lower().endswith(".svg") or b"<svg" in head.lower()
    if is_svg:
        text = payload[:300_000].decode("utf-8", "ignore")
        viewbox = re.search(r"viewBox\s*=\s*['\"]\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)", text, re.I)
        width_match = re.search(r"<svg[^>]*\bwidth\s*=\s*['\"]([\d.]+)", text, re.I)
        height_match = re.search(r"<svg[^>]*\bheight\s*=\s*['\"]([\d.]+)", text, re.I)
        if viewbox:
            return max(1, int(float(viewbox.group(1)))), max(1, int(float(viewbox.group(2)))), "svg"
        if width_match and height_match:
            return max(1, int(float(width_match.group(1)))), max(1, int(float(height_match.group(1)))), "svg"
        return 512, 512, "svg"
    try:
        with Image.open(io.BytesIO(payload)) as image:
            image.load()
            return int(image.width), int(image.height), (image.format or "").lower()
    except (UnidentifiedImageError, OSError, ValueError):
        return 0, 0, ""


def classify_candidate(candidate: Candidate, width: int, height: int, fmt: str, variant: str) -> str | None:
    if width <= 0 or height <= 0:
        return None
    ratio = width / height
    area = width * height
    scores = candidate.scores
    url_logo = bool(LOGO_RE.search(candidate.url) or re.search(r"(?:^|[_/.-])(ci|bi|symbol|simbol)(?:[_/.-]|$)", candidate.url, re.I))
    tagged_logo = any(tag.endswith(":logo") for tag in candidate.tags)
    if scores["logo"] >= 190 and (url_logo or tagged_logo) and (fmt == "svg" or (width >= 90 and height >= 28 and 0.18 <= ratio <= 15 and area >= 3_800)):
        return "logo"
    mobile_banner = variant == "mobile" and width >= 480 and height >= 300 and 0.48 <= ratio <= 2.6 and area >= 180_000
    wide_banner = width >= 680 and height >= 220 and ratio >= 1.22 and area >= 230_000
    if scores["banner"] >= 140 and (mobile_banner or wide_banner):
        return "banner"
    if scores["social"] >= 200 and width >= 320 and height >= 180 and area >= 100_000:
        return "social"
    if scores["reference"] >= 50 and width >= 320 and height >= 180 and 0.34 <= ratio <= 4.8 and area >= 120_000:
        return "reference"
    return None


def perceptual_hash(payload: bytes, fmt: str) -> str:
    if fmt == "svg":
        return ""
    try:
        with Image.open(io.BytesIO(payload)) as image:
            gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            pixels = list(gray.get_flattened_data())
        bits = 0
        for y in range(8):
            for x in range(8):
                bits = (bits << 1) | int(pixels[y * 9 + x] > pixels[y * 9 + x + 1])
        return f"{bits:016x}"
    except Exception:
        return ""


def hamming_hash(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def is_near_duplicate(dhash: str, ratio: float, existing: list[tuple[str, float, str]]) -> bool:
    if not dhash:
        return False
    return any(abs(ratio - other_ratio) <= 0.025 and hamming_hash(dhash, other_hash) <= 1 for other_hash, other_ratio, _ in existing)


def save_asset(payload: bytes, fmt: str, destination: Path, kind: str, index: int, width: int, height: int) -> tuple[Path, int, int, str, str]:
    if fmt == "svg":
        output = destination / f"{kind}-{index:03d}.svg"
        output.write_bytes(payload)
        return output, width, height, "image/svg+xml", ""
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        image = source.copy()
    image.thumbnail((2200, 2000), Image.Resampling.LANCZOS)
    if kind == "logo" and "A" in image.getbands():
        image = image.convert("RGBA")
        output = destination / f"{kind}-{index:03d}.png"
        image.save(output, "PNG", optimize=True)
        mime = "image/png"
    else:
        image = image.convert("RGB")
        output = destination / f"{kind}-{index:03d}.webp"
        image.save(output, "WEBP", quality=88 if kind == "logo" else 85, method=6)
        mime = "image/webp"
    saved = output.read_bytes()
    return output, int(image.width), int(image.height), mime, perceptual_hash(saved, "webp" if mime == "image/webp" else "png")


def write_company_source(row: dict[str, Any], destination: Path) -> None:
    payload = {key: row.get(key) for key in (
        "company", "category", "requested_url", "page_url", "page_title", "collection_status",
        "collection_error", "crawl_stats", "assets",
    )}
    (destination / "source.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def seed_priority(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not PRIORITY_JSON.exists():
        return rows
    priority = json.loads(PRIORITY_JSON.read_text(encoding="utf-8"))
    by_company = {str(row.get("company")): row for row in rows}
    used_slugs = {str(row.get("slug")) for row in rows}
    for item in priority:
        company = str(item["company"])
        if company in by_company:
            row = by_company[company]
            row["priority_group"] = "장기렌트·리스"
            # The curated priority list is the source of truth for official URLs.
            # This also corrects stale redirects or a previously misidentified domain.
            row["requested_url"] = item["url"]
            row["page_url"] = item["url"]
            if item.get("seed_assets"):
                row["seed_assets"] = item["seed_assets"]
            continue
        ascii_slug = clean_slug(re.sub(r"[^A-Za-z0-9]+", "-", company))
        base_slug = ascii_slug if ascii_slug != "da39a3ee5e6b" else f"lease-{hashlib.sha1(company.encode('utf-8')).hexdigest()[:10]}"
        slug = base_slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        used_slugs.add(slug)
        row = {
            "category": item["category"], "company": company, "slug": slug,
            "requested_url": item["url"], "page_url": item["url"], "page_title": company,
            "page_status": "", "page_error": "", "assets": [], "priority_group": "장기렌트·리스",
            "seed_assets": item.get("seed_assets", []),
        }
        rows.append(row)
        by_company[company] = row
    return rows


def recover_sources(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    recovered = 0
    for row in rows:
        source_path = ASSETS / str(row.get("category", "")) / str(row.get("slug", "")) / "source.json"
        if not source_path.exists():
            continue
        try:
            payload = json.loads(source_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not payload.get("crawl_stats") or not isinstance(payload.get("assets"), list):
            continue
        row.update(payload)
        assets = row.get("assets", [])
        for kind in ("logo", "banner", "social", "reference"):
            row[f"{kind}_count"] = sum(asset.get("type") == kind for asset in assets)
        row["asset_count"] = len(assets)
        recovered += 1
    return rows, recovered


def write_outputs(rows: list[dict[str, Any]]) -> None:
    MANIFEST_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = [
        "category", "company", "slug", "requested_url", "page_url", "page_title", "page_status", "page_error",
        "collection_status", "collection_error", "asset_count", "logo_count", "banner_count", "social_count", "reference_count",
        "priority_group", "logical_pages", "desktop_pages", "mobile_pages", "stylesheets", "scripts", "candidates", "attempted_assets",
        "logo_paths", "banner_paths", "social_paths", "reference_paths",
    ]
    with MANIFEST_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            flat = dict(row)
            stats = row.get("crawl_stats", {})
            flat.update({key: stats.get(key, "") for key in ("logical_pages", "desktop_pages", "mobile_pages", "stylesheets", "scripts", "candidates", "attempted_assets")})
            for kind in ("logo", "banner", "social", "reference"):
                flat[f"{kind}_paths"] = json.dumps([asset.get("path") for asset in row.get("assets", []) if asset.get("type") == kind], ensure_ascii=False)
            writer.writerow(flat)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deep crawl official sites for desktop/mobile design-reference images.")
    parser.add_argument("--company", action="append", default=[], help="Company name or slug. Repeatable.")
    parser.add_argument("--category", action="append", default=[], help="Category. Repeatable.")
    parser.add_argument("--priority", action="store_true", help="Seed and crawl the long-term rental/lease priority list.")
    parser.add_argument("--max-pages", type=int, default=28, help="Logical internal pages per company; each is fetched as desktop and mobile.")
    parser.add_argument("--max-assets", type=int, default=220, help="Maximum unique downloaded assets per company. 0 removes the cap.")
    parser.add_argument("--max-attempts", type=int, default=420, help="Maximum candidate image requests per company. 0 removes the cap.")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--recover-only", action="store_true", help="Recover completed deep-crawl source files into the manifest and exit.")
    parser.add_argument("--skip-deep", action="store_true", help="Skip rows that already contain deep-crawl statistics.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not MANIFEST_JSON.exists():
        print(f"Missing {MANIFEST_JSON}", file=sys.stderr)
        return 2
    rows: list[dict[str, Any]] = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    if args.priority:
        rows = seed_priority(rows)
    if args.recover_only:
        rows, recovered = recover_sources(rows)
        write_outputs(rows)
        print(f"Recovered {recovered} completed company sources.")
        return 0
    selectors = {value.casefold() for value in args.company}
    categories = set(args.category)
    selected: list[int] = []
    for index, row in enumerate(rows):
        matches_company = not selectors or str(row.get("company", "")).casefold() in selectors or str(row.get("slug", "")).casefold() in selectors
        matches_category = not categories or str(row.get("category", "")) in categories
        matches_priority = not args.priority or row.get("priority_group") == "장기렌트·리스"
        not_completed = not args.skip_deep or not row.get("crawl_stats")
        if matches_company and matches_category and matches_priority and not_completed:
            selected.append(index)
    if args.limit:
        selected = selected[:args.limit]
    if not selected:
        print("No matching companies.")
        return 0

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(crawl_company, rows[index], args.max_pages, args.max_assets, args.max_attempts): index for index in selected}
        completed = 0
        for future in as_completed(futures):
            index = futures[future]
            try:
                rows[index] = future.result()
            except Exception as exc:
                rows[index]["collection_status"] = "error"
                rows[index]["collection_error"] = f"Unhandled {type(exc).__name__}: {exc}"[:600]
            completed += 1
            row = rows[index]
            stats = row.get("crawl_stats", {})
            print(
                f"[{completed}/{len(selected)}] {row.get('company')} pages={stats.get('logical_pages', 0)} "
                f"pc={stats.get('desktop_pages', 0)} mo={stats.get('mobile_pages', 0)} "
                f"logo={row.get('logo_count', 0)} banner={row.get('banner_count', 0)} "
                f"social={row.get('social_count', 0)} ref={row.get('reference_count', 0)}",
                flush=True,
            )
            write_outputs(rows)
    write_outputs(rows)
    print(f"Done: {len(selected)} companies in {time.perf_counter() - started:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
