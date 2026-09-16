"""Drop the crops in icons/ that are not really icons.

collect_icons.mjs cuts every icon-sized graphic out of the rendered page, so a
few photos, empty boxes and text fragments slip through. Real icons use a small
number of flat colors, so this pass measures each crop and removes the rest.

    python clean_icons.py            # clean icons.json and delete dropped files
    python clean_icons.py --dry-run  # only report what would be removed
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
ICONS_JSON = ROOT / "icons.json"


def measure(path: Path) -> dict[str, float]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
    image.thumbnail((72, 72))
    pixels = list(image.getdata())  # noqa: Pillow 14 renames this to get_flattened_data
    opaque = [pixel[:3] for pixel in pixels if pixel[3] >= 160]
    if not opaque:
        return {"blank": 1.0, "colors": 0, "top": 1.0, "ink": 0.0}

    quantized = Counter((r // 24, g // 24, b // 24) for r, g, b in opaque)
    top = quantized.most_common(1)[0][1] / len(opaque)
    top_four = sum(count for _, count in quantized.most_common(4)) / len(opaque)
    background = Counter(opaque).most_common(1)[0][0]
    ink = sum(1 for pixel in opaque if sum(abs(a - b) for a, b in zip(pixel, background)) > 60) / len(opaque)
    return {"blank": 0.0, "colors": len(quantized), "top": top, "top_four": top_four, "ink": ink}


def verdict(icon: dict, stats: dict[str, float]) -> str:
    ratio = icon["width"] / max(1, icon["height"])
    if stats["blank"] or stats["top"] >= 0.985 or stats["ink"] < 0.015:
        return "빈 이미지"
    if stats["colors"] > 48 or stats.get("top_four", 1) < 0.72:
        return "사진·복잡한 이미지"
    if ratio > 3.2 or ratio < 1 / 3.2:
        return "아이콘 비율 아님"
    if icon["bytes"] > 120_000:
        return "아이콘치고 큰 파일"
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    collections = json.loads(ICONS_JSON.read_text(encoding="utf-8"))
    removed = Counter()
    kept_total = 0

    for company in collections:
        kept = []
        for icon in company.get("icons", []):
            path = ROOT / icon["path"]
            if not path.is_file():
                continue
            reason = verdict(icon, measure(path))
            if reason:
                removed[reason] += 1
                if not args.dry_run:
                    path.unlink(missing_ok=True)
                continue
            kept.append(icon)
        kept_total += len(kept)
        company["icons"] = kept

    if not args.dry_run:
        # Renumber so file names stay tidy after deletions.
        for company in collections:
            for index, icon in enumerate(company["icons"], start=1):
                target = ROOT / icon["path"]
                wanted = target.with_name(f"icon-{index:03d}.png")
                if target != wanted:
                    if wanted.exists():
                        wanted.unlink()
                    target.rename(wanted)
                    icon["path"] = wanted.relative_to(ROOT).as_posix()
        collections = [company for company in collections if company["icons"]]
        ICONS_JSON.write_text(json.dumps(collections, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"kept={kept_total} removed={sum(removed.values())}")
    for reason, count in removed.most_common():
        print(f"  {reason}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
