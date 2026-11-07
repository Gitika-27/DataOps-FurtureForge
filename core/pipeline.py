"""P1→P2 enrichment handoff and verified P2 planning entry point.

The prepare command deliberately stops before graph planning: P3 must review
scanner evidence and provide port-specific Findings/Verdicts first.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterable

import networkx as nx

from contracts.models import PatchPlan
from core.enrich import DEFAULT_CACHE_DIR, prepare_findings_document
from core.graph import build_attack_graph, count_attack_paths, enumerate_attack_paths
from core.optimize import optimize_patches
from core.verify import verify_plan

ROOT = Path(__file__).resolve().parents[1]


def _load_document(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Input file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def prepare_lab_findings(
    lab_id: str,
    *,
    mock: bool = False,
    offline: bool = False,
    refresh: bool = False,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    input_dir: Path | None = None,
    output_path: Path | None = None,
) -> Path:
    """Load P1's files, enrich raw findings, and write the P3 handoff file."""
    if input_dir is None:
        input_dir = ROOT / "data" / ("mock" if mock else "scans") / lab_id
    input_dir = input_dir.resolve()
    scan = _load_document(input_dir / "scan.json")
    reach = _load_document(input_dir / "reach.json")
    handoff = prepare_findings_document(
        scan,
        reach,
        cache_dir=cache_dir,
        offline=offline,
        refresh=refresh,
    )
    if output_path is None:
        output_path = ROOT / "data" / "processed" / lab_id / "findings.json"
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(handoff, indent=2) + "\n", encoding="utf-8")
    return output_path


def run_verified_planner(
    assets: Iterable[Any],
    reach: Iterable[Any],
    findings: Iterable[Any],
    verdicts: Iterable[Any] | None,
    *,
    max_hops: int = 8,
    use_ilp: bool = True,
) -> dict[str, Any]:
    """Build and verify a plan from P1 reachability and P3-reviewed findings.

    ``verdicts`` is required. This prevents unreviewed scanner output from
    silently entering the optimization graph. An empty graph is reported as
    ``no_modeled_paths`` with 0% reduction, not as proof the environment is safe.
    """
    if verdicts is None:
        raise ValueError("Skeptic verdicts are required before planning")
    graph: nx.DiGraph = build_attack_graph(assets, reach, findings, verdicts)
    paths_before = count_attack_paths(graph, max_hops=max_hops)
    if paths_before == 0:
        plan = PatchPlan(
            patches=[], paths_before=0, paths_after=0, risk_reduction_pct=0.0
        )
        return {
            "status": "no_modeled_paths",
            "warning": (
                "No supported attack paths were modeled. This is not proof that "
                "the scanned environment is secure. Check scan coverage and findings."
            ),
            "graph": graph,
            "paths": [],
            "plan": plan,
            "verification": {"valid": True, "paths_before": 0, "paths_after": 0},
        }

    patches = optimize_patches(graph, max_hops=max_hops, use_ilp=use_ilp)
    verification = verify_plan(graph, patches, max_hops=max_hops, raise_on_failure=True)
    reduction = 100.0 * (paths_before - verification["paths_after"]) / paths_before
    plan = PatchPlan(
        patches=patches,
        paths_before=paths_before,
        paths_after=verification["paths_after"],
        risk_reduction_pct=round(reduction, 2),
    )
    return {
        "status": "verified" if verification["paths_after"] == 0 else "invalid",
        "warning": None,
        "graph": graph,
        "paths": enumerate_attack_paths(graph, max_hops=max_hops),
        "plan": plan,
        "verification": verification,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lab", choices=("lab_a", "lab_b"), required=True)
    parser.add_argument("--mock", action="store_true", help="read data/mock instead of data/scans")
    parser.add_argument("--offline", action="store_true", help="use cache only; make no web requests")
    parser.add_argument("--refresh", action="store_true", help="refresh cached enrichment responses")
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR)
    parser.add_argument("--input-dir", type=Path, help="override directory containing scan.json and reach.json")
    parser.add_argument("--output", type=Path, help="override findings.json destination")
    args = parser.parse_args(argv)
    try:
        output = prepare_lab_findings(
            args.lab,
            mock=args.mock,
            offline=args.offline,
            refresh=args.refresh,
            cache_dir=args.cache_dir,
            input_dir=args.input_dir,
            output_path=args.output,
        )
        document = _load_document(output)
        print(f"Wrote {output}")
        print(
            f"Stage: {document['stage']}; assets={len(document['assets'])}, "
            f"services={len(document['services'])}, findings={len(document['findings'])}, "
            f"reach={len(document['reach'])}"
        )
        print("This file is the P3 Skeptic handoff; it is not yet an approved attack graph.")
        return 0
    except (OSError, ValueError, TypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
