"""Finish the library after collecting: thumbnails, duplicate removal and brand colors.

    python build_library.py

The collectors own components.json and layouts.json; this script only reads
them and writes parts.json (what the web page loads), so it can run while a
collection is still going.

1. Page parts that collect_components.mjs stored as boxes on a full-page
   capture get a small thumbnail for the image wall (thumbs/components/...).
   Parts that came out blank (an animation that had not run, an empty video)
   are dropped.
2. Large images (full-page captures, banners, photos, popups) get a wall
   thumbnail at thumbs/<original path>.webp, so browsing does not download
   the originals. The page falls back to the original when a thumbnail is missing.
3. Duplicates are removed: near-identical page parts of one company, parts
   whose pixels match another company's exactly, and older full-page captures
   that look the same as the newest one.
4. site.json is what the web page loads: the companies, their images, the
   full-page captures and the page parts, with only the fields the page uses.
5. brand_colors.json gets each company's point colors, combined from the CSS
   variables, buttons, accent text and backgrounds seen in the browser and the
   colors of the company's logo and favicon.
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import io
import json
import os
import re
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

from PIL import Image, ImageStat

from clean_icons import measure as measure_icon, verdict as icon_verdict

Image.MAX_IMAGE_PIXELS = 400_000_000

ROOT = Path(__file__).resolve().parent
COMPONENTS_JSON = ROOT / "components.json"
LAYOUTS_JSON = ROOT / "layouts.json"
MANIFEST_JSON = ROOT / "manifest.json"
HISTORY_JSON = ROOT / "history.json"
ANALYSIS_JSON = ROOT / "analysis.json"
BRAND_COLORS_JSON = ROOT / "brand_colors.json"
PARTS_JSON = ROOT / "parts.json"
SITE_JSON = ROOT / "site.json"

ROW_FIELDS = ("company", "slug", "category", "sub", "region", "page_title", "page_url", "requested_url", "collection_status")
ASSET_FIELDS = ("type", "path", "source_url", "width", "height", "bytes", "sha256", "source_sha256", "variant", "dhash")
LAYOUT_FIELDS = ("category", "slug", "device", "path", "page_url", "width", "height", "viewport_width", "truncated", "bytes", "sha256", "captured_at")
REGION_FIELDS = ("kind", "label", "box", "thumb", "sha256", "dhash", "width", "height")
ITEM_FIELDS = ("kind", "label", "path", "width", "height", "bytes", "sha256", "dhash", "thumb", "style", "area", "background", "source_type")


def pick(record: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    return {key: record[key] for key in fields if record.get(key) not in (None, "", [], {})}


def slim_row(row: dict[str, Any]) -> dict[str, Any]:
    slim = pick(row, ROW_FIELDS)
    assets = row.get("assets") or []
    if not assets:
        # Rows from the first collector only list their favicon and OG image as fields.
        for kind, prefix in (("favicon", "favicon"), ("social", "og")):
            if row.get(f"{prefix}_path"):
                assets.append({"type": kind, "path": row[f"{prefix}_path"], "source_url": row.get(f"{prefix}_source_url", ""),
                               "source_tag": row.get(f"{prefix}_source_tag", ""), "sha256": row.get(f"{prefix}_sha256", "")})
    slim_assets = []
    for asset in assets:
        entry = pick(asset, ASSET_FIELDS)
        # The page only needs to know whether a favicon is an apple-touch icon.
        if "apple-touch" in str(asset.get("source_tag", "")):
            entry["source_tag"] = "apple-touch-icon"
        pages = asset.get("source_pages") or []
        if pages:
            entry["source_pages"] = pages[:1]
        slim_assets.append(entry)
    slim["assets"] = slim_assets
    return slim


def slim_entry(entry: dict[str, Any]) -> dict[str, Any]:
    slim = pick(entry, ("category", "slug", "device", "page_url", "collected_at", "layout", "pixel_ratio"))
    slim["regions"] = [pick(region, REGION_FIELDS) for region in entry.get("regions", [])]
    slim["items"] = [pick(item, ITEM_FIELDS) for item in entry.get("items", [])]
    return slim
THUMBS = ROOT / "thumbs"

THUMB_WIDTH = 480
THUMB_QUALITY = 58
# Keep in step with needsThumb() in app.js.
THUMB_MIN_WIDTH = 640
THUMB_MIN_HEIGHT = 1280
VIEWPORT_HEIGHT = {"pc": 900, "mobile": 844}
LAYOUT_ASPECT = {"pc": 1.1, "mobile": 1.7}
PART_ASPECT = 2.0


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def dhash(image: Image.Image) -> str:
    gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | int(pixels[y * 9 + x] > pixels[y * 9 + x + 1])
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    if not a or not b:
        return 64
    return (int(a, 16) ^ int(b, 16)).bit_count()


def is_blank(image: Image.Image, share: float = 0.985) -> bool:
    small = image.convert("RGB")
    small.thumbnail((160, 160))
    if ImageStat.Stat(small.convert("L")).stddev[0] < 3.5:
        return True
    colors = small.getcolors(small.width * small.height) or []
    return bool(colors) and max(colors)[0] / (small.width * small.height) > share


def save_thumb(image: Image.Image, target: Path, max_aspect: float, quality: int = THUMB_QUALITY) -> dict[str, Any]:
    picture = image.convert("RGB")
    if picture.width > THUMB_WIDTH:
        picture = picture.resize((THUMB_WIDTH, max(1, round(picture.height * THUMB_WIDTH / picture.width))), Image.Resampling.LANCZOS)
    limit = max(1, round(picture.width * max_aspect))
    if picture.height > limit:
        picture = picture.crop((0, 0, picture.width, limit))
    target.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    picture.save(buffer, "WEBP", quality=quality, method=6)
    data = buffer.getvalue()
    target.write_bytes(data)
    return {"thumb": rel(target), "thumb_width": picture.width, "thumb_height": picture.height,
            "thumb_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def thumb_path_for(relative: str) -> Path:
    return THUMBS / Path(relative).with_suffix(".webp")


def needs_thumb(relative: str, width: int, height: int) -> bool:
    if Path(relative).suffix.lower() in {".svg", ".ico", ".gif"}:
        return False
    return width > THUMB_MIN_WIDTH or height > THUMB_MIN_HEIGHT


def load(path: Path, fallback: Any) -> Any:
    for _ in range(20):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return fallback
        except (OSError, ValueError):
            # A collector may be replacing the file right now.
            import time
            time.sleep(0.3)
    return fallback


def write_atomic(path: Path, text: str) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(text, encoding="utf-8")
    os.replace(temp, path)


# ---------- workers (child processes) ----------

WALL_RE = re.compile(
    r"just a moment|attention required|access denied|verify you are human|are you a robot|checking your browser|"
    r"pardon our interruption|request unsuccessful|you have been blocked|unusual traffic|security check|captcha|"
    r"^(403|404|500|502|503)\b|forbidden|not found|service unavailable|bad gateway",
    re.I,
)


def is_wall(entry: dict[str, Any]) -> bool:
    """A capture of a bot wall or error page (judged from the page title)."""
    title = str((entry.get("meta") or {}).get("title") or "")
    return bool(title and WALL_RE.search(title))


def process_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Thumbnails and hashes for one page (company + device) of components.json."""
    if is_wall(entry):
        return {"slug": entry["slug"], "device": entry["device"], "regions": [], "items": [], "blank": 0, "missing": 0, "wall": True}
    try:
        return _process_entry(entry)
    except Exception as exc:
        print(f"  skipped {entry.get('slug')} {entry.get('device')}: {type(exc).__name__}: {exc}")
        return {"slug": entry["slug"], "device": entry["device"], "regions": [], "items": [], "blank": 0, "missing": 1}


def _process_entry(entry: dict[str, Any]) -> dict[str, Any]:
    result = {"slug": entry["slug"], "device": entry["device"], "regions": [], "items": [], "blank": 0, "missing": 0}
    layout = ROOT / str(entry.get("layout", ""))
    base = THUMBS / "regions" / entry["category"] / entry["slug"]
    if layout.is_file() and entry.get("regions"):
        with Image.open(layout) as source:
            source.load()
            full = source.convert("RGB")
        counters: dict[str, int] = defaultdict(int)
        for region in entry["regions"]:
            x, y, w, h = region["box"]
            if w < 8 or h < 8 or x + w > full.width + 2 or y + h > full.height + 2:
                result["missing"] += 1
                continue
            crop = full.crop((x, y, min(full.width, x + w), min(full.height, y + h)))
            if is_blank(crop):
                result["blank"] += 1
                continue
            counters[region["kind"]] += 1
            name = f"{entry['device']}-{region['kind']}-{counters[region['kind']]:02d}.webp"
            info = save_thumb(crop, base / name, PART_ASPECT, quality=THUMB_QUALITY if w > THUMB_WIDTH else 72)
            result["regions"].append({**region, **info, "dhash": dhash(crop)})
    for item in entry.get("items", []):
        path = ROOT / item["path"]
        if not path.is_file():
            result["missing"] += 1
            continue
        try:
            done = _process_item(item, path, result)
        except Exception:
            result["missing"] += 1
            continue
        if done:
            result["items"].append(done)
    return result


def _process_item(item: dict[str, Any], path: Path, result: dict[str, Any]) -> dict[str, Any] | None:
    if item["kind"] == "icon":
        # Icon crops use the same rules as clean_icons.py (photos, empty boxes).
        reason = icon_verdict({"width": item.get("width") or 1, "height": item.get("height") or 1, "bytes": item.get("bytes") or 0}, measure_icon(path))
        if reason:
            result["blank"] += 1
            path.unlink(missing_ok=True)
            return None
        return item
    with Image.open(path) as source:
        source.load()
        picture = source.convert("RGB")
    # A button crop with no visible label or edge was taken while it was hidden.
    if is_blank(picture, 0.992 if item["kind"] == "button" else 0.985):
        result["blank"] += 1
        path.unlink(missing_ok=True)
        return None
    updated = {**item, "dhash": dhash(picture)}
    if needs_thumb(item["path"], picture.width, picture.height):
        info = save_thumb(picture, thumb_path_for(item["path"]), PART_ASPECT)
        updated["thumb"] = info["thumb"]
    return updated


def process_layout(layout: dict[str, Any]) -> dict[str, Any]:
    try:
        return _process_layout(layout)
    except Exception:
        return {"path": layout["path"], "missing": True}


def _process_layout(layout: dict[str, Any]) -> dict[str, Any]:
    path = ROOT / layout["path"]
    if not path.is_file():
        return {"path": layout["path"], "missing": True}
    with Image.open(path) as source:
        source.load()
        full = source.convert("RGB")
    ratio = full.width / max(1, int(layout.get("viewport_width") or full.width))
    first = full.crop((0, 0, full.width, min(full.height, round(VIEWPORT_HEIGHT.get(layout["device"], 900) * ratio))))
    target = thumb_path_for(layout["path"])
    if not target.is_file() or target.stat().st_mtime < path.stat().st_mtime:
        save_thumb(full, target, LAYOUT_ASPECT.get(layout["device"], 1.1))
    return {"path": layout["path"], "first_dhash": dhash(first), "blank": is_blank(first), "height": full.height}


def process_asset(job: tuple[str, int, int]) -> str | None:
    relative, width, height = job
    path = ROOT / relative
    target = thumb_path_for(relative)
    try:
        if target.is_file() and target.stat().st_mtime >= path.stat().st_mtime:
            return rel(target)
    except OSError:
        return None
    try:
        with Image.open(path) as source:
            source.seek(0)
            source.load()
            picture = source.convert("RGB")
    except Exception:
        return None
    save_thumb(picture, target, PART_ASPECT)
    return rel(target)


# ---------- brand colors ----------

def hex_rgb(value: str) -> tuple[int, int, int]:
    return int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)


def to_lab(value: str) -> tuple[float, float, float]:
    def linear(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (linear(c) for c in hex_rgb(value))
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def delta(a: str, b: str) -> float:
    la, lb = to_lab(a), to_lab(b)
    return sum((p - q) ** 2 for p, q in zip(la, lb)) ** 0.5


def chroma(value: str) -> float:
    r, g, b = (c / 255 for c in hex_rgb(value))
    return max(r, g, b) - min(r, g, b)


def valid_hex(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 7 and value.startswith("#")


SOURCE_LABELS = {
    "var": "CSS 변수", "theme": "theme-color", "button": "버튼", "accent": "강조 글자",
    "background": "배경", "link": "링크", "logo": "로고", "favicon": "파비콘",
}


def brand_palette(entries: list[dict[str, Any]], marks: list[tuple[str, list[list[Any]]]]) -> dict[str, Any] | None:
    votes: list[tuple[str, float, str]] = []

    def share(pairs: list[list[Any]], weight: float, source: str) -> None:
        pairs = [pair for pair in pairs or [] if valid_hex(pair[0])]
        total = sum(float(pair[1]) for pair in pairs) or 1
        for hex_value, amount in pairs:
            votes.append((hex_value.lower(), weight * float(amount) / total, source))

    neutrals: list[str] = []
    for entry in entries:
        colors = entry.get("colors") or {}
        for name, hex_value in colors.get("vars", []):
            if not valid_hex(hex_value):
                continue
            strong = any(word in name.lower() for word in ("primary", "brand", "main", "point", "key", "signature", "theme"))
            votes.append((hex_value.lower(), 2.4 if strong else 0.8, "var"))
        if valid_hex(colors.get("theme")):
            votes.append((colors["theme"].lower(), 2.5, "theme"))
        share(colors.get("buttons"), 5.0, "button")
        share(colors.get("accents"), 3.0, "accent")
        share(colors.get("backgrounds"), 2.5, "background")
        share(colors.get("links"), 1.2, "link")
        for key in ("text", "header_bg", "footer_bg", "bg"):
            if valid_hex(colors.get(key)):
                neutrals.append(colors[key].lower())
    for source, palette in marks:
        share([pair for pair in palette if valid_hex(pair[0])], 5.0 if source == "logo" else 2.5, source)

    clusters: list[dict[str, Any]] = []
    for hex_value, weight, source in sorted(votes, key=lambda vote: -vote[1]):
        if weight <= 0:
            continue
        for cluster in clusters:
            if delta(cluster["hex"], hex_value) < 11:
                cluster["weight"] += weight
                cluster["sources"].add(source)
                break
        else:
            clusters.append({"hex": hex_value, "weight": weight, "sources": {source}})
    if not clusters and not neutrals:
        return None
    for cluster in clusters:
        # Colors confirmed by more than one kind of evidence are the brand's own.
        cluster["score"] = cluster["weight"] * (1 + 0.35 * (len(cluster["sources"]) - 1))
    chromatic = sorted((c for c in clusters if chroma(c["hex"]) >= 0.2), key=lambda c: -c["score"])
    picked: list[dict[str, Any]] = []
    for cluster in chromatic:
        if all(delta(cluster["hex"], other["hex"]) >= 16 for other in picked):
            picked.append(cluster)
        if len(picked) >= 6:
            break
    neutral_pool = [c["hex"] for c in sorted(clusters, key=lambda c: -c["score"]) if chroma(c["hex"]) < 0.2] + neutrals
    neutral_list: list[str] = []
    for value in neutral_pool:
        if all(delta(value, other) >= 8 for other in neutral_list):
            neutral_list.append(value)
        if len(neutral_list) >= 5:
            break

    def swatch(cluster: dict[str, Any]) -> dict[str, Any]:
        return {"hex": cluster["hex"], "score": round(cluster["score"], 2), "sources": [SOURCE_LABELS[s] for s in sorted(cluster["sources"])]}

    total = sum(c["score"] for c in picked) or 1
    return {
        "primary": swatch(picked[0]) if picked else None,
        "secondary": swatch(picked[1]) if len(picked) > 1 and picked[1]["score"] >= total * 0.08 else None,
        "accents": [swatch(c) for c in picked[2:] if c["score"] >= total * 0.04],
        "neutrals": neutral_list,
        # A lone CSS variable is often a framework default (#007aff, #0d6efd), not the brand.
        "monochrome": not picked or picked[0]["score"] < 1.2 or picked[0]["sources"] == {"var"},
    }


def build_brand_colors(components: list[dict[str, Any]], manifest: list[dict[str, Any]], analysis: dict[str, Any]) -> dict[str, Any]:
    by_slug: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in components:
        by_slug[entry["slug"]].append(entry)
    result: dict[str, Any] = {}
    for row in manifest:
        marks: list[tuple[str, list[list[Any]]]] = []
        for asset in row.get("assets", []):
            kind = asset.get("type")
            if kind not in {"logo", "favicon"}:
                continue
            palette = (analysis.get(str(asset.get("sha256"))) or {}).get("p") or []
            if palette:
                marks.append((kind, palette))
        marks = [m for m in marks if m[0] == "favicon"][:1] + [m for m in marks if m[0] == "logo"][:3]
        palette = brand_palette(by_slug.get(row["slug"], []), marks)
        if palette:
            result[row["slug"]] = palette
    return result


# ---------- main ----------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) - 2))
    parser.add_argument("--skip-assets", action="store_true", help="Do not make thumbnails for manifest images.")
    args = parser.parse_args()

    started = __import__("time").time()
    components = load(COMPONENTS_JSON, [])
    layouts = load(LAYOUTS_JSON, [])
    manifest = load(MANIFEST_JSON, [])
    history = load(HISTORY_JSON, [])
    analysis = load(ANALYSIS_JSON, {})
    expected_thumbs: set[str] = set()

    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        # 1. page parts
        processed = list(pool.map(process_entry, components, chunksize=2))
        blank = sum(item["blank"] for item in processed)
        walls = {(item["slug"], item["device"]) for item in processed if item.get("wall")}
        wall_layouts = {entry.get("layout") for entry in components if (entry["slug"], entry["device"]) in walls}
        for entry in components:
            if (entry["slug"], entry["device"]) in walls:
                # Nothing from a bot wall is worth keeping on disk.
                for item in entry.get("items", []):
                    (ROOT / item["path"]).unlink(missing_ok=True)
                (ROOT / str(entry.get("layout", ""))).unlink(missing_ok=True)
        components = [entry for entry in components if (entry["slug"], entry["device"]) not in walls]
        layouts = [layout for layout in layouts if layout.get("path") not in wall_layouts]
        print(f"bot walls and error pages left out: {len(walls)}")
        by_page = {(item["slug"], item["device"]): item for item in processed}
        for entry in components:
            done = by_page.get((entry["slug"], entry["device"]))
            if done:
                entry["regions"] = done["regions"]
                entry["items"] = done["items"]

        # Near duplicates inside one company (e.g. the same card twice, a part
        # that looks the same on PC and mobile) and exact copies across companies.
        dropped_near = dropped_exact = 0
        seen_global: set[str] = set()
        by_company: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for entry in components:
            by_company[entry["slug"]].append(entry)
        for slug, entries in by_company.items():
            entries.sort(key=lambda e: 0 if e["device"] == "pc" else 1)
            kept_by_kind: dict[str, list[tuple[str, float]]] = defaultdict(list)
            for entry in entries:
                for key in ("regions", "items"):
                    survivors = []
                    for part in entry[key]:
                        sha = part.get("sha256", "")
                        if sha and sha in seen_global:
                            dropped_exact += 1
                            if key == "items":
                                (ROOT / part["path"]).unlink(missing_ok=True)
                            continue
                        ratio = (part.get("width") or 1) / max(1, part.get("height") or 1)
                        group = kept_by_kind[part["kind"]]
                        if part["kind"] not in {"button", "icon"} and any(hamming(part.get("dhash", ""), other) <= 4 and abs(ratio - other_ratio) <= max(0.06, other_ratio * 0.06) for other, other_ratio in group):
                            dropped_near += 1
                            if key == "items":
                                (ROOT / part["path"]).unlink(missing_ok=True)
                            continue
                        group.append((part.get("dhash", ""), ratio))
                        if sha:
                            seen_global.add(sha)
                        survivors.append(part)
                    entry[key] = survivors
            for entry in entries:
                for part in entry["regions"]:
                    expected_thumbs.add(part["thumb"])
                for part in entry["items"]:
                    if part.get("thumb"):
                        expected_thumbs.add(part["thumb"])
        print(f"parts: blank={blank} near-duplicates={dropped_near} exact-copies={dropped_exact}")

        # 2. full-page captures: thumbnails, and old captures identical to the newest
        results = {item["path"]: item for item in pool.map(process_layout, layouts, chunksize=4)}
        grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for layout in layouts:
            info = results.get(layout["path"], {})
            if info.get("missing"):
                continue
            layout["first_dhash"] = info.get("first_dhash", "")
            grouped[(layout["slug"], layout["device"])].append(layout)
        kept_layouts = []
        removed_layouts = 0
        in_use = {entry.get("layout") for entry in load(COMPONENTS_JSON, [])} | {entry.get("layout") for entry in components}
        for (_, _), captures in grouped.items():
            captures.sort(key=lambda item: str(item.get("captured_at", "")), reverse=True)
            newest = captures[0]
            kept_layouts.append(newest)
            for older in captures[1:]:
                # The same first screen means the same design; the newest capture
                # is the more complete one, so the older copy is not kept.
                same = hamming(older.get("first_dhash", ""), newest.get("first_dhash", "")) <= 8
                blank_old = results.get(older["path"], {}).get("blank")
                if (same or blank_old) and older["path"] not in in_use and older.get("source") != "components":
                    # Only captures made by the old capture script are removed; the
                    # layouts.json entry stays and is skipped once its file is gone.
                    (ROOT / older["path"]).unlink(missing_ok=True)
                    thumb_path_for(older["path"]).unlink(missing_ok=True)
                    removed_layouts += 1
                else:
                    kept_layouts.append(older)
        kept_layouts.sort(key=lambda a: (a["category"], a["slug"], str(a.get("captured_at", ""))))
        for layout in kept_layouts:
            expected_thumbs.add(rel(thumb_path_for(layout["path"])))
        print(f"layouts: kept={len(kept_layouts)} removed-duplicates={removed_layouts}")

        # 3. thumbnails for large manifest and history images
        if not args.skip_assets:
            jobs: dict[str, tuple[str, int, int]] = {}
            for row in manifest:
                for asset in row.get("assets", []):
                    path = str(asset.get("path", ""))
                    if path and (ROOT / path).is_file() and needs_thumb(path, int(asset.get("width") or 0), int(asset.get("height") or 0)):
                        jobs[path] = (path, int(asset.get("width") or 0), int(asset.get("height") or 0))
            for company in history:
                for asset in company.get("entries", []):
                    path = str(asset.get("path", ""))
                    if path and (ROOT / path).is_file() and needs_thumb(path, int(asset.get("width") or 0), int(asset.get("height") or 0)):
                        jobs[path] = (path, int(asset.get("width") or 0), int(asset.get("height") or 0))
            made = [thumb for thumb in pool.map(process_asset, jobs.values(), chunksize=8) if thumb]
            expected_thumbs.update(made)
            print(f"asset thumbnails: {len(made)}")
        else:
            expected_thumbs.update(rel(p) for p in THUMBS.glob("assets/**/*.webp"))
            expected_thumbs.update(rel(p) for p in THUMBS.glob("history/**/*.webp"))

    # Thumbnails nobody points at any more.
    orphans = 0
    if THUMBS.is_dir():
        for path in THUMBS.rglob("*.webp"):
            if rel(path) not in expected_thumbs:
                path.unlink(missing_ok=True)
                orphans += 1
    print(f"orphan thumbnails removed: {orphans}")

    # Component files that no collected page points at any more. The raw list is
    # read again so files a running collector just wrote are not touched.
    raw = load(COMPONENTS_JSON, [])
    referenced = {item["path"] for entry in raw for item in entry.get("items", [])}
    stale = 0
    components_dir = ROOT / "components"
    if components_dir.is_dir():
        for path in [*components_dir.rglob("*.webp"), *components_dir.rglob("*.png")]:
            if rel(path) not in referenced and path.stat().st_mtime < started - 600:
                path.unlink(missing_ok=True)
                stale += 1
    print(f"unreferenced component files removed: {stale}")

    write_atomic(PARTS_JSON, json.dumps({"layouts": kept_layouts, "entries": components}, ensure_ascii=False, separators=(",", ":")))
    site = {
        "rows": [slim_row(row) for row in manifest],
        "layouts": [pick(layout, LAYOUT_FIELDS) for layout in kept_layouts],
        "entries": [slim_entry(entry) for entry in components],
    }
    write_atomic(SITE_JSON, json.dumps(site, ensure_ascii=False, separators=(",", ":")))
    print(f"site.json: {SITE_JSON.stat().st_size / 1048576:.1f}MB")

    # 4. brand colors
    colors = build_brand_colors(components, manifest, analysis)
    write_atomic(BRAND_COLORS_JSON, json.dumps(colors, ensure_ascii=False, separators=(",", ":")))
    print(f"brand colors: {len(colors)} companies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
