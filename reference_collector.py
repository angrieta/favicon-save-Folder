from __future__ import annotations

import argparse
import csv
import hashlib
import html as html_lib
import io
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
MANIFEST_JSON = ROOT / "manifest.json"
MANIFEST_CSV = ROOT / "manifest.csv"

MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
MAX_LOGOS = 2
MAX_BANNERS = 2
MAX_REFERENCES = 3
DEFAULT_WORKERS = min(12, max(6, (os.cpu_count() or 4)))

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/138.0.0.0 Safari/537.36"
)

IMAGE_ATTRS = (
    "src",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-image",
    "data-bg",
)
LOGO_RE = re.compile(r"(?:^|[\W_])(logo|wordmark|brand|bi|ci|로고)(?:[\W_]|$)", re.I)
BANNER_RE = re.compile(
    r"(?:^|[\W_])(hero|banner|visual|keyvisual|key-visual|kv|masthead|cover|campaign|promo|promotion|main-slide|main_visual|메인|배너)(?:[\W_]|$)",
    re.I,
)
NOISE_RE = re.compile(
    r"(?:^|[\W_])(icon|ico|badge|button|arrow|chevron|sprite|pixel|tracking|qr|appstore|googleplay|award|flag|avatar|thumb)(?:[\W_]|$)",
    re.I,
)
URL_IN_STYLE_RE = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I)


@dataclass(frozen=True)
class Candidate:
    url: str
    score: int
    source_tag: str
    context: str


def normalize_url(value: str | None, base: str) -> str | None:
    if not value:
        return None
    value = html_lib.unescape(value.strip().strip("'\""))
    if not value or value.startswith(("data:", "blob:", "javascript:", "mailto:")):
        return None
    if value.startswith("//"):
        value = "https:" + value
    url = urljoin(base, value)
    if urlparse(url).scheme not in {"http", "https"}:
        return None
    return url.split("#", 1)[0]


def srcset_urls(value: str | None, base: str) -> list[str]:
    if not value:
        return []
    ranked: list[tuple[float, str]] = []
    for item in value.split(","):
        parts = item.strip().split()
        if not parts:
            continue
        url = normalize_url(parts[0], base)
        if not url:
            continue
        weight = 1.0
        if len(parts) > 1:
            descriptor = parts[-1].lower()
            try:
                weight = float(descriptor[:-1]) if descriptor.endswith("x") else float(descriptor[:-1]) / 1000
            except ValueError:
                weight = 1.0
        ranked.append((weight, url))
    return [url for _, url in sorted(ranked, reverse=True)]


def flatten_json_images(value: Any, path: str = "json-ld") -> Iterable[tuple[str, str]]:
    if isinstance(value, dict):
        for key, item in value.items():
            child_path = f"{path}.{key}"
            if key.lower() in {"logo", "image", "thumbnailurl", "contenturl"}:
                if isinstance(item, str):
                    yield item, child_path
                elif isinstance(item, dict):
                    for nested_key in ("url", "contentUrl"):
                        if isinstance(item.get(nested_key), str):
                            yield item[nested_key], f"{child_path}.{nested_key}"
                elif isinstance(item, list):
                    for nested in item:
                        if isinstance(nested, str):
                            yield nested, child_path
                        elif isinstance(nested, dict) and isinstance(nested.get("url"), str):
                            yield nested["url"], f"{child_path}.url"
            yield from flatten_json_images(item, child_path)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from flatten_json_images(item, f"{path}[{index}]")


def collect_candidates(soup: BeautifulSoup, page_url: str) -> dict[str, list[Candidate]]:
    buckets: dict[str, dict[str, Candidate]] = {"logo": {}, "banner": {}, "reference": {}}

    def add(kind: str, raw_url: str | None, score: int, source_tag: str, context: str = "") -> None:
        url = normalize_url(raw_url, page_url)
        if not url:
            return
        current = buckets[kind].get(url)
        candidate = Candidate(url, score, source_tag, context[:240])
        if current is None or candidate.score > current.score:
            buckets[kind][url] = candidate

    for script in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            continue
        for raw_url, json_path in flatten_json_images(payload):
            if ".logo" in json_path.lower():
                add("logo", raw_url, 260, json_path, "structured data logo")
            else:
                add("reference", raw_url, 105, json_path, "structured data image")

    for link in soup.find_all("link", href=True):
        rel = " ".join(link.get("rel", [])).lower()
        as_value = str(link.get("as", "")).lower()
        context = " ".join((rel, as_value, str(link.get("type", "")), link.get("href", "")))
        if "image" in as_value or "image_src" in rel or "preload" in rel:
            add("reference", link.get("href"), 70, f"link:{rel or as_value}", context)
            if BANNER_RE.search(context):
                add("banner", link.get("href"), 170, f"link:{rel or as_value}", context)

    image_nodes = list(soup.find_all(["img", "source", "picture"]))
    for index, node in enumerate(image_nodes):
        parent = node.parent
        ancestry = " ".join(
            " ".join(
                filter(
                    None,
                    [
                        ancestor.name,
                        str(ancestor.get("id", "")),
                        " ".join(ancestor.get("class", [])),
                        str(ancestor.get("aria-label", "")),
                    ],
                )
            )
            for ancestor in list(node.parents)[:4]
            if getattr(ancestor, "name", None)
        )
        context = " ".join(
            filter(
                None,
                [
                    node.name,
                    str(node.get("id", "")),
                    " ".join(node.get("class", [])),
                    str(node.get("alt", "")),
                    str(node.get("title", "")),
                    str(node.get("aria-label", "")),
                    ancestry,
                ],
            )
        )
        urls: list[str] = []
        for attr in IMAGE_ATTRS:
            url = normalize_url(node.get(attr), page_url)
            if url:
                urls.append(url)
        for attr in ("srcset", "data-srcset"):
            urls.extend(srcset_urls(node.get(attr), page_url)[:2])
        if node.name == "picture" and parent:
            for child in node.find_all(["img", "source"]):
                for attr in IMAGE_ATTRS:
                    url = normalize_url(child.get(attr), page_url)
                    if url:
                        urls.append(url)
                urls.extend(srcset_urls(child.get("srcset"), page_url)[:2])

        position_bonus = max(0, 70 - index * 3)
        is_noise = bool(NOISE_RE.search(context))
        is_logo = bool(LOGO_RE.search(context))
        is_banner = bool(BANNER_RE.search(context))
        in_header = bool(re.search(r"\b(header|nav)\b", ancestry, re.I))
        in_main = bool(re.search(r"\b(main|article|section)\b", ancestry, re.I))

        for url in dict.fromkeys(urls):
            url_context = f"{context} {url}"
            logo_score = 30 + (190 if is_logo or LOGO_RE.search(url) else 0) + (70 if in_header else 0)
            banner_score = 25 + position_bonus + (190 if is_banner or BANNER_RE.search(url) else 0) + (35 if in_main else 0)
            reference_score = 40 + position_bonus + (25 if in_main else 0)
            if is_noise or NOISE_RE.search(url_context):
                logo_score -= 90
                banner_score -= 120
                reference_score -= 100
            if logo_score >= 95:
                add("logo", url, logo_score, f"{node.name}:semantic-logo", context)
            if banner_score >= 105:
                add("banner", url, banner_score, f"{node.name}:semantic-banner", context)
            if reference_score >= 45:
                add("reference", url, reference_score, f"{node.name}:page-image", context)

    for node in soup.find_all(style=True):
        style = str(node.get("style", ""))
        context = " ".join(
            [node.name, str(node.get("id", "")), " ".join(node.get("class", [])), style[:400]]
        )
        for _, raw_url in URL_IN_STYLE_RE.findall(style):
            score = 170 if BANNER_RE.search(context) else 110
            add("banner", raw_url, score, "inline-background-image", context)
            add("reference", raw_url, score - 35, "inline-background-image", context)

    for style_tag in soup.find_all("style"):
        css = style_tag.string or style_tag.get_text()
        for match in URL_IN_STYLE_RE.finditer(css):
            start = max(0, match.start() - 180)
            context = css[start : match.end() + 80]
            if BANNER_RE.search(context):
                add("banner", match.group(2), 145, "style-background-image", context)

    return {
        kind: sorted(items.values(), key=lambda item: item.score, reverse=True)
        for kind, items in buckets.items()
    }


def image_dimensions(payload: bytes, content_type: str, url: str) -> tuple[int, int, str]:
    head = payload[:1024].lstrip()
    is_svg = "svg" in content_type.lower() or urlparse(url).path.lower().endswith(".svg") or b"<svg" in head.lower()
    if is_svg:
        text = payload[:200_000].decode("utf-8", "ignore")
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


def qualifies(kind: str, width: int, height: int, fmt: str) -> bool:
    if width <= 0 or height <= 0:
        return False
    ratio = width / height
    area = width * height
    if kind == "logo":
        return fmt == "svg" or (width >= 80 and height >= 28 and 0.18 <= ratio <= 14 and area >= 3_500)
    if kind == "banner":
        return width >= 640 and height >= 220 and ratio >= 1.28 and area >= 220_000
    return width >= 360 and height >= 220 and 0.38 <= ratio <= 4.2 and area >= 140_000


def fetch_candidate(session: requests.Session, candidate: Candidate, referer: str) -> tuple[bytes, str, str]:
    options = {
        "headers": {
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        "timeout": (8, 28),
        "allow_redirects": True,
        "stream": True,
    }
    try:
        response = session.get(candidate.url, **options)
    except requests.exceptions.SSLError:
        response = session.get(candidate.url, verify=False, **options)
    response.raise_for_status()
    payload = response.raw.read(MAX_DOWNLOAD_BYTES + 1, decode_content=True)
    if not payload or len(payload) > MAX_DOWNLOAD_BYTES:
        raise ValueError("empty or oversized image")
    content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
    if not content_type.startswith("image/") and b"<svg" not in payload[:1024].lower():
        raise ValueError(f"not an image: {content_type or 'unknown'}")
    return payload, content_type, str(response.url)


def save_optimized(
    payload: bytes,
    content_type: str,
    source_url: str,
    destination: Path,
    kind: str,
    index: int,
) -> tuple[Path, int, int, str]:
    width, height, fmt = image_dimensions(payload, content_type, source_url)
    if not qualifies(kind, width, height, fmt):
        raise ValueError(f"unsuitable dimensions: {width}x{height}")

    if fmt == "svg":
        output = destination / f"{kind}-{index}.svg"
        output.write_bytes(payload)
        return output, width, height, "image/svg+xml"

    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        image = source.copy()
    if image.mode == "P" and "transparency" in image.info:
        image = image.convert("RGBA")
    max_width = 1600 if kind == "logo" else 1800
    max_height = 1600 if kind == "logo" else 1350
    image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

    if kind == "logo" and ("A" in image.getbands() or "transparency" in image.info):
        image = image.convert("RGBA")
        output = destination / f"{kind}-{index}.png"
        image.save(output, "PNG", optimize=True)
        mime = "image/png"
    elif kind == "logo":
        image = image.convert("RGB")
        output = destination / f"{kind}-{index}.webp"
        image.save(output, "WEBP", quality=92, method=6)
        mime = "image/webp"
    else:
        image = image.convert("RGB")
        output = destination / f"{kind}-{index}.webp"
        image.save(output, "WEBP", quality=86, method=6)
        mime = "image/webp"
    return output, int(image.width), int(image.height), mime


def local_asset_metadata(row: dict[str, Any], kind: str, path_key: str, source_key: str, tag_key: str) -> dict[str, Any] | None:
    path_value = row.get(path_key)
    if not path_value:
        return None
    path = ROOT / str(path_value)
    if not path.exists():
        return None
    payload = path.read_bytes()
    content_type = str(row.get(path_key.replace("_path", "_content_type"), ""))
    width, height, _ = image_dimensions(payload, content_type, str(path))
    return {
        "type": kind,
        "path": path.relative_to(ROOT).as_posix(),
        "source_url": row.get(source_key, ""),
        "source_tag": row.get(tag_key, ""),
        "content_type": content_type,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "width": width,
        "height": height,
    }


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": UA,
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        }
    )
    return session


def cleanup_generated_assets(destination: Path, assets: list[dict[str, Any]]) -> None:
    referenced = {str(asset.get("path", "")) for asset in assets}
    for kind in ("logo", "banner", "reference"):
        for path in destination.glob(f"{kind}-*.*"):
            if path.relative_to(ROOT).as_posix() not in referenced:
                path.unlink(missing_ok=True)


def collect_company(row: dict[str, Any]) -> dict[str, Any]:
    updated = dict(row)
    destination = ASSETS / str(row["category"]) / str(row["slug"])
    destination.mkdir(parents=True, exist_ok=True)
    session = build_session()
    referer = str(row.get("page_url") or row.get("requested_url") or "")
    assets: list[dict[str, Any]] = []
    for item in (
        local_asset_metadata(updated, "favicon", "favicon_path", "favicon_source_url", "favicon_source_tag"),
        local_asset_metadata(updated, "social", "og_path", "og_source_url", "og_source_tag"),
    ):
        if item:
            assets.append(item)

    known_by_source = {str(asset.get("source_url")): asset for asset in assets if asset.get("source_url")}
    known_by_hash = {str(asset.get("sha256")): asset for asset in assets if asset.get("sha256")}
    selected_sources: set[str] = set(known_by_source)
    errors: list[str] = []

    try:
        try:
            response = session.get(referer, timeout=(10, 35), allow_redirects=True)
        except requests.exceptions.SSLError:
            response = session.get(referer, timeout=(10, 35), allow_redirects=True, verify=False)
        response.raise_for_status()
        page_url = str(response.url)
        soup = BeautifulSoup(response.content, "html.parser")
        candidates = collect_candidates(soup, page_url)
        updated["asset_page_url"] = page_url
    except Exception as exc:
        updated["asset_page_url"] = referer
        updated["collection_status"] = "page-error"
        updated["collection_error"] = f"{type(exc).__name__}: {exc}"[:500]
        updated["assets"] = assets
        return updated

    limits = {"logo": MAX_LOGOS, "banner": MAX_BANNERS, "reference": MAX_REFERENCES}
    attempt_limits = {"logo": 18, "banner": 24, "reference": 28}
    for kind in ("logo", "banner", "reference"):
        collected = 0
        attempts = 0
        kind_paths: set[str] = set()
        for candidate in candidates[kind]:
            if collected >= limits[kind] or attempts >= attempt_limits[kind]:
                break
            if kind == "reference" and candidate.url in selected_sources:
                continue
            attempts += 1
            try:
                existing = known_by_source.get(candidate.url)
                if existing:
                    width = int(existing.get("width") or 0)
                    height = int(existing.get("height") or 0)
                    fmt = "svg" if str(existing.get("content_type")) == "image/svg+xml" else "raster"
                    if qualifies(kind, width, height, fmt):
                        existing_path = str(existing.get("path", ""))
                        if existing.get("type") == kind or existing_path in kind_paths:
                            selected_sources.add(candidate.url)
                            continue
                        reused = dict(existing)
                        reused.update(
                            {
                                "type": kind,
                                "source_tag": candidate.source_tag,
                                "context": candidate.context,
                                "reused_from": existing.get("type", "asset"),
                            }
                        )
                        assets.append(reused)
                        kind_paths.add(existing_path)
                        selected_sources.add(candidate.url)
                        collected += 1
                    continue

                payload, content_type, final_url = fetch_candidate(session, candidate, page_url)
                width, height, fmt = image_dimensions(payload, content_type, final_url)
                if not qualifies(kind, width, height, fmt):
                    continue
                source_hash = hashlib.sha256(payload).hexdigest()
                duplicate = known_by_hash.get(source_hash)
                if duplicate:
                    duplicate_path = str(duplicate.get("path", ""))
                    if duplicate.get("type") == kind or duplicate_path in kind_paths:
                        selected_sources.add(candidate.url)
                        selected_sources.add(final_url)
                        continue
                    reused = dict(duplicate)
                    reused.update(
                        {
                            "type": kind,
                            "source_url": final_url,
                            "source_tag": candidate.source_tag,
                            "context": candidate.context,
                            "reused_from": duplicate.get("type", "asset"),
                        }
                    )
                    assets.append(reused)
                    kind_paths.add(duplicate_path)
                else:
                    output, out_width, out_height, out_mime = save_optimized(
                        payload,
                        content_type,
                        final_url,
                        destination,
                        kind,
                        collected + 1,
                    )
                    saved_payload = output.read_bytes()
                    asset = {
                        "type": kind,
                        "path": output.relative_to(ROOT).as_posix(),
                        "source_url": final_url,
                        "source_tag": candidate.source_tag,
                        "context": candidate.context,
                        "content_type": out_mime,
                        "bytes": len(saved_payload),
                        "sha256": hashlib.sha256(saved_payload).hexdigest(),
                        "width": out_width,
                        "height": out_height,
                    }
                    assets.append(asset)
                    kind_paths.add(asset["path"])
                    known_by_hash[source_hash] = asset
                known_by_source[candidate.url] = assets[-1]
                selected_sources.add(candidate.url)
                selected_sources.add(final_url)
                collected += 1
            except Exception as exc:
                errors.append(f"{kind}:{type(exc).__name__}:{candidate.url}")

    deduped_assets: list[dict[str, Any]] = []
    seen_assets: set[tuple[str, str]] = set()
    for asset in assets:
        key = (str(asset.get("type", "")), str(asset.get("path", "")))
        if key in seen_assets:
            continue
        seen_assets.add(key)
        deduped_assets.append(asset)
    assets = deduped_assets
    updated["assets"] = assets
    updated["logo_count"] = sum(asset["type"] == "logo" for asset in assets)
    updated["banner_count"] = sum(asset["type"] == "banner" for asset in assets)
    updated["reference_count"] = sum(asset["type"] == "reference" for asset in assets)
    updated["asset_count"] = len(assets)
    updated["collection_status"] = "complete" if updated["logo_count"] and updated["banner_count"] else "partial"
    updated["collection_error"] = "; ".join(errors[-6:])
    cleanup_generated_assets(destination, assets)

    source_path = destination / "source.json"
    source_metadata = {
        "company": updated.get("company"),
        "category": updated.get("category"),
        "requested_url": updated.get("requested_url"),
        "page_url": updated.get("page_url"),
        "page_title": updated.get("page_title"),
        "collection_status": updated.get("collection_status"),
        "assets": assets,
    }
    source_path.write_text(json.dumps(source_metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return updated


def write_outputs(rows: list[dict[str, Any]]) -> None:
    MANIFEST_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    for row in rows:
        destination = ASSETS / str(row["category"]) / str(row["slug"])
        destination.mkdir(parents=True, exist_ok=True)
        source_metadata = {
            "company": row.get("company"),
            "category": row.get("category"),
            "requested_url": row.get("requested_url"),
            "page_url": row.get("page_url"),
            "page_title": row.get("page_title"),
            "collection_status": row.get("collection_status"),
            "collection_error": row.get("collection_error"),
            "assets": row.get("assets", []),
        }
        (destination / "source.json").write_text(
            json.dumps(source_metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    legacy_fields = [
        "category", "company", "slug", "requested_url", "page_url", "page_title", "page_status", "page_error",
        "favicon_path", "favicon_source_url", "favicon_source_tag", "favicon_content_type", "favicon_bytes", "favicon_sha256", "favicon_error",
        "og_path", "og_source_url", "og_source_tag", "og_content_type", "og_bytes", "og_sha256", "og_error",
    ]
    extra_fields = [
        "asset_page_url", "collection_status", "collection_error", "asset_count", "logo_count", "banner_count", "reference_count",
        "logo_paths", "banner_paths", "reference_paths",
    ]
    with MANIFEST_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=legacy_fields + extra_fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            flat = dict(row)
            assets = row.get("assets", [])
            for kind in ("logo", "banner", "reference"):
                flat[f"{kind}_paths"] = json.dumps(
                    [asset.get("path") for asset in assets if asset.get("type") == kind],
                    ensure_ascii=False,
                )
            writer.writerow(flat)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect designer-reference images from official company homepages.")
    parser.add_argument("--limit", type=int, default=0, help="Process only the first N matching companies.")
    parser.add_argument("--company", action="append", default=[], help="Process a company name or slug. May be repeated.")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--skip-complete", action="store_true", help="Skip rows that already contain a logo and banner.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not MANIFEST_JSON.exists():
        print(f"Missing {MANIFEST_JSON}", file=sys.stderr)
        return 2
    rows: list[dict[str, Any]] = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    selectors = {value.casefold() for value in args.company}

    selected_indices: list[int] = []
    for index, row in enumerate(rows):
        if selectors and str(row.get("company", "")).casefold() not in selectors and str(row.get("slug", "")).casefold() not in selectors:
            continue
        if args.skip_complete and row.get("logo_count") and row.get("banner_count"):
            continue
        selected_indices.append(index)
    if args.limit:
        selected_indices = selected_indices[: args.limit]
    if not selected_indices:
        print("No matching companies.")
        return 0

    started = time.perf_counter()
    completed = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(collect_company, rows[index]): index for index in selected_indices}
        for future in as_completed(futures):
            index = futures[future]
            row = rows[index]
            try:
                rows[index] = future.result()
            except Exception as exc:
                failed = dict(row)
                failed["collection_status"] = "error"
                failed["collection_error"] = f"Unhandled {type(exc).__name__}: {exc}"[:500]
                rows[index] = failed
            completed += 1
            result = rows[index]
            print(
                f"[{completed}/{len(selected_indices)}] {result.get('company')} "
                f"logo={result.get('logo_count', 0)} banner={result.get('banner_count', 0)} ref={result.get('reference_count', 0)} "
                f"status={result.get('collection_status', 'error')}",
                flush=True,
            )

    write_outputs(rows)
    elapsed = time.perf_counter() - started
    print(f"Done: {completed} companies in {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
