#!/usr/bin/env python3
"""Normalize Nmap XML + Trivy JSON into the team's scan.json/reach.json inputs.

This module is deliberately limited to parsing scanner evidence and declared lab
network membership. It does not assert that a package CVE is remotely exploitable.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MOCK_ROOT = ROOT / "data" / "mock"


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Required input file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def _safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value)


def parse_nmap_xml(path: Path, ip_to_asset: dict[str, str]) -> list[dict[str, Any]]:
    """Return open TCP service observations found in a single network scan."""
    try:
        root = ET.parse(path).getroot()
    except FileNotFoundError as exc:
        raise ValueError(f"Nmap XML not found: {path}") from exc
    except ET.ParseError as exc:
        raise ValueError(f"Invalid Nmap XML in {path}: {exc}") from exc

    services: list[dict[str, Any]] = []
    for host in root.findall("host"):
        addresses = [node.attrib.get("addr", "") for node in host.findall("address")]
        asset_id = next((ip_to_asset[ip] for ip in addresses if ip in ip_to_asset), None)
        if not asset_id:
            continue
        for port_node in host.findall("./ports/port"):
            state = port_node.find("state")
            if state is None or state.attrib.get("state") != "open":
                continue
            try:
                port = int(port_node.attrib["portid"])
            except (KeyError, ValueError):
                continue
            service_node = port_node.find("service")
            if service_node is None:
                name, version = "unknown", "unknown"
            else:
                name = service_node.attrib.get("name", "unknown")
                version_parts = [
                    service_node.attrib.get(key, "").strip()
                    for key in ("product", "version", "extrainfo")
                    if service_node.attrib.get(key, "").strip()
                ]
                version = " ".join(version_parts) if version_parts else "unknown"
            services.append(
                {"asset_id": asset_id, "port": port, "name": name, "version": version}
            )
    return services


def _cvss_score(vulnerability: dict[str, Any]) -> float:
    cvss = vulnerability.get("CVSS") or {}
    if not isinstance(cvss, dict):
        return 0.0
    # Prefer NVD, then another source; prefer v3/v4 scores where available.
    for source in ("nvd", "redhat", "ghsa", *cvss.keys()):
        entry = cvss.get(source)
        if not isinstance(entry, dict):
            continue
        for key in ("V4Score", "V3Score", "V2Score"):
            try:
                score = float(entry[key])
                if 0.0 <= score <= 10.0:
                    return score
            except (KeyError, TypeError, ValueError):
                pass
    return 0.0


def parse_trivy_json(path: Path, asset_id: str, suggested_ports: list[int]) -> list[dict[str, Any]]:
    """Return raw CVE evidence. Port 0 means no service attribution was proven."""
    if not path.exists():
        return []
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid Trivy JSON in {path}: {exc}") from exc
    findings: list[dict[str, Any]] = []
    for result in report.get("Results") or []:
        if not isinstance(result, dict):
            continue
        target = result.get("Target", "")
        for vulnerability in result.get("Vulnerabilities") or []:
            if not isinstance(vulnerability, dict):
                continue
            cve = str(vulnerability.get("VulnerabilityID", "")).strip()
            # The shared Finding contract uses CVE IDs. Keep non-CVE package
            # advisories in the raw Trivy file, but do not mislabel them as CVEs.
            if not cve.upper().startswith("CVE-"):
                continue
            package = str(vulnerability.get("PkgName", "unknown"))
            installed = str(vulnerability.get("InstalledVersion", "unknown"))
            fixed = str(vulnerability.get("FixedVersion", "") or "")
            findings.append(
                {
                    "id": f"{asset_id}:{cve}:{package}",
                    "asset_id": asset_id,
                    "port": 0,
                    "port_context": "image-level; no network port attribution",
                    "suggested_ports": sorted(set(suggested_ports)),
                    "cve": cve,
                    "cvss": _cvss_score(vulnerability),
                    "severity": str(vulnerability.get("Severity", "UNKNOWN")),
                    "package_name": package,
                    "installed_version": installed,
                    "fixed_version": fixed,
                    "title": str(vulnerability.get("Title", "")),
                    "primary_url": str(vulnerability.get("PrimaryURL", "")),
                    "target": str(target),
                    "source": "trivy-image-scan",
                    "remote_exploitable": None,
                    "raw_note": (
                        "Scanner package evidence only; this is not proof that the CVE "
                        "is reachable or exploitable through a discovered service."
                    ),
                }
            )
    return findings


def normalize(raw_dir: Path, output_dir: Path) -> tuple[Path, Path]:
    inventory = _load_json(raw_dir / "inventory.json")
    lab_id = str(inventory.get("lab_id", "unknown"))
    assets_meta = inventory.get("assets")
    if not isinstance(assets_meta, list) or not assets_meta:
        raise ValueError("inventory.json must contain a non-empty 'assets' array")

    ip_to_asset: dict[str, str] = {}
    asset_interfaces: dict[str, dict[str, str]] = {}
    assets: list[dict[str, Any]] = []
    metadata_by_id: dict[str, dict[str, Any]] = {}
    for item in assets_meta:
        if not isinstance(item, dict):
            continue
        asset_id = str(item.get("id", "")).strip()
        if not asset_id:
            continue
        interfaces = item.get("interfaces") or {}
        interfaces = {str(network): str(ip) for network, ip in interfaces.items() if ip}
        asset_interfaces[asset_id] = interfaces
        for ip in interfaces.values():
            ip_to_asset[ip] = asset_id
        primary_ip = str(item.get("ip") or next(iter(interfaces.values()), "0.0.0.0"))
        assets.append(
            {
                "id": asset_id,
                "ip": primary_ip,
                "zone": str(item.get("zone", "internal")),
                "criticality": int(item.get("criticality", 5)),
                "is_crown_jewel": bool(item.get("is_crown_jewel", False)),
                "is_entry_point": bool(item.get("is_entry_point", False)),
            }
        )
        metadata_by_id[asset_id] = item
    if not assets:
        raise ValueError("No usable assets in inventory.json")

    # Track services separately per network, so reachability only uses ports that
    # were seen open on the exact shared Docker network.
    services_by_key: dict[tuple[str, int, str], dict[str, Any]] = {}
    services_by_network: dict[str, list[dict[str, Any]]] = {}
    networks = inventory.get("networks") or {}
    if not isinstance(networks, dict):
        raise ValueError("inventory.json 'networks' must be an object")
    for network_key in networks:
        xml_path = raw_dir / f"nmap_{_safe_name(str(network_key))}.xml"
        if not xml_path.exists():
            raise ValueError(f"Missing Nmap result for network {network_key}: {xml_path}")
        found = parse_nmap_xml(xml_path, ip_to_asset)
        network_asset_ids = set((networks[network_key] or {}).get("asset_ids", []))
        found = [service for service in found if service["asset_id"] in network_asset_ids]
        services_by_network[str(network_key)] = found
        for service in found:
            key = (service["asset_id"], service["port"], service["name"])
            services_by_key.setdefault(key, service)

    services = sorted(
        services_by_key.values(), key=lambda s: (s["asset_id"], s["port"], s["name"])
    )
    ports_by_asset: dict[str, list[int]] = {}
    for service in services:
        ports_by_asset.setdefault(service["asset_id"], []).append(service["port"])

    raw_findings: list[dict[str, Any]] = []
    for asset_id, item in metadata_by_id.items():
        trivy_path = raw_dir / f"trivy_{_safe_name(asset_id)}.json"
        raw_findings.extend(
            parse_trivy_json(trivy_path, asset_id, ports_by_asset.get(asset_id, []))
        )

    reach_set: set[tuple[str, str, int]] = set()
    for network_key, network_data in networks.items():
        network_asset_ids = [str(x) for x in (network_data or {}).get("asset_ids", [])]
        open_services = services_by_network.get(str(network_key), [])
        for service in open_services:
            destination = service["asset_id"]
            for source in network_asset_ids:
                if source != destination:
                    reach_set.add((source, destination, int(service["port"])))
    reach = [
        {"src": src, "dst": dst, "port": port}
        for src, dst, port in sorted(reach_set)
    ]

    output_dir.mkdir(parents=True, exist_ok=True)
    scan = {
        "schema_version": 1,
        "lab_id": lab_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": assets,
        "interfaces": asset_interfaces,
        "services": services,
        "raw_findings": raw_findings,
        "notes": [
            "Reachability is inferred only for assets sharing a declared Docker network and a destination port observed open on that network.",
            "Trivy image/package findings use port 0 until a team member safely maps evidence to a service; they are not exploit confirmation.",
        ],
    }
    reach_doc = {"schema_version": 1, "lab_id": lab_id, "reach": reach}
    scan_path = output_dir / "scan.json"
    reach_path = output_dir / "reach.json"
    scan_path.write_text(json.dumps(scan, indent=2) + "\n", encoding="utf-8")
    reach_path.write_text(json.dumps(reach_doc, indent=2) + "\n", encoding="utf-8")
    return scan_path, reach_path


def validate_mock(lab_id: str) -> tuple[int, int, int]:
    folder = MOCK_ROOT / lab_id
    scan = _load_json(folder / "scan.json")
    reach = _load_json(folder / "reach.json")
    for key in ("assets", "services", "raw_findings"):
        if not isinstance(scan.get(key), list):
            raise ValueError(f"Mock scan.json must contain an array named '{key}'")
    if not isinstance(reach.get("reach"), list):
        raise ValueError("Mock reach.json must contain an array named 'reach'")
    asset_ids = {str(asset.get("id")) for asset in scan["assets"]}
    for edge in reach["reach"]:
        if edge.get("src") not in asset_ids or edge.get("dst") not in asset_ids:
            raise ValueError(f"Mock reach entry references unknown asset: {edge}")
    return len(scan["assets"]), len(scan["services"]), len(reach["reach"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mock", choices=("lab_a", "lab_b"), help="validate included mock data")
    parser.add_argument("--raw-dir", type=Path, help="directory containing inventory.json, Nmap XML, and Trivy JSON")
    parser.add_argument("--output-dir", type=Path, help="destination for normalized JSON files")
    args = parser.parse_args(argv)
    try:
        if args.mock:
            assets, services, edges = validate_mock(args.mock)
            print(f"Mock {args.mock} valid: {assets} assets, {services} services, {edges} reach records")
            print(f"Input directory: {MOCK_ROOT / args.mock}")
            return 0
        if not args.raw_dir:
            parser.error("provide --mock lab_a|lab_b or --raw-dir <folder>")
        raw_dir = args.raw_dir.resolve()
        output_dir = (args.output_dir or (ROOT / "data" / "scans" / raw_dir.name)).resolve()
        scan_path, reach_path = normalize(raw_dir, output_dir)
        print(f"Wrote {scan_path}")
        print(f"Wrote {reach_path}")
        return 0
    except (OSError, ValueError, TypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
