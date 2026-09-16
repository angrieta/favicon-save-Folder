"""Extract design attributes for every image so the web library can filter by color and tone.

Writes ``analysis.json`` keyed by the image file's sha256:

    {"<sha256>": {"p": [["#1f2a44", 0.41], ...], "l": 0.52, "c": 0.18, "a": 0, "g": 1}}

p = dominant colors with coverage, l = mean luminance (0-1), c = colorfulness (0-1),
a = has transparent background, g = flat graphic rather than photo.

Only new hashes are analyzed, so rerun it after collecting or capturing layouts:

    python analyze_assets.py
"""

from __future__ import annotations

import argparse
import colorsys
import json
import re
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "analysis.json"
SOURCES = ("manifest.json", "layouts.json", "history.json")

HEX_RE = re.compile(r"#([0-9a-f]{6}|[0-9a-f]{3})\b", re.I)
RGB_RE = re.compile(r"rgba?\(\s*(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})", re.I)
NAMED = {"white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0), "blue": (0, 0, 255), "green": (0, 128, 0)}
NAMED_RE = re.compile(r"(?:fill|stroke|stop-color)\s*[:=]\s*['\"]?(white|black|red|blue|green)\b", re.I)


def to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def merge_palette(weighted: list[tuple[float, tuple[int, int, int]]], limit: int = 6) -> list[list[Any]]:
    merged: list[list[Any]] = []
    for weight, rgb in sorted(weighted, reverse=True):
        for item in merged:
            other = item[1]
            if sum((a - b) ** 2 for a, b in zip(rgb, other)) < 26 ** 2:
                item[0] += weight
                break
        else:
            merged.append([weight, rgb])
    merged.sort(key=lambda item: item[0], reverse=True)
    return [[to_hex(rgb), round(weight, 3)] for weight, rgb in merged[:limit] if weight >= 0.02]


def palette_stats(palette: list[list[Any]]) -> tuple[float, float]:
    total = sum(weight for _, weight in palette) or 1
    luma = chroma = 0.0
    for hex_value, weight in palette:
        r, g, b = (int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5))
        _, saturation, value = colorsys.rgb_to_hsv(r, g, b)
        luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) * weight
        chroma += saturation * value * weight
    return luma / total, chroma / total


def analyze_svg(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="ignore")[:400_000]
    counts: Counter[tuple[int, int, int]] = Counter()
    for match in HEX_RE.finditer(text):
        value = match.group(1)
        if len(value) == 3:
            value = "".join(ch * 2 for ch in value)
        counts[tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))] += 1
    for match in RGB_RE.finditer(text):
        counts[tuple(min(255, int(match.group(i))) for i in (1, 2, 3))] += 1
    for match in NAMED_RE.finditer(text):
        counts[NAMED[match.group(1).lower()]] += 1
    if not counts:
        counts[(0, 0, 0)] = 1  # SVG default fill
    total = sum(counts.values())
    palette = merge_palette([(count / total, rgb) for rgb, count in counts.items()])
    luma, chroma = palette_stats(palette)
    return {"p": palette, "l": round(luma, 3), "c": round(chroma, 3), "a": 1, "g": 1}


def analyze_raster(path: Path) -> dict[str, Any]:
    with Image.open(path) as source:
        source.seek(0)
        image = source.convert("RGBA")
    image.thumbnail((128, 128))
    pixels = list(image.getdata())
    opaque = [pixel[:3] for pixel in pixels if pixel[3] >= 160]
    transparent_ratio = 1 - len(opaque) / max(1, len(pixels))
    if not opaque:
        return {"p": [], "l": 0.5, "c": 0, "a": 1, "g": 1}

    strip = Image.new("RGB", (len(opaque), 1))
    strip.putdata(opaque)
    quantized = strip.quantize(colors=16, method=Image.Quantize.MEDIANCUT)
    raw_palette = quantized.getpalette() or []
    weighted = [
        (count / len(opaque), tuple(raw_palette[index * 3:index * 3 + 3]))
        for count, index in quantized.getcolors() or []
    ]
    palette = merge_palette(weighted)

    luma = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in opaque) / len(opaque) / 255
    chroma = 0.0
    for r, g, b in opaque[:: max(1, len(opaque) // 4000)]:
        _, saturation, value = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        chroma += saturation * value
    chroma /= len(opaque[:: max(1, len(opaque) // 4000)])

    fine = strip.quantize(colors=64, method=Image.Quantize.MEDIANCUT).getcolors() or []
    top_coverage = sum(count for count, _ in sorted(fine, reverse=True)[:8]) / len(opaque)
    return {
        "p": palette,
        "l": round(luma, 3),
        "c": round(chroma, 3),
        "a": int(transparent_ratio > 0.04),
        "g": int(top_coverage >= 0.8),
    }


def analyze(job: tuple[str, str]) -> tuple[str, dict[str, Any] | None]:
    sha, relative = job
    path = ROOT / relative
    try:
        if path.suffix.lower() == ".svg":
            return sha, analyze_svg(path)
        return sha, analyze_raster(path)
    except Exception:
        return sha, None


def collect_jobs() -> dict[str, str]:
    jobs: dict[str, str] = {}

    def add(item: dict[str, Any]) -> None:
        sha, relative = item.get("sha256"), item.get("path")
        if sha and relative and (ROOT / relative).is_file():
            jobs.setdefault(str(sha), str(relative))

    for name in SOURCES:
        try:
            payload = json.loads((ROOT / name).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for entry in payload:
            if "assets" in entry:
                for asset in entry.get("assets", []):
                    add(asset)
            elif "entries" in entry:
                for asset in entry.get("entries", []):
                    add(asset)
            else:
                add(entry)
    return jobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="Analyze every image again.")
    parser.add_argument("--workers", type=int, default=0)
    args = parser.parse_args()

    try:
        results: dict[str, Any] = {} if args.force else json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        results = {}

    jobs = collect_jobs()
    pending = [(sha, path) for sha, path in jobs.items() if sha not in results]
    print(f"images={len(jobs)} cached={len(jobs) - len(pending)} pending={len(pending)}")
    failed = 0
    with ProcessPoolExecutor(max_workers=args.workers or None) as executor:
        for index, (sha, result) in enumerate(executor.map(analyze, pending, chunksize=16), start=1):
            if result is None:
                failed += 1
            else:
                results[sha] = result
            if index % 500 == 0:
                print(f"  {index}/{len(pending)}")

    live = {sha: results[sha] for sha in jobs if sha in results}
    OUTPUT.write_text(json.dumps(live, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"saved={len(live)} failed={failed} -> {OUTPUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
