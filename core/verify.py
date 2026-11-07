"""Independent plan verification by removing patched attack edges."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

import networkx as nx

from contracts.models import PatchPlan
from core.graph import count_attack_paths, enumerate_attack_paths


def apply_patches(graph: nx.DiGraph, patches: set[str] | list[str]) -> nx.DiGraph:
    """Return a graph copy with edges removed when their patch is selected."""
    patched = set(patches)
    result = deepcopy(graph)
    for src, dst, data in list(result.edges(data=True)):
        edge_patches = set(data.get("patch_ids", [data.get("patch_id")])) - {None}
        # Multiple independent findings on one A→B edge: all must be fixed.
        if edge_patches and edge_patches.issubset(patched):
            result.remove_edge(src, dst)
    return result


def verify_plan(graph: nx.DiGraph, patches: set[str] | list[str], *, max_hops: int = 8, raise_on_failure: bool = True) -> dict[str, Any]:
    before = count_attack_paths(graph, max_hops=max_hops)
    after_graph = apply_patches(graph, patches)
    after = count_attack_paths(after_graph, max_hops=max_hops)
    result = {"valid": after == 0, "paths_before": before, "paths_after": after, "remaining_paths": enumerate_attack_paths(after_graph, max_hops=max_hops)}
    if raise_on_failure and after != 0:
        raise AssertionError(f"Patch plan is not safe: {after} attack path(s) remain")
    return result


def make_patch_plan(graph: nx.DiGraph, patches: list[str], *, max_hops: int = 8, risk_reduction_pct: float | None = None) -> PatchPlan:
    result = verify_plan(graph, patches, max_hops=max_hops, raise_on_failure=False)
    if result["paths_before"] == 0:
        # There is no baseline attack path to reduce; do not imply that a
        # zero-edge graph proves the environment is safe or that patches helped.
        reduction = 0.0
    else:
        reduction = 100.0 * (result["paths_before"] - result["paths_after"]) / result["paths_before"]
    if risk_reduction_pct is not None:
        reduction = max(0.0, min(100.0, float(risk_reduction_pct)))
    return PatchPlan(patches=patches, paths_before=result["paths_before"], paths_after=result["paths_after"], risk_reduction_pct=round(reduction, 2))
