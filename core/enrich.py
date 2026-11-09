"""Cache-first CVE enrichment from NVD, CISA KEV and FIRST EPSS.

Network calls are optional: cached values are used first, and offline mode is
available for deterministic demos. Raw scanner evidence is preserved.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE_DIR = ROOT / "cache"
USER_AGENT = "PatchMinCutPlanner/1.0 (educational project)"


def _read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temp.replace(path)


def _get_json(url: str, *, timeout: int = 12) -> Any:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _cached_fetch(path: Path, url: str, *, offline: bool, refresh: bool = False) -> Any | None:
    cached = _read_json(path)
    if cached is not None and not refresh:
        return cached
    if offline:
        return cached
    try:
        value = _get_json(url)
        _write_json(path, value)
        return value
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        # A stale cache is preferable to failing an offline-friendly pipeline.
        return cached


def fetch_kev(*, cache_dir: Path = DEFAULT_CACHE_DIR, offline: bool = False, refresh: bool = False) -> dict[str, Any]:
    """Fetch/cache the CISA Known Exploited Vulnerabilities catalog."""
    value = _cached_fetch(
        cache_dir / "kev" / "known_exploited_vulnerabilities.json",
        "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        offline=offline, refresh=refresh,
    )
    return value if isinstance(value, dict) else {"vulnerabilities": []}


def fetch_nvd(cve: str, *, cache_dir: Path = DEFAULT_CACHE_DIR, offline: bool = False, refresh: bool = False) -> dict[str, Any]:
    """Fetch/cache one NVD CVE API response."""
    safe = quote(cve.strip().upper(), safe="-")
    value = _cached_fetch(
        cache_dir / "nvd" / f"{safe}.json",
        f"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={safe}",
        offline=offline, refresh=refresh,
    )
    return value if isinstance(value, dict) else {}


def fetch_epss(cve: str, *, cache_dir: Path = DEFAULT_CACHE_DIR, offline: bool = False, refresh: bool = False) -> dict[str, Any]:
    """Fetch/cache one FIRST EPSS response."""
    safe = quote(cve.strip().upper(), safe="-")
    value = _cached_fetch(
        cache_dir / "epss" / f"{safe}.json",
        f"https://api.first.org/data/v1/epss?cve={safe}",
        offline=offline, refresh=refresh,
    )
    return value if isinstance(value, dict) else {"data": []}


def _extract_epss(payload: dict[str, Any]) -> float | None:
    rows = payload.get("data") or []
    if not rows:
        return None
    try:
        score = float(rows[0]["epss"])
        return score if 0 <= score <= 1 else None
    except (KeyError, TypeError, ValueError, IndexError):
        return None


def _kev_ids(payload: dict[str, Any]) -> set[str]:
    return {str(row.get("cveID", "")).upper() for row in payload.get("vulnerabilities", []) if isinstance(row, dict)}


def enrich_findings(
    findings: list[dict[str, Any]], *, cache_dir: Path = DEFAULT_CACHE_DIR,
    offline: bool = False, refresh: bool = False,
) -> list[dict[str, Any]]:
    """Return enriched copies of raw findings; never mutate/drop scanner evidence.

    Adds ``nvd``, ``epss``, ``in_kev`` and ``enrichment`` metadata. This deliberately
    does not infer a service port or remote exploitability from package evidence.
    """
    kev = fetch_kev(cache_dir=cache_dir, offline=offline, refresh=refresh)
    kev_ids = _kev_ids(kev)
    output: list[dict[str, Any]] = []
    for original in findings:
        finding = dict(original)
        cve = str(finding.get("cve", "")).strip().upper()
        if not cve.startswith("CVE-"):
            finding["enrichment"] = {"status": "skipped", "reason": "missing valid CVE identifier"}
            output.append(finding)
            continue
        nvd = fetch_nvd(cve, cache_dir=cache_dir, offline=offline, refresh=refresh)
        epss_payload = fetch_epss(cve, cache_dir=cache_dir, offline=offline, refresh=refresh)
        finding["nvd"] = nvd
        finding["epss"] = _extract_epss(epss_payload)
        finding["in_kev"] = cve in kev_ids
        finding["enrichment"] = {
            "status": "cached_or_fetched" if (nvd or epss_payload.get("data")) else "unavailable",
            "sources": ["NVD", "CISA KEV", "FIRST EPSS"],
        }
        output.append(finding)
    return output


def enrich_scan(scan: dict[str, Any], *, cache_dir: Path = DEFAULT_CACHE_DIR, offline: bool = False, refresh: bool = False) -> dict[str, Any]:
    """Return a scan document with enriched ``raw_findings``."""
    result = dict(scan)
    result["raw_findings"] = enrich_findings(
        list(scan.get("raw_findings") or []), cache_dir=cache_dir, offline=offline, refresh=refresh
    )
    return result


def prepare_findings_document(
    scan: dict[str, Any],
    reach_document: dict[str, Any],
    *,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    offline: bool = False,
    refresh: bool = False,
) -> dict[str, Any]:
    """Join P1 scan/reach documents and add P2 enrichment for P3.

    The returned findings remain scanner evidence, not Pydantic ``Finding``
    instances. In particular, image-level findings with port 0 are preserved
    as un-attributed until the Skeptic can review them.
    """
    enriched = enrich_scan(scan, cache_dir=cache_dir, offline=offline, refresh=refresh)
    return {
        "schema_version": 1,
        "lab_id": scan.get("lab_id", reach_document.get("lab_id", "unknown")),
        "assets": list(scan.get("assets") or []),
        "services": list(scan.get("services") or []),
        "findings": list(enriched.get("raw_findings") or []),
        "reach": list(reach_document.get("reach") or []),
        "stage": "awaiting_skeptic_review",
        "notes": [
            "Enriched P1 scan evidence; findings have not yet been confirmed by the Skeptic.",
            "A finding with port 0 is image-level evidence and must not create a graph edge until a service port is justified.",
        ],
    }
