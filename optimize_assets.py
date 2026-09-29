"""Shrink the library without changing how any image looks.

Three passes, all of them safe:

1. Drop SVG web fonts. Some sites serve their icon or text fonts as .svg, and
   the collector stored the whole glyph set. They are not design references and
   they are by far the largest files here.
2. Recompress PNG files losslessly (better zlib settings, palette when the image
   has few enough colors). Every result is checked pixel by pixel and kept only
   when it is both identical and smaller.
3. Minify SVG graphics: drop comments, editor metadata and redundant space,
   keeping the markup valid.

JPEG and WebP files are left alone because re-encoding them would lose quality,
unless --lossy is given:

4. (--lossy) Banners, photos and social images larger than 120KB are scaled to
   at most 1600px wide and re-encoded in the same format (WebP quality 74,
   JPEG quality 80). A file is replaced only when it gets at least 15% smaller.
   Logos and icons are never touched.

Every record that points at a changed file (manifest.json, each company's
source.json, layouts.json, icons.json, history.json and analysis.json) is
updated with the new size and hash.

    python optimize_assets.py --dry-run
    python optimize_assets.py
    python optimize_assets.py --lossy
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent
DATA_FILES = ("manifest.json", "layouts.json", "icons.json", "history.json")
FONT_MARKERS = ("<font", "<glyph", "font-face", "fontforge")
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
METADATA_RE = re.compile(r"<metadata\b.*?</metadata>", re.S | re.I)
DOCTYPE_RE = re.compile(r"<!DOCTYPE[^>]*>", re.I)
SPACE_BETWEEN_TAGS_RE = re.compile(r">\s+<")
LONG_SPACE_RE = re.compile(r"[ \t\r\n]{2,}")


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_svg_font(text: str) -> bool:
    head = text[:4000].lower()
    return any(marker in head for marker in FONT_MARKERS)


def optimize_png(path: Path) -> bytes | None:
    """Return smaller PNG bytes that decode to exactly the same pixels."""
    original = path.read_bytes()
    with Image.open(io.BytesIO(original)) as source:
        source.load()
        reference = source.convert("RGBA")
    candidates: list[bytes] = []

    for image in (reference, reference.convert("RGB") if reference.getextrema()[3][0] == 255 else None):
        if image is None:
            continue
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True, compress_level=9)
        candidates.append(buffer.getvalue())

    colors = reference.getcolors(256)
    if colors:
        palette = reference.convert("P", palette=Image.Palette.ADAPTIVE, colors=max(2, len(colors)))
        buffer = io.BytesIO()
        palette.save(buffer, format="PNG", optimize=True, compress_level=9)
        candidates.append(buffer.getvalue())

    best = min((data for data in candidates if data), key=len, default=None)
    if not best or len(best) >= len(original):
        return None
    with Image.open(io.BytesIO(best)) as check:
        if check.convert("RGBA").tobytes() != reference.tobytes():
            return None
    return best


LOSSY_NAME = ("banner-", "reference-", "social-", "og.")
LOSSY_MAX_WIDTH = 1600
LOSSY_MAX_HEIGHT = 2400


def shrink_lossy(path: Path) -> tuple[bytes, int, int] | None:
    """Return smaller bytes in the same format, with the new size, or None."""
    original = path.read_bytes()
    if len(original) < 120_000:
        return None
    with Image.open(io.BytesIO(original)) as source:
        source.load()
        if getattr(source, "n_frames", 1) > 1:
            return None
        image = source.convert("RGB")
    image.thumbnail((LOSSY_MAX_WIDTH, LOSSY_MAX_HEIGHT), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    if path.suffix.lower() == ".webp":
        image.save(buffer, "WEBP", quality=74, method=6)
    else:
        image.save(buffer, "JPEG", quality=80, optimize=True, progressive=True)
    data = buffer.getvalue()
    if len(data) > len(original) * 0.85:
        return None
    return data, image.width, image.height


def optimize_svg(path: Path) -> bytes | None:
    original = path.read_bytes()
    text = original.decode("utf-8", "ignore")
    slim = COMMENT_RE.sub("", text)
    slim = METADATA_RE.sub("", slim)
    slim = DOCTYPE_RE.sub("", slim)
    slim = SPACE_BETWEEN_TAGS_RE.sub("><", slim)
    slim = LONG_SPACE_RE.sub(" ", slim).strip()
    data = slim.encode("utf-8")
    if len(data) >= len(original):
        return None
    try:
        ElementTree.fromstring(slim)
    except ElementTree.ParseError:
        return None
    return data


def load_json(name: str) -> Any:
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def walk_assets(payload: Any):
    """Yield every asset-like record in one of the data files."""
    if not isinstance(payload, list):
        return
    for entry in payload:
        for key in ("assets", "entries", "icons"):
            if isinstance(entry.get(key), list):
                yield from entry[key]
                break
        else:
            yield entry


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-fonts", action="store_true", help="Keep SVG web fonts.")
    parser.add_argument("--lossy", action="store_true", help="Also shrink large banners, photos and social images.")
    args = parser.parse_args()
    sizes: dict[str, tuple[int, int]] = {}

    dropped: set[str] = set()
    changed: dict[str, tuple[str, int]] = {}
    saved = 0

    # Pass 1: SVG web fonts.
    font_bytes = 0
    if not args.skip_fonts:
        for path in sorted(ROOT.glob("assets/*/*/*.svg")):
            text = path.read_text(encoding="utf-8", errors="ignore")
            if not is_svg_font(text):
                continue
            font_bytes += path.stat().st_size
            dropped.add(path.relative_to(ROOT).as_posix())
            if not args.dry_run:
                path.unlink()
        print(f"SVG 웹폰트 제거: {len(dropped)}개, {font_bytes / 1048576:.1f}MB")
        saved += font_bytes

    # Pass 2 and 3: lossless recompression.
    targets = [path for pattern in ("assets/*/*/*.png", "icons/*/*/*.png", "assets/*/*/*.svg") for path in sorted(ROOT.glob(pattern))]
    png_saved = svg_saved = 0
    png_count = svg_count = 0
    for path in targets:
        relative = path.relative_to(ROOT).as_posix()
        if relative in dropped or not path.is_file():
            continue
        before = path.stat().st_size
        try:
            data = optimize_png(path) if path.suffix == ".png" else optimize_svg(path)
        except Exception:
            data = None
        if not data:
            continue
        gain = before - len(data)
        if path.suffix == ".png":
            png_saved += gain
            png_count += 1
        else:
            svg_saved += gain
            svg_count += 1
        changed[relative] = (sha256_of(data), len(data))
        if not args.dry_run:
            path.write_bytes(data)
    print(f"PNG 무손실 재압축: {png_count}개, {png_saved / 1048576:.1f}MB 절약")
    print(f"SVG 정리: {svg_count}개, {svg_saved / 1048576:.1f}MB 절약")
    saved += png_saved + svg_saved

    # Pass 4: lossy shrinking of large photos (opt-in).
    if args.lossy:
        lossy_saved = lossy_count = 0
        candidates = [
            path for pattern in ("assets/*/*/*.webp", "assets/*/*/*.jpg", "assets/*/*/*.jpeg")
            for path in sorted(ROOT.glob(pattern)) if path.name.lower().startswith(LOSSY_NAME)
        ]
        for path in candidates:
            relative = path.relative_to(ROOT).as_posix()
            before = path.stat().st_size
            try:
                result = shrink_lossy(path)
            except Exception:
                result = None
            if not result:
                continue
            data, width, height = result
            lossy_saved += before - len(data)
            lossy_count += 1
            changed[relative] = (sha256_of(data), len(data))
            sizes[relative] = (width, height)
            if not args.dry_run:
                path.write_bytes(data)
        print(f"사진·배너 손실 압축: {lossy_count}개, {lossy_saved / 1048576:.1f}MB 절약")
        saved += lossy_saved

    if args.dry_run:
        print(f"합계 {saved / 1048576:.1f}MB 절약 예정 (변경 없음)")
        return 0

    # Update every record that points at a file we touched.
    remap: dict[str, str] = {}
    for name in DATA_FILES:
        payload = load_json(name)
        if payload is None:
            continue
        touched = False
        for asset in walk_assets(payload):
            relative = str(asset.get("path", ""))
            if relative in dropped or relative in changed:
                touched = True
            if relative in dropped:
                asset["__drop__"] = True
            elif relative in changed:
                new_hash, size = changed[relative]
                old_hash = str(asset.get("sha256", ""))
                if old_hash and old_hash != new_hash:
                    remap[old_hash] = new_hash
                    # The web page keys favorites by source_sha256 first; keep that key stable.
                    asset.setdefault("source_sha256", old_hash)
                asset["sha256"] = new_hash
                asset["bytes"] = size
                if relative in sizes:
                    asset["width"], asset["height"] = sizes[relative]
        if isinstance(payload, list):
            for entry in payload:
                for key in ("assets", "entries", "icons"):
                    if isinstance(entry.get(key), list):
                        entry[key] = [asset for asset in entry[key] if not asset.pop("__drop__", False)]
            payload = [entry for entry in payload if not entry.pop("__drop__", False)]
        # Files nothing changed in are left alone (a collector may be writing them).
        if touched:
            (ROOT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Keep each company's own source.json in step with the manifest.
    manifest = load_json("manifest.json") or []
    for row in manifest:
        source_path = ROOT / "assets" / str(row.get("category")) / str(row.get("slug")) / "source.json"
        if not source_path.is_file():
            continue
        try:
            payload = json.loads(source_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        payload["assets"] = row.get("assets", [])
        source_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Counters in the manifest follow the assets that remain.
    for row in manifest:
        assets = row.get("assets", [])
        for kind in ("logo", "banner", "reference", "social"):
            key = f"{kind}_count"
            if key in row:
                row[key] = sum(asset.get("type") == kind for asset in assets)
        if "asset_count" in row:
            row["asset_count"] = len(assets)
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    analysis = load_json("analysis.json") or {}
    for old_hash, new_hash in remap.items():
        if old_hash in analysis:
            analysis[new_hash] = analysis.pop(old_hash)
    (ROOT / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"합계 {saved / 1048576:.1f}MB 절약, 기록 {len(changed)}건 갱신, 삭제 {len(dropped)}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
