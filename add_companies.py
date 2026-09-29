"""Add companies to manifest.json and fetch their favicon and social (OG) image.

The input is a JSON list of {"company", "slug", "url", "category", "sub", "region"}.
Rows that already exist (same slug or same site address) are skipped.

    python add_companies.py new_companies.json
    python add_companies.py new_companies.json --dry-run
    python add_companies.py --backfill        # fill missing favicons/OG images from components.json

Sites that refuse plain HTTP clients are still added; collect_components.mjs
renders them in a real browser and records their icon and share image
addresses, which --backfill then downloads.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
import urllib3
from bs4 import BeautifulSoup
from PIL import Image

from reference_collector import write_outputs

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
MANIFEST_JSON = ROOT / "manifest.json"
COMPONENTS_JSON = ROOT / "components.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
MAX_BYTES = 8 * 1024 * 1024
SLUG_RE = re.compile(r"[^a-z0-9]+")


def clean_slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return SLUG_RE.sub("-", value).strip("-")[:60]


def site_key(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    path = parsed.path.rstrip("/").lower()
    return host + path


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    })
    return s


def get(s: requests.Session, url: str, **kwargs) -> requests.Response:
    try:
        return s.get(url, timeout=(8, 25), allow_redirects=True, **kwargs)
    except requests.exceptions.SSLError:
        return s.get(url, timeout=(8, 25), allow_redirects=True, verify=False, **kwargs)


def download(s: requests.Session, url: str, referer: str) -> tuple[bytes, str]:
    response = get(s, url, headers={"Referer": referer, "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"}, stream=True)
    response.raise_for_status()
    payload = response.raw.read(MAX_BYTES + 1, decode_content=True)
    if not payload or len(payload) > MAX_BYTES:
        raise ValueError("empty or oversized")
    content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
    head = payload[:400].lstrip().lower()
    if head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        raise ValueError("html instead of image")
    return payload, content_type


def image_size(payload: bytes, content_type: str, url: str) -> tuple[int, int, str]:
    head = payload[:2048].lower()
    if "svg" in content_type or url.lower().split("?")[0].endswith(".svg") or b"<svg" in head:
        text = payload[:200_000].decode("utf-8", "ignore")
        box = re.search(r"viewBox\s*=\s*['\"]\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)", text, re.I)
        if box:
            return int(float(box.group(1))), int(float(box.group(2))), "svg"
        return 512, 512, "svg"
    with Image.open(io.BytesIO(payload)) as image:
        if (image.format or "").upper() == "ICO":
            sizes = image.info.get("sizes") or {(image.width, image.height)}
            width, height = max(sizes)
            return int(width), int(height), "ico"
        return int(image.width), int(image.height), (image.format or "").lower()


def icon_candidates(soup: BeautifulSoup, page_url: str) -> list[tuple[int, str, str]]:
    found: list[tuple[int, str, str]] = []
    for link in soup.find_all("link", href=True):
        rel = " ".join(link.get("rel", [])).lower()
        if "icon" not in rel:
            continue
        sizes = str(link.get("sizes", ""))
        numbers = [int(n) for n in re.findall(r"(\d+)x\d+", sizes)]
        size = max(numbers) if numbers else (180 if "apple-touch" in rel else 32)
        if "mask-icon" in rel:
            size = 20
        if str(link.get("type", "")).endswith("svg") or link["href"].lower().split("?")[0].endswith(".svg"):
            size = max(size, 150)
        found.append((size, urljoin(page_url, link["href"]), rel))
    found.append((16, urljoin(page_url, "/favicon.ico"), "default /favicon.ico"))
    return sorted(found, key=lambda item: -item[0])


def save_favicon(destination: Path, payload: bytes, content_type: str, url: str) -> dict[str, Any]:
    width, height, fmt = image_size(payload, content_type, url)
    ext = {"svg": "svg", "ico": "ico", "png": "png", "jpeg": "jpg", "gif": "gif", "webp": "webp"}.get(fmt, "png")
    data = payload
    if fmt not in {"svg", "ico"}:
        with Image.open(io.BytesIO(payload)) as image:
            image.load()
            icon = image.convert("RGBA")
        icon.thumbnail((256, 256), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        icon.save(buffer, "PNG", optimize=True)
        data, ext = buffer.getvalue(), "png"
        width, height = icon.size
    path = destination / f"favicon.{ext}"
    path.write_bytes(data)
    return {"path": path, "bytes": len(data), "width": width, "height": height,
            "content_type": {"svg": "image/svg+xml", "ico": "image/x-icon"}.get(ext, f"image/{ext}"),
            "sha256": hashlib.sha256(data).hexdigest()}


def save_social(destination: Path, payload: bytes, content_type: str, url: str) -> dict[str, Any]:
    width, height, fmt = image_size(payload, content_type, url)
    if fmt == "svg":
        path = destination / "og.svg"
        path.write_bytes(payload)
        data = payload
        mime = "image/svg+xml"
    else:
        with Image.open(io.BytesIO(payload)) as image:
            image.load()
            picture = image.convert("RGBA" if image.mode in {"RGBA", "LA", "P"} else "RGB")
        picture.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        if picture.mode == "RGBA" and picture.getextrema()[3][0] == 255:
            picture = picture.convert("RGB")
        buffer = io.BytesIO()
        picture.save(buffer, "WEBP", quality=78, method=6)
        data = buffer.getvalue()
        path = destination / "og.webp"
        path.write_bytes(data)
        width, height = picture.size
        mime = "image/webp"
    return {"path": path, "bytes": len(data), "width": width, "height": height, "content_type": mime,
            "sha256": hashlib.sha256(data).hexdigest()}


def fetch_icons(row: dict[str, Any], s: requests.Session, page_url: str, icons: list[tuple[int, str, str]], og_urls: list[str]) -> None:
    destination = ASSETS / row["category"] / row["slug"]
    destination.mkdir(parents=True, exist_ok=True)
    assets = list(row.get("assets", []))
    known_paths = {asset.get("path") for asset in assets}
    if not row.get("favicon_path"):
        for _, url, rel in icons:
            try:
                payload, content_type = download(s, url, page_url)
                saved = save_favicon(destination, payload, content_type, url)
            except Exception as exc:
                row["favicon_error"] = f"{type(exc).__name__}: {exc}"[:200]
                continue
            row.update({
                "favicon_path": saved["path"].relative_to(ROOT).as_posix(), "favicon_source_url": url, "favicon_source_tag": rel,
                "favicon_content_type": saved["content_type"], "favicon_bytes": str(saved["bytes"]), "favicon_sha256": saved["sha256"], "favicon_error": "",
            })
            break
    if not row.get("og_path"):
        for url in og_urls:
            try:
                payload, content_type = download(s, url, page_url)
                saved = save_social(destination, payload, content_type, url)
            except Exception as exc:
                row["og_error"] = f"{type(exc).__name__}: {exc}"[:200]
                continue
            if saved["width"] < 200 or saved["height"] < 100:
                saved["path"].unlink(missing_ok=True)
                continue
            row.update({
                "og_path": saved["path"].relative_to(ROOT).as_posix(), "og_source_url": url, "og_source_tag": "og:image",
                "og_content_type": saved["content_type"], "og_bytes": str(saved["bytes"]), "og_sha256": saved["sha256"], "og_error": "",
            })
            break
    for kind, prefix in (("favicon", "favicon"), ("social", "og")):
        if row.get(f"{prefix}_path") and row[f"{prefix}_path"] not in known_paths:
            path = ROOT / row[f"{prefix}_path"]
            payload = path.read_bytes()
            try:
                width, height, _ = image_size(payload, row.get(f"{prefix}_content_type", ""), str(path))
            except Exception:
                width = height = 0
            assets.insert(0 if kind == "favicon" else 1, {
                "type": kind, "path": row[f"{prefix}_path"], "source_url": row.get(f"{prefix}_source_url", ""),
                "source_tag": row.get(f"{prefix}_source_tag", ""), "content_type": row.get(f"{prefix}_content_type", ""),
                "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "width": width, "height": height,
            })
    row["assets"] = assets
    row["asset_count"] = len(assets)


def build_row(item: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {
        "category": item["category"], "company": item["company"], "slug": item["slug"],
        "requested_url": item["url"], "page_url": item["url"], "page_title": "", "page_status": "", "page_error": "",
        "favicon_path": "", "favicon_source_url": "", "favicon_source_tag": "", "favicon_content_type": "", "favicon_bytes": "", "favicon_sha256": "", "favicon_error": "",
        "og_path": "", "og_source_url": "", "og_source_tag": "", "og_content_type": "", "og_bytes": "", "og_sha256": "", "og_error": "",
        "asset_page_url": item["url"], "assets": [], "logo_count": 0, "banner_count": 0, "reference_count": 0, "asset_count": 0,
        "collection_status": "partial", "collection_error": "", "region": item.get("region", ""), "sub": item.get("sub", ""),
    }
    s = session()
    try:
        response = get(s, item["url"])
        row["page_status"] = str(response.status_code)
        row["page_url"] = str(response.url)
        soup = BeautifulSoup(response.content[:3_000_000], "html.parser")
        title = soup.title.get_text(" ", strip=True) if soup.title else ""
        row["page_title"] = re.sub(r"\s+", " ", title)[:160]
        og = [urljoin(row["page_url"], tag["content"]) for tag in soup.find_all("meta", content=True)
              if (tag.get("property") or tag.get("name") or "").lower() in {"og:image", "og:image:url", "og:image:secure_url", "twitter:image"}]
        fetch_icons(row, s, row["page_url"], icon_candidates(soup, row["page_url"]), og)
        if response.status_code >= 400:
            row["page_error"] = f"HTTP {response.status_code}"
    except Exception as exc:
        row["page_error"] = f"{type(exc).__name__}: {exc}"[:300]
        row["collection_status"] = "page-error"
    return row


def backfill(rows: list[dict[str, Any]]) -> int:
    """Download favicons and OG images recorded by the browser for rows that lack them."""
    try:
        components = json.loads(COMPONENTS_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return 0
    meta_by_slug: dict[str, dict[str, Any]] = {}
    for entry in components:
        meta = entry.get("meta") or {}
        if meta and (entry.get("device") == "pc" or entry["slug"] not in meta_by_slug):
            meta_by_slug[entry["slug"]] = meta
    jobs = [row for row in rows if row["slug"] in meta_by_slug and (not row.get("favicon_path") or not row.get("og_path"))]

    def work(row: dict[str, Any]) -> bool:
        meta = meta_by_slug[row["slug"]]
        page = meta.get("final_url") or row.get("page_url")
        icons = []
        for icon in meta.get("icons", []):
            numbers = [int(n) for n in re.findall(r"(\d+)x\d+", icon.get("sizes", ""))]
            rel = icon.get("rel", "").lower()
            size = max(numbers) if numbers else (180 if "apple-touch" in rel else 20 if "mask" in rel else 32)
            if icon.get("href", "").lower().split("?")[0].endswith(".svg"):
                size = max(size, 150)
            icons.append((size, icon["href"], rel))
        icons.sort(key=lambda item: -item[0])
        icons.append((16, urljoin(page, "/favicon.ico"), "default /favicon.ico"))
        before = (row.get("favicon_path"), row.get("og_path"))
        if not row.get("page_title") and meta.get("title"):
            row["page_title"] = meta["title"]
        fetch_icons(row, session(), page, icons, [meta["og_image"]] if meta.get("og_image") else [])
        return before != (row.get("favicon_path"), row.get("og_path"))

    changed = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for future in as_completed([pool.submit(work, row) for row in jobs]):
            try:
                changed += bool(future.result())
            except Exception:
                pass
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input", nargs="?", help="JSON list of companies to add")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backfill", action="store_true")
    parser.add_argument("--workers", type=int, default=16)
    args = parser.parse_args()

    rows: list[dict[str, Any]] = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    if args.backfill:
        changed = backfill(rows)
        write_outputs(rows)
        print(f"backfilled {changed} companies")
        return 0
    if not args.input:
        parser.error("input file is required")

    incoming = json.loads(Path(args.input).read_text(encoding="utf-8"))
    slugs = {row["slug"] for row in rows}
    sites = {site_key(row.get("requested_url") or row.get("page_url") or "") for row in rows}
    names = {row["company"].casefold() for row in rows}
    fresh: list[dict[str, Any]] = []
    skipped = 0
    for item in incoming:
        url = str(item.get("url", "")).strip()
        if not re.match(r"^https?://", url):
            skipped += 1
            continue
        slug = clean_slug(item.get("slug") or item.get("company") or "")
        if not slug:
            slug = clean_slug(urlparse(url).hostname or "")
        base, n = slug, 2
        while slug in slugs:
            slug = f"{base}-{n}"
            n += 1
        key = site_key(url)
        if key in sites or str(item.get("company", "")).casefold() in names:
            skipped += 1
            continue
        slugs.add(slug)
        sites.add(key)
        names.add(str(item.get("company", "")).casefold())
        fresh.append({**item, "slug": slug, "url": url})
    print(f"new={len(fresh)} skipped={skipped}")
    if args.dry_run or not fresh:
        return 0

    added: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(build_row, item): item for item in fresh}
        for index, future in enumerate(as_completed(futures), start=1):
            item = futures[future]
            try:
                row = future.result()
            except Exception as exc:
                print(f"  {item['company']} failed: {exc}")
                continue
            added.append(row)
            if index % 25 == 0 or index == len(futures):
                print(f"  [{index}/{len(futures)}] {row['company']} status={row['page_status'] or row['page_error'][:40]} favicon={'y' if row['favicon_path'] else 'n'} og={'y' if row['og_path'] else 'n'}", flush=True)
    rows.extend(sorted(added, key=lambda row: (row["category"], row["slug"])))
    write_outputs(rows)
    print(f"manifest rows={len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
