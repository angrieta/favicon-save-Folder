"""Print collection counts for the README (companies, parts, buttons, colors, disk size).

    python library_stats.py
"""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PART_LABELS = {
    "page": "전체 페이지", "hero": "첫 화면", "header": "헤더", "nav": "네비게이션", "section": "섹션", "card": "카드",
    "footer": "푸터", "floating": "플로팅", "popup": "팝업", "form": "검색·폼", "tab": "탭",
}


def load(name: str, fallback):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def size_of(folder: str) -> tuple[int, int]:
    total = count = 0
    for base, _, files in os.walk(ROOT / folder):
        for name in files:
            total += os.path.getsize(os.path.join(base, name))
            count += 1
    return count, total


def main() -> int:
    manifest = load("manifest.json", [])
    components = load("components.json", [])
    layouts = load("layouts.json", [])
    icons = load("icons.json", [])
    colors = load("brand_colors.json", {})

    categories = Counter(row["category"] for row in manifest)
    assets = Counter(asset.get("type") for row in manifest for asset in row.get("assets", []))
    parts = Counter(region["kind"] for entry in components for region in entry.get("regions", []))
    parts.update(item["kind"] for entry in components for item in entry.get("items", []) if item["kind"] not in {"button", "icon"})
    parts["page"] = len(layouts)
    buttons = sum(1 for entry in components for item in entry.get("items", []) if item["kind"] == "button")
    icon_count = sum(len(entry.get("icons", [])) for entry in icons) + sum(1 for entry in components for item in entry.get("items", []) if item["kind"] == "icon")
    captured = {entry["slug"] for entry in components}

    print(f"- 회사: {len(manifest):,}개 (업종 {len(categories)}개, 브라우저로 화면을 확인한 회사 {len(captured):,}개)")
    print(f"- 레이아웃: {sum(parts.values()):,}개")
    print("  - " + ", ".join(f"{PART_LABELS[key]} {parts.get(key, 0):,}" for key in PART_LABELS))
    print(f"- 버튼: {buttons:,}개")
    print(f"- 메뉴·버튼 아이콘: {icon_count:,}개")
    print(f"- 포인트 컬러: {len(colors):,}개 회사")
    print(f"- 로고 {assets.get('logo', 0):,}개, 배너 {assets.get('banner', 0):,}개, 소셜 공유 {assets.get('social', 0):,}개, 사진·그래픽 {assets.get('reference', 0):,}개, 파비콘 {assets.get('favicon', 0):,}개")
    total_files = total_bytes = 0
    for folder in ("assets", "layouts", "components", "icons", "thumbs", "history"):
        count, size = size_of(folder)
        total_files += count
        total_bytes += size
        print(f"  - {folder}/: {count:,}개 파일, {size / 1048576:,.0f}MiB")
    print(f"- 전체 이미지 파일: {total_files:,}개, 약 {total_bytes / 1048576:,.0f}MiB")
    print()
    for category, count in sorted(categories.items(), key=lambda item: -item[1]):
        print(f"  {category.replace('_', '·')}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
