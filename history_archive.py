"""Keep banners, logos and social images that disappear between collection runs.

Collectors overwrite files such as ``banner-1.webp`` in place, so the previous
files are copied aside before a company is collected. After the new asset list
is known, anything that is no longer used is moved into ``history/`` and listed
in ``history.json`` so the web library can show how a brand changed over time.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
HISTORY_DIR = ROOT / "history"
STAGING_DIR = HISTORY_DIR / ".staging"
HISTORY_JSON = ROOT / "history.json"
ARCHIVE_TYPES = {"banner", "logo", "social"}


def _company_parts(row: dict[str, Any]) -> tuple[str, str]:
    return str(row["category"]), str(row["slug"])


def stage_previous(row: dict[str, Any]) -> list[dict[str, Any]]:
    """Copy the company's current archivable files aside before they are overwritten."""
    category, slug = _company_parts(row)
    stage = STAGING_DIR / category / slug
    shutil.rmtree(stage, ignore_errors=True)
    staged: list[dict[str, Any]] = []
    for asset in row.get("assets", []) or []:
        if asset.get("type") not in ARCHIVE_TYPES or not asset.get("sha256"):
            continue
        source = ROOT / str(asset.get("path", ""))
        if not source.is_file():
            continue
        stage.mkdir(parents=True, exist_ok=True)
        target = stage / f"{len(staged):03d}-{source.name}"
        shutil.copy2(source, target)
        staged.append({**asset, "_staged": str(target)})
    return staged


def archive_replaced(row: dict[str, Any], staged: list[dict[str, Any]], new_assets: list[dict[str, Any]]) -> int:
    """Move staged files that are no longer part of the company into history/."""
    category, slug = _company_parts(row)
    stage = STAGING_DIR / category / slug
    company_dir = HISTORY_DIR / category / slug
    index_path = company_dir / "history.json"
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        payload = {}
    entries: list[dict[str, Any]] = list(payload.get("entries", []))

    current = {str(asset.get(key)) for asset in new_assets for key in ("sha256", "source_sha256") if asset.get(key)}
    archived = {str(entry.get("sha256")) for entry in entries}
    now = datetime.now(timezone.utc)
    last_seen = str((row.get("crawl_stats") or {}).get("collected_at") or "")
    moved = 0

    for asset in staged:
        staged_path = Path(asset["_staged"])
        sha = str(asset.get("sha256"))
        if sha in current or sha in archived or not staged_path.is_file():
            continue
        target_dir = company_dir / now.strftime("%Y-%m-%d")
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / Path(str(asset.get("path"))).name
        suffix = 1
        while target.exists():
            target = target_dir / f"{target.stem}-{suffix}{target.suffix}"
            suffix += 1
        shutil.move(str(staged_path), target)
        entries.append({
            "type": asset.get("type"),
            "path": target.relative_to(ROOT).as_posix(),
            "source_url": asset.get("source_url", ""),
            "content_type": asset.get("content_type", ""),
            "bytes": asset.get("bytes", 0),
            "width": asset.get("width", 0),
            "height": asset.get("height", 0),
            "variant": asset.get("variant", "shared"),
            "sha256": sha,
            "last_seen_at": last_seen,
            "archived_at": now.isoformat(),
        })
        archived.add(sha)
        moved += 1

    shutil.rmtree(stage, ignore_errors=True)
    if moved:
        index_path.write_text(json.dumps({
            "company": row.get("company", ""),
            "category": category,
            "slug": slug,
            "entries": entries,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    return moved


def rebuild_history_index() -> None:
    """Combine every company history file into the root history.json used by the web page."""
    companies = []
    for index_path in sorted(HISTORY_DIR.glob("*/*/history.json")):
        try:
            payload = json.loads(index_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        entries = [entry for entry in payload.get("entries", []) if (ROOT / str(entry.get("path", ""))).is_file()]
        if entries:
            companies.append({**payload, "entries": entries})
    HISTORY_JSON.write_text(json.dumps(companies, ensure_ascii=False, indent=2), encoding="utf-8")
