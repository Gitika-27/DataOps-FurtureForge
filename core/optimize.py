"""Minimum-cost patch hitting-set optimizer (PuLP ILP + greedy fallback)."""
from __future__ import annotations

from typing import Iterable

import networkx as nx

from core.graph import enumerate_attack_paths
from core.verify import verify_plan


def _edge_patch_bundle(graph: nx.DiGraph, src: str, dst: str) -> frozenset[str]:
    data = graph[src][dst]
    values = data.get("patch_ids", [data.get("patch_id")])
    return frozenset(str(value) for value in values if value)


def _path_bundles(graph: nx.DiGraph, paths: list[list[str]]) -> list[list[frozenset[str]]]:
    """Each edge is cut only after all independent findings on it are patched."""
    return [[_edge_patch_bundle(graph, a, b) for a, b in zip(path, path[1:])] for path in paths]


def _patch_costs(graph: nx.DiGraph) -> dict[str, float]:
    costs: dict[str, float] = {}
    for _, _, data in graph.edges(data=True):
        edge_cost = float(data.get("patch_cost", 1) or 1)
        for patch in data.get("patch_ids", [data.get("patch_id")]):
            if patch:
                costs[str(patch)] = min(costs.get(str(patch), float("inf")), edge_cost)
    return costs


def greedy_hitting_set(path_sets: list[set[str]], costs: dict[str, float]) -> list[str]:
    """Public simple-set greedy helper (one patch identifier per edge)."""
    uncovered = [set(path) for path in path_sets]
    selected: list[str] = []
    while uncovered:
        candidates = set().union(*uncovered)
        if not candidates:
            raise ValueError("An attack path has no associated patch; cannot produce a safe plan")
        def score(patch: str) -> tuple[float, int, str]:
            covered = sum(patch in path for path in uncovered)
            return (costs.get(patch, 1.0) / covered, -covered, patch)
        best = min(candidates, key=score)
        selected.append(best)
        uncovered = [path for path in uncovered if best not in path]
    return selected


def _greedy_bundles(path_bundles: list[list[frozenset[str]]], costs: dict[str, float]) -> list[str]:
    selected: set[str] = set()
    uncovered = list(range(len(path_bundles)))
    while uncovered:
        candidates = {bundle for i in uncovered for bundle in path_bundles[i]}
        candidates.discard(frozenset())
        if not candidates:
            raise ValueError("An attack path contains an edge without a patch_id")
        def score(bundle: frozenset[str]) -> tuple[float, int, tuple[str, ...]]:
            missing = bundle - selected
            newly_cut = sum(any(edge_bundle.issubset(selected | missing) for edge_bundle in path_bundles[i]) for i in uncovered)
            effort = sum(costs.get(patch, 1.0) for patch in missing)
            return (effort / max(1, newly_cut), -newly_cut, tuple(sorted(bundle)))
        chosen = min(candidates, key=score)
        selected.update(chosen)
        uncovered = [i for i in uncovered if not any(bundle.issubset(selected) for bundle in path_bundles[i])]
    return sorted(selected)


def optimize_patches(graph: nx.DiGraph, *, max_hops: int = 8, use_ilp: bool = True) -> list[str]:
    """Return a verified minimum-cost (or greedy fallback) patch set.

    ILP models each edge's patch bundle as an AND condition, then requires at
    least one fully patched edge on every attack path. This also handles two
    independent findings represented by the same DiGraph edge.
    """
    paths = enumerate_attack_paths(graph, max_hops=max_hops)
    if not paths:
        return []
    bundles = _path_bundles(graph, paths)
    if any(not bundle for path in bundles for bundle in path):
        raise ValueError("An attack path contains an edge without a patch_id")
    costs = _patch_costs(graph)
    selected: list[str] | None = None

    if use_ilp:
        try:
            import pulp
            all_patches = sorted(costs)
            problem = pulp.LpProblem("patch_hitting_set", pulp.LpMinimize)
            x = {patch: pulp.LpVariable(f"patch_{i}", cat="Binary") for i, patch in enumerate(all_patches)}
            problem += pulp.lpSum(costs[p] * x[p] for p in all_patches)
            edge_bundles = sorted({bundle for path in bundles for bundle in path}, key=lambda b: tuple(sorted(b)))
            y = {bundle: pulp.LpVariable(f"edge_cut_{i}", cat="Binary") for i, bundle in enumerate(edge_bundles)}
            for bundle, cut in y.items():
                for patch in bundle:
                    problem += cut <= x[patch]
                problem += cut >= pulp.lpSum(x[p] for p in bundle) - (len(bundle) - 1)
            for i, path in enumerate(bundles):
                problem += pulp.lpSum(y[bundle] for bundle in path) >= 1, f"cover_path_{i}"
            status = problem.solve(pulp.PULP_CBC_CMD(msg=False))
            if pulp.LpStatus[status] == "Optimal":
                selected = [patch for patch, var in x.items() if var.value() and var.value() >= 0.5]
        except Exception:
            selected = None

    if selected is None:
        selected = _greedy_bundles(bundles, costs)
    result = verify_plan(graph, selected, max_hops=max_hops, raise_on_failure=False)
    if not result["valid"]:
        raise RuntimeError(f"Optimizer produced an invalid plan: {result['paths_after']} paths remain")
    return sorted(selected)
