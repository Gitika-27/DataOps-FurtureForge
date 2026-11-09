"""Deterministic, evidence-preserving first-pass review of scanner findings.

This module never adds findings. It creates one Verdict per supplied raw
finding, and emits a graph-facing Finding only when the finding can be tied to
an observed service. Package evidence alone never proves remote exploitability.
"""
from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from contracts.models import Finding, Verdict


_VERSION_RE = re.compile(r"\d+(?:\.\d+)+(?:[-+._][0-9A-Za-z.-]+)?")
_PACKAGE_ALIASES = {
    "apache-httpd": {"apache", "httpd", "apache2", "http_server"},
    "httpd": {"apache", "httpd", "apache2", "http_server"},
    "apache2": {"apache", "httpd", "apache2", "http_server"},
    "nginx": {"nginx"},
    "mariadb": {"mariadb", "mysql"},
    "mysql": {"mariadb", "mysql"},
    "openssh": {"openssh", "ssh"},
}


def _dict(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    raise TypeError(f"Expected mapping or Pydantic model, got {type(value).__name__}")


def _version(value: Any) -> tuple[int, ...] | None:
    """Parse a simple dotted numeric version; refuse ambiguous versions."""
    text = str(value or "").strip()
    match = _VERSION_RE.search(text)
    if not match:
        return None
    pieces = re.match(r"\d+(?:\.\d+)*", match.group(0))
    if not pieces:
        return None
    try:
        return tuple(int(part) for part in pieces.group(0).split("."))
    except ValueError:
        return None


def compare_versions(left: Any, right: Any) -> int | None:
    """Compare numeric dotted version prefixes; None means unknown/ambiguous."""
    a, b = _version(left), _version(right)
    if a is None or b is None:
        return None
    size = max(len(a), len(b))
    a += (0,) * (size - len(a))
    b += (0,) * (size - len(b))
    return (a > b) - (a < b)


def _tokens(value: Any) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", str(value or "").lower()) if len(token) > 1}


def _package_matches_service(package: str, service: Mapping[str, Any], installed_version: str) -> bool:
    service_text = f"{service.get('name', '')} {service.get('version', '')}".lower()
    package_lower = package.lower().replace("_", "-")
    aliases = _PACKAGE_ALIASES.get(package_lower, {package_lower})
    identity_matches = any(alias.replace("_", " ") in service_text or alias in _tokens(service_text) for alias in aliases)
    if not identity_matches:
        return False
    observed = _version(service.get("version", ""))
    installed = _version(installed_version)
    return observed is not None and installed is not None and observed == installed


def _nvd_cve(payload: Mapping[str, Any]) -> dict[str, Any] | None:
    rows = payload.get("vulnerabilities") or []
    if not rows or not isinstance(rows[0], Mapping):
        return None
    cve = rows[0].get("cve")
    return dict(cve) if isinstance(cve, Mapping) else None


def _walk_cpe_matches(value: Any):
    if isinstance(value, Mapping):
        matches = value.get("cpeMatch") or value.get("cpe_match") or []
        if isinstance(matches, list):
            for item in matches:
                if isinstance(item, Mapping):
                    yield item
        for key, child in value.items():
            if key not in {"cpeMatch", "cpe_match"}:
                yield from _walk_cpe_matches(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_cpe_matches(child)


def _cpe_product_matches(package: str, criteria: str) -> bool:
    parts = criteria.split(":")
    if len(parts) < 6 or parts[0] != "cpe" or parts[1] != "2.3":
        return False
    vendor, product = parts[3].lower(), parts[4].lower()
    identifiers = {vendor, product, f"{vendor}_{product}", f"{vendor}-{product}"}
    package_tokens = _tokens(package)
    alias_tokens = set().union(*(_tokens(alias) for alias in _PACKAGE_ALIASES.get(package.lower(), {package})))
    combined = package_tokens | alias_tokens
    normalized_ids = set().union(*(_tokens(identifier) for identifier in identifiers))
    # Require at least one meaningful package token to intersect the CPE identity.
    return bool(combined & normalized_ids)


def _nvd_version_applicability(cve: Mapping[str, Any], package: str, installed: str) -> bool | None:
    """Return True/False when an NVD vulnerable CPE match is comparable, else None."""
    config = cve.get("configurations") or []
    saw_usable = False
    for match in _walk_cpe_matches(config):
        if not bool(match.get("vulnerable", False)):
            continue
        criteria = str(match.get("criteria") or match.get("cpe23Uri") or "")
        if not criteria or not _cpe_product_matches(package, criteria):
            continue
        saw_usable = True
        lower_inc = match.get("versionStartIncluding")
        lower_exc = match.get("versionStartExcluding")
        upper_inc = match.get("versionEndIncluding")
        upper_exc = match.get("versionEndExcluding")
        cpe_version = criteria.split(":")[5] if len(criteria.split(":")) > 5 else "*"
        if cpe_version not in {"*", "-"}:
            comparison = compare_versions(installed, cpe_version)
            if comparison is not None and comparison == 0:
                return True
            if comparison is None:
                continue
        checks: list[bool] = []
        if lower_inc:
            c = compare_versions(installed, lower_inc)
            if c is None:
                continue
            checks.append(c >= 0)
        if lower_exc:
            c = compare_versions(installed, lower_exc)
            if c is None:
                continue
            checks.append(c > 0)
        if upper_inc:
            c = compare_versions(installed, upper_inc)
            if c is None:
                continue
            checks.append(c <= 0)
        if upper_exc:
            c = compare_versions(installed, upper_exc)
            if c is None:
                continue
            checks.append(c < 0)
        if checks and all(checks):
            return True
    return False if saw_usable else None


def _nvd_network_vector(cve: Mapping[str, Any]) -> bool:
    metrics = cve.get("metrics") or {}
    for metric_name in ("cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        rows = metrics.get(metric_name) or []
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            data = row.get("cvssData") or {}
            if metric_name == "cvssMetricV2":
                if str(data.get("accessVector", "")).upper() == "NETWORK":
                    return True
            elif str(data.get("attackVector", "")).upper() == "NETWORK":
                return True
    return False


def _control_blocks(controls: list[dict[str, Any]], finding_id: str, asset_id: str) -> list[str]:
    matched = []
    for control in controls:
        if control.get("effective") is True and control.get("blocks_exploitation") is True and (
            control.get("finding_id") == finding_id or control.get("asset_id") == asset_id
        ):
            matched.append(str(control.get("name") or control.get("control") or "explicit blocking control"))
    return matched


def review_finding(
    raw_value: Any,
    *,
    assets: list[Any],
    services: list[Any],
    reach: list[Any],
    controls: list[dict[str, Any]] | None = None,
) -> tuple[Verdict, Finding | None]:
    """Review one raw finding; return exactly one verdict and optional graph input."""
    raw = _dict(raw_value)
    finding_id = str(raw.get("id") or "unknown-finding")
    asset_id = str(raw.get("asset_id") or "")
    cve_id = str(raw.get("cve") or "UNKNOWN")
    evidence: list[str] = []
    asset_rows = [_dict(x) for x in assets]
    service_rows = [_dict(x) for x in services]
    reach_rows = [_dict(x) for x in reach]
    asset_exists = any(str(item.get("id")) == asset_id for item in asset_rows)
    if not asset_exists:
        evidence.append(f"Finding references unknown asset '{asset_id}'.")
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.99, evidence=evidence, reasoning="Rejected: the target asset is absent from the ingested inventory."), None
    if not cve_id.upper().startswith("CVE-"):
        evidence.append("No valid CVE identifier is present in scanner evidence.")
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.99, evidence=evidence, reasoning="Rejected from CVE-based graph analysis because the identifier is invalid or missing."), None

    installed = str(raw.get("installed_version") or "")
    fixed = str(raw.get("fixed_version") or "")
    if installed and fixed:
        version_cmp = compare_versions(installed, fixed)
        if version_cmp is not None:
            evidence.append(f"Scanner reports installed version {installed} and fixed version {fixed}.")
            if version_cmp >= 0:
                return Verdict(finding_id=finding_id, status="rejected", confidence=0.92, evidence=evidence, reasoning="Rejected as not affected according to the scanner's installed/fixed version evidence."), None
        else:
            evidence.append("Installed/fixed version comparison was ambiguous; no version-based confirmation was made.")
    else:
        evidence.append("Installed or fixed package version is missing; version applicability cannot be checked.")

    package = str(raw.get("package_name") or "")
    candidate_services: list[dict[str, Any]] = []
    raw_port = int(raw.get("port", 0) or 0)
    if raw_port > 0:
        candidate_services = [
            s for s in service_rows
            if s.get("asset_id") == asset_id
            and int(s.get("port", 0)) == raw_port
            and (
                not package
                or not installed
                or _package_matches_service(package, s, installed)
            )
        ]
    elif package and installed:
        # Suggested ports are intentionally not evidence. Require package identity
        # and installed version to match a service banner on the same asset.
        candidate_services = [s for s in service_rows if s.get("asset_id") == asset_id and _package_matches_service(package, s, installed)]
    if not candidate_services:
        evidence.append("No same-asset open service could be matched to the package and installed version; suggested ports were not treated as proof.")
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.96, evidence=evidence, reasoning="Rejected from attack-graph use because this package finding has no verified service-port attribution."), None

    matched_service = candidate_services[0]
    port = int(matched_service["port"])
    evidence.append(f"Nmap observed {matched_service.get('name', 'service')} on {asset_id}:{port} ({matched_service.get('version', 'unknown')}).")
    incoming = [r for r in reach_rows if str(r.get("dst")) == asset_id and int(r.get("port", 0)) == port]
    if not incoming:
        evidence.append(f"No ingested reachability record reaches {asset_id}:{port}.")
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.95, evidence=evidence, reasoning="Rejected from attack-path analysis because no source can reach the observed service port in the supplied topology."), None
    evidence.append(f"Topology records {len(incoming)} source(s) able to reach {asset_id}:{port}.")

    blocked_by = _control_blocks(controls or [], finding_id, asset_id)
    if blocked_by:
        evidence.extend(f"Explicit control marked as blocking exploitation: {name}." for name in blocked_by)
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.9, evidence=evidence, reasoning="Excluded from attack-graph planning because the input explicitly marks a compensating control as blocking exploitation. Validate that control separately."), None

    nvd = raw.get("nvd") or {}
    cve_data = _nvd_cve(nvd) if isinstance(nvd, Mapping) else None
    applicability = _nvd_version_applicability(cve_data, package, installed) if cve_data else None
    network_vector = _nvd_network_vector(cve_data) if cve_data else False
    if applicability is False:
        evidence.append("NVD CPE applicability data does not include this installed package version.")
        return Verdict(finding_id=finding_id, status="rejected", confidence=0.9, evidence=evidence, reasoning="Rejected because available NVD CPE version ranges do not cover the installed version."), None
    if applicability is True:
        evidence.append("NVD vulnerable CPE version range includes the installed version.")
    else:
        evidence.append("NVD affected-version data is unavailable or could not be matched to this package; scanner version evidence alone is not treated as confirmation.")
    if network_vector:
        evidence.append("NVD CVSS vector identifies network attack vector (AV:N).")
    else:
        evidence.append("NVD does not establish a network attack vector for this finding.")

    confirmed = applicability is True and network_vector
    status = "confirmed" if confirmed else "downgraded"
    confidence = 0.94 if confirmed else 0.68
    graph_finding: Finding | None = None
    try:
        cvss = float(raw.get("cvss", 0.0))
        if not 0 <= cvss <= 10:
            raise ValueError("CVSS out of range")
        epss_raw = raw.get("epss")
        epss = None if epss_raw is None else float(epss_raw)
        if epss is not None and not 0 <= epss <= 1:
            epss = None
        patch_id = str(raw.get("patch_id") or f"patch:{asset_id}:{cve_id}")
        patch_cost = max(1, int(raw.get("patch_cost", 1) or 1))
        graph_finding = Finding(
            id=finding_id,
            asset_id=asset_id,
            port=port,
            cve=cve_id,
            cvss=cvss,
            epss=epss,
            in_kev=bool(raw.get("in_kev", False)),
            remote_exploitable=confirmed,
            patch_id=patch_id,
            patch_cost=patch_cost,
        )
    except (TypeError, ValueError):
        evidence.append("Finding could not be normalized to the frozen Finding contract.")
        graph_finding = None
        status = "downgraded"
        confidence = min(confidence, 0.5)
    reasoning = (
        "Confirmed for graph use only because the installed version matches an observed, reachable service, "
        "NVD CPE data marks the version affected, and NVD identifies AV:N."
        if confirmed else
        "Downgraded: scanner evidence is preserved, but the available sources do not jointly establish affected-version applicability and network exploitability. It is not used as a remotely exploitable graph edge."
    )
    return Verdict(finding_id=finding_id, status=status, confidence=confidence, evidence=evidence, reasoning=reasoning), graph_finding


def review_findings(
    raw_findings: list[Any], *, assets: list[Any], services: list[Any], reach: list[Any],
    controls: list[dict[str, Any]] | None = None,
) -> tuple[list[Verdict], list[Finding]]:
    """Return one valid Verdict for every input finding and normalized records."""
    verdicts: list[Verdict] = []
    findings: list[Finding] = []
    seen: set[str] = set()
    for raw in raw_findings:
        verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach, controls=controls)
        if verdict.finding_id in seen:
            # Preserve a one-to-one contract by refusing ambiguous duplicate IDs.
            verdict = Verdict(finding_id=verdict.finding_id, status="rejected", confidence=1.0,
                              evidence=["Duplicate finding ID in raw input; ambiguous evidence was not merged."],
                              reasoning="Rejected because multiple raw records share this finding ID.")
            finding = None
        seen.add(verdict.finding_id)
        verdicts.append(verdict)
        if finding is not None:
            findings.append(finding)
    return verdicts, findings
