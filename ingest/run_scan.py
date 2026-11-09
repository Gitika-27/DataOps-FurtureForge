#!/usr/bin/env python3
"""Start one isolated lab and collect Nmap/Trivy evidence using Docker containers."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TRIVY_IMAGE = "aquasec/trivy:0.58.1"
NMAP_IMAGE = "patchplanner-nmap:1.0"


class ScanError(RuntimeError):
    pass


def run(command: list[str], *, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("$ " + " ".join(command), flush=True)
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        check=False,
    )
    if check and result.returncode != 0:
        details = ""
        if capture:
            details = "\n" + (result.stdout or "") + (result.stderr or "")
        raise ScanError(f"Command exited {result.returncode}: {' '.join(command)}{details}")
    return result


def require_docker() -> None:
    try:
        run(["docker", "version"], capture=True)
        run(["docker", "compose", "version"], capture=True)
    except (FileNotFoundError, ScanError) as exc:
        raise ScanError(
            "Docker is unavailable. Start Docker Desktop, wait until its engine is running, "
            "then run this command again. Docker Compose v2 is required."
        ) from exc


def compose_file(lab_id: str) -> Path:
    path = ROOT / "lab" / lab_id / "docker-compose.yml"
    if not path.is_file():
        raise ScanError(f"Compose file does not exist: {path}")
    return path


def docker_mount_path(path: Path) -> str:
    # Passing a native resolved path as the --mount source works with Docker
    # Desktop from PowerShell and with Docker Engine from Linux/WSL.
    return str(path.resolve())


def collect_inventory(compose_path: Path, lab_id: str) -> dict[str, Any]:
    config_result = run(
        ["docker", "compose", "-f", str(compose_path), "config", "--format", "json"],
        capture=True,
    )
    try:
        config = json.loads(config_result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise ScanError("Docker Compose did not return valid JSON configuration") from exc

    network_configs = config.get("networks") or {}
    docker_network_names = {
        key: str((definition or {}).get("name", key))
        for key, definition in network_configs.items()
    }
    assets: list[dict[str, Any]] = []
    network_asset_ids: dict[str, list[str]] = {key: [] for key in network_configs}
    service_definitions = config.get("services") or {}
    for service_name, service_definition in service_definitions.items():
        result = run(
            ["docker", "compose", "-f", str(compose_path), "ps", "-q", service_name],
            capture=True,
        )
        container_id = (result.stdout or "").strip().splitlines()
        if not container_id:
            raise ScanError(f"Compose service '{service_name}' has no running container")
        inspected = run(["docker", "inspect", container_id[0]], capture=True)
        try:
            details = json.loads(inspected.stdout or "[]")[0]
        except (json.JSONDecodeError, IndexError, TypeError) as exc:
            raise ScanError(f"Could not inspect service '{service_name}'") from exc

        labels = (details.get("Config") or {}).get("Labels") or {}
        asset_id = labels.get("patchplanner.asset_id")
        if not asset_id:
            raise ScanError(f"Service '{service_name}' is missing patchplanner.asset_id label")
        attached_keys = service_definition.get("networks") or {}
        if isinstance(attached_keys, list):
            network_keys = [str(key) for key in attached_keys]
        else:
            network_keys = [str(key) for key in attached_keys.keys()]
        actual_networks = (details.get("NetworkSettings") or {}).get("Networks") or {}
        interfaces: dict[str, str] = {}
        for network_key in network_keys:
            docker_name = docker_network_names.get(network_key, network_key)
            endpoint = actual_networks.get(docker_name) or {}
            ip = str(endpoint.get("IPAddress", ""))
            if ip:
                interfaces[network_key] = ip
            network_asset_ids.setdefault(network_key, []).append(str(asset_id))

        preferred_ip = next(
            (interfaces[key] for key in ("internet_facing", "dmz", "internal") if key in interfaces),
            next(iter(interfaces.values()), "0.0.0.0"),
        )
        assets.append(
            {
                "id": str(asset_id),
                "compose_service": service_name,
                "image": str((details.get("Config") or {}).get("Image", service_definition.get("image", ""))),
                "ip": preferred_ip,
                "interfaces": interfaces,
                "zone": str(labels.get("patchplanner.zone", "internal")),
                "criticality": int(labels.get("patchplanner.criticality", "5")),
                "is_crown_jewel": str(labels.get("patchplanner.crown_jewel", "false")).lower() == "true",
                "is_entry_point": str(labels.get("patchplanner.entry_point", "false")).lower() == "true",
                "networks": network_keys,
            }
        )

    networks = {
        key: {
            "docker_name": docker_network_names.get(key, key),
            "asset_ids": sorted(set(network_asset_ids.get(key, []))),
        }
        for key in network_configs
    }
    return {"lab_id": lab_id, "assets": assets, "networks": networks}


def scan_networks(raw_dir: Path, inventory: dict[str, Any]) -> None:
    run(["docker", "build", "-t", NMAP_IMAGE, "-f", "lab/scanner/Dockerfile", "lab/scanner"])
    mount_source = docker_mount_path(raw_dir)
    # A small explicit port list keeps the demo scan quick and deterministic.
    # Expand this list only if the team deliberately adds another lab service.
    ports = "22,80,443,3306,8080,8443"
    for network_key, network_data in inventory["networks"].items():
        targets = sorted(
            {
                asset["interfaces"][network_key]
                for asset in inventory["assets"]
                if network_key in asset["interfaces"]
            }
        )
        if not targets:
            continue
        output_file = f"/out/nmap_{network_key}.xml"
        docker_name = network_data["docker_name"]
        command = [
            "docker", "run", "--rm", "--network", docker_name,
            "--mount", f"type=bind,source={mount_source},target=/out",
            NMAP_IMAGE, "-Pn", "-sV", "--version-light", "-T3", "--open",
            "--reason", "-p", ports, "-oX", output_file, *targets,
        ]
        run(command)


def scan_images(raw_dir: Path, inventory: dict[str, Any]) -> None:
    mount_source = docker_mount_path(raw_dir)
    for asset in inventory["assets"]:
        image = asset["image"]
        filename = f"/out/trivy_{asset['id']}.json"
        command = [
            "docker", "run", "--rm",
            "--mount", f"type=bind,source={mount_source},target=/out",
            "-v", "patchplanner-trivy-cache:/root/.cache/",
            TRIVY_IMAGE, "image", "--scanners", "vuln", "--format", "json",
            "--output", filename, image,
        ]
        run(command)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lab", choices=("lab_a", "lab_b"), required=True)
    parser.add_argument("--skip-trivy", action="store_true", help="scan open ports only; raw findings will be empty")
    parser.add_argument("--no-start", action="store_true", help="do not run Compose up (containers must already be running)")
    args = parser.parse_args(argv)
    compose_path = compose_file(args.lab)
    raw_dir = ROOT / "data" / "raw" / args.lab
    output_dir = ROOT / "data" / "scans" / args.lab
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        require_docker()
        if not args.no_start:
            run(["docker", "compose", "-f", str(compose_path), "up", "-d", "--pull", "missing"])
        print("Waiting briefly for services to initialize...", flush=True)
        time.sleep(10)
        inventory = collect_inventory(compose_path, args.lab)
        (raw_dir / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
        scan_networks(raw_dir, inventory)
        if args.skip_trivy:
            print("Skipping Trivy as requested; raw_findings will be empty.", flush=True)
        else:
            scan_images(raw_dir, inventory)
        result = run(
            [sys.executable, "ingest/parse_scan.py", "--raw-dir", str(raw_dir), "--output-dir", str(output_dir)],
            capture=True,
        )
        print(result.stdout or "", end="")
        print(f"Done. Lab remains running. Stop it with: docker compose -f {compose_path.relative_to(ROOT)} down")
        return 0
    except (FileNotFoundError, OSError, ScanError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("The included mock data remains available at data/mock/.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
