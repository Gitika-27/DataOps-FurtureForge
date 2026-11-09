"""Execution service and registry for FutureForge runs."""
from __future__ import annotations

import copy
import json
import os
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import networkx as nx

from api.models import (
    ArtifactFlags,
    BaselineMetrics,
    CutEdge,
    DerivedData,
    RunBundle,
)
from core.pipeline import prepare_lab_findings
from core.verify import apply_patches
from skeptic.run_skeptic import run_review_pipeline

ROOT = Path(__file__).resolve().parents[1]
DATA_RUNS = ROOT / "data" / "runs"
SNAPSHOT_PATH = ROOT / "data" / "snapshots" / "demo_lab_a.bundle.json"

RUN_LOCK = threading.Lock()
MAX_RUNS = 20
RUN_REGISTRY: dict[str, RunBundle] = {}
RUN_DIRS: dict[str, Path] = {}
LATEST_RUN_ID: Optional[str] = None
RUN_ID_REGEX = re.compile(r"^[a-f0-9]{32}$")


def validate_run_id(run_id: str) -> bool:
    return bool(RUN_ID_REGEX.match(run_id))


def strip_nvd_blobs(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return lightweight finding dicts with large NVD raw payload omitted."""
    sanitized: list[dict[str, Any]] = []
    for item in findings:
        clean = copy.deepcopy(item)
        if "nvd" in clean:
            # Keep summary indicators if available, remove giant raw json tree
            clean.pop("nvd", None)
        sanitized.append(clean)
    return sanitized


def compute_derived_metrics(
    graph_dict: dict[str, Any],
    plan_dict: dict[str, Any],
    max_hops: int = 8,
) -> DerivedData:
    """Compute derived cut_edges and baseline candidate comparison using engine functions."""
    nodes = graph_dict.get("nodes", [])
    edges = graph_dict.get("edges", [])

    g = nx.DiGraph()
    for n in nodes:
        nid = str(n.get("id"))
        g.add_node(nid, **{k: v for k, v in n.items() if k != "id"})

    candidate_patch_costs: dict[str, int] = {}
    for e in edges:
        src = str(e.get("src"))
        dst = str(e.get("dst"))
        edge_data = {k: v for k, v in e.items() if k not in ("src", "dst")}
        g.add_edge(src, dst, **edge_data)

        # Track patch costs for baseline
        patch_costs = edge_data.get("patch_costs", {})
        if isinstance(patch_costs, dict):
            for pid, cost in patch_costs.items():
                try:
                    candidate_patch_costs[str(pid)] = int(cost)
                except (ValueError, TypeError):
                    candidate_patch_costs[str(pid)] = 1
        elif "patch_id" in edge_data:
            pid = str(edge_data["patch_id"])
            cost = int(edge_data.get("patch_cost", 1) or 1)
            candidate_patch_costs[pid] = cost

    plan_patches = list(plan_dict.get("plan", {}).get("patches", []))
    cut_edges_list: list[CutEdge] = []

    if g.number_of_edges() > 0 and plan_patches:
        # Engine's own function to apply patches
        after_graph = apply_patches(g, plan_patches)
        for src, dst in g.edges():
            if not after_graph.has_edge(src, dst):
                cut_edges_list.append(CutEdge(src=str(src), dst=str(dst)))

    # Baseline comparison
    baseline: Optional[BaselineMetrics] = None
    if g.number_of_edges() > 0:
        total_candidate_cost = sum(candidate_patch_costs.values())
        plan_cost = sum(candidate_patch_costs.get(pid, 1) for pid in plan_patches)
        baseline = BaselineMetrics(
            candidate_patches=len(candidate_patch_costs),
            candidate_cost=total_candidate_cost,
            plan_patches=len(plan_patches),
            plan_cost=plan_cost,
        )

    return DerivedData(
        max_hops=max_hops,
        cut_edges=cut_edges_list,
        baseline=baseline,
    )


def load_snapshot_bundle(run_id: str, lab: str = "lab_a", mode: str = "demo") -> Optional[RunBundle]:
    """Load pre-generated freeze demo snapshot if present."""
    if not SNAPSHOT_PATH.exists():
        return None
    try:
        data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        data["run_id"] = run_id
        data["source"] = "snapshot"
        data["mode"] = mode
        data["lab"] = lab
        return RunBundle.model_validate(data)
    except Exception:
        return None


def execute_run(lab: str, mode: str) -> RunBundle:
    """Execute pipeline or retrieve snapshot fallback with lock and registry management."""
    global LATEST_RUN_ID

    run_id = uuid.uuid4().hex
    run_dir = DATA_RUNS / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    with RUN_LOCK:
        try:
            if mode == "live":
                # Check capability
                live_enabled = os.environ.get("FUTUREFORGE_ENABLE_LIVE") == "1"
                if not live_enabled:
                    raise ValueError(
                        "Live scan mode is disabled. To enable, set FUTUREFORGE_ENABLE_LIVE=1 "
                        "and ensure Docker, Nmap, and Trivy are installed and running."
                    )
                # In this environment, live scan is disabled by default
                raise NotImplementedError("Live scanning environment check failed: Docker daemon not verified.")

            elif mode == "demo":
                if lab != "lab_a":
                    raise ValueError("Synthetic demo mode is only available for lab_a")
                demo_fixture = ROOT / "data" / "mock" / "demo" / "lab_a" / "findings.json"
                if not demo_fixture.exists():
                    raise FileNotFoundError(f"Demo fixture not found at {demo_fixture}")
                document = json.loads(demo_fixture.read_text(encoding="utf-8"))

            elif mode == "mock":
                findings_handoff = run_dir / "findings.json"
                prepare_lab_findings(
                    lab_id=lab,
                    mock=True,
                    offline=True,
                    output_path=findings_handoff,
                )
                document = json.loads(findings_handoff.read_text(encoding="utf-8"))
            else:
                raise ValueError(f"Unknown mode: {mode}")

            # Run P3 review, graph, optimizer, verification, and report
            run_review_pipeline(
                document,
                output_dir=run_dir,
                create_pdf=True,
                max_hops=8,
                use_ilp=True,
            )

            # Read back generated artifacts
            verdicts_data = json.loads((run_dir / "verdicts.json").read_text(encoding="utf-8"))
            reviewed_findings_data = json.loads((run_dir / "reviewed_findings.json").read_text(encoding="utf-8"))
            plan_data = json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))
            graph_data = json.loads((run_dir / "graph.json").read_text(encoding="utf-8"))
            skeptic_result_data = json.loads((run_dir / "skeptic_result.json").read_text(encoding="utf-8"))

            status_str = plan_data.get("status", "invalid")
            if status_str not in ("verified", "no_modeled_paths", "invalid"):
                status_str = "invalid"

            is_synthetic = (
                mode == "demo"
                or bool("synthetic" in json.dumps(document).lower())
                or any(str(f.get("cve", "")).startswith("CVE-2099-") for f in document.get("findings", []))
                or any(f.get("source") == "synthetic-demo" for f in document.get("findings", []))
            )

            derived_data = compute_derived_metrics(graph_data, plan_data, max_hops=8)

            bundle = RunBundle(
                run_id=run_id,
                lab=lab,
                mode=mode,
                source="engine",
                status=status_str,
                error=None,
                synthetic=is_synthetic,
                notes=document.get("notes", []) or [],
                created_at=datetime.now(timezone.utc).isoformat(),
                assets=document.get("assets", []),
                services=document.get("services", []),
                reach=document.get("reach", []),
                raw_findings=strip_nvd_blobs(document.get("findings", [])),
                verdicts=verdicts_data.get("verdicts", []),
                reviewed_findings=reviewed_findings_data.get("findings", []),
                graph=graph_data,
                plan=plan_data,
                skeptic_result=skeptic_result_data,
                derived=derived_data,
                artifacts=ArtifactFlags(
                    report_html=(run_dir / "report.html").exists(),
                    report_pdf=(run_dir / "report.pdf").exists(),
                ),
            )

        except Exception as exc:
            # In demo mode, if engine fails, fallback to snapshot
            if mode == "demo":
                snapshot = load_snapshot_bundle(run_id, lab=lab, mode=mode)
                if snapshot is not None:
                    snapshot.error = f"Engine execution fallback: {str(exc)}"
                    bundle = snapshot
                else:
                    raise
            else:
                raise

        # Store in registry
        if len(RUN_REGISTRY) >= MAX_RUNS:
            oldest_id = next(iter(RUN_REGISTRY))
            RUN_REGISTRY.pop(oldest_id, None)
            oldest_dir = RUN_DIRS.pop(oldest_id, None)
            if oldest_dir and oldest_dir.exists():
                try:
                    shutil.rmtree(oldest_dir, ignore_errors=True)
                except Exception:
                    pass

        RUN_REGISTRY[run_id] = bundle
        RUN_DIRS[run_id] = run_dir
        LATEST_RUN_ID = run_id
        return bundle


def get_run(run_id: str) -> Optional[RunBundle]:
    if not validate_run_id(run_id):
        return None
    return RUN_REGISTRY.get(run_id)


def get_run_dir(run_id: str) -> Optional[Path]:
    if not validate_run_id(run_id):
        return None
    d = RUN_DIRS.get(run_id)
    if d and d.exists():
        return d
    disk_dir = DATA_RUNS / run_id
    if disk_dir.exists() and disk_dir.is_dir():
        return disk_dir
    return None


def get_latest_run() -> Optional[RunBundle]:
    if LATEST_RUN_ID and LATEST_RUN_ID in RUN_REGISTRY:
        return RUN_REGISTRY[LATEST_RUN_ID]
    if RUN_REGISTRY:
        return next(reversed(RUN_REGISTRY.values()))
    return None
