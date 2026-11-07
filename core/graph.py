"""Attack-graph construction and bounded entry-point-to-crown-jewel paths."""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

import networkx as nx


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    raise TypeError(f"Expected mapping or Pydantic model, got {type(value).__name__}")


def build_attack_graph(
    assets: Iterable[Any], reach: Iterable[Any], findings: Iterable[Any],
    verdicts: Iterable[Any] | None = None,
) -> nx.DiGraph:
    """Build DiGraph using the guide's exact rule: reach A→B on P plus an
    accepted (confirmed/downgraded), remotely exploitable finding on B:P.

    Port 0 is intentionally ignored: image/package evidence is not service
    attribution. A raw finding's ``suggested_ports`` is not treated as proof.
    """
    asset_rows = [_as_dict(x) for x in assets]
    reach_rows = [_as_dict(x) for x in reach]
    finding_rows = [_as_dict(x) for x in findings]
    verdict_by_id: dict[str, dict[str, Any]] = {}
    for item in verdicts or []:
        row = _as_dict(item)
        verdict_by_id[str(row.get("finding_id", ""))] = row

    graph = nx.DiGraph()
    for asset in asset_rows:
        graph.add_node(
            str(asset["id"]), ip=asset.get("ip"), zone=asset.get("zone"),
            criticality=asset.get("criticality", 5),
            is_entry_point=bool(asset.get("is_entry_point", False)),
            is_crown_jewel=bool(asset.get("is_crown_jewel", False)),
        )

    findings_by_target_port: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for finding in finding_rows:
        port = int(finding.get("port", 0) or 0)
        if port <= 0 or not bool(finding.get("remote_exploitable", False)):
            continue
        finding_id = str(finding.get("id", ""))
        verdict = verdict_by_id.get(finding_id)
        # When verdicts are supplied, only accepted statuses enter the graph.
        if verdicts is not None and (not verdict or verdict.get("status") not in {"confirmed", "downgraded"}):
            continue
        findings_by_target_port.setdefault((str(finding.get("asset_id", "")), port), []).append(finding)

    for item in reach_rows:
        src, dst, port = str(item["src"]), str(item["dst"]), int(item["port"])
        if src not in graph or dst not in graph:
            continue
        for finding in findings_by_target_port.get((dst, port), []):
            patch_id = str(finding.get("patch_id") or finding.get("id"))
            patch_cost = max(1, int(finding.get("patch_cost", 1) or 1))
            if graph.has_edge(src, dst):
                edge = graph[src][dst]
                if patch_id not in edge["patch_ids"]:
                    edge["patch_ids"].append(patch_id)
                old_cost = edge["patch_costs"].get(patch_id)
                if old_cost is not None and old_cost != patch_cost:
                    raise ValueError(f"Inconsistent patch cost for {patch_id}: {old_cost} vs {patch_cost}")
                edge["patch_costs"][patch_id] = patch_cost
                edge["patch_cost"] = min(edge["patch_costs"].values())
                edge["finding_ids"].append(str(finding.get("id", "")))
                edge["ports"].append(port)
            else:
                graph.add_edge(
                    src, dst, patch_id=patch_id, patch_ids=[patch_id],
                    finding_ids=[str(finding.get("id", ""))], ports=[port],
                    patch_cost=patch_cost, patch_costs={patch_id: patch_cost},
                )
    return graph


def enumerate_attack_paths(
    graph: nx.DiGraph, *, max_hops: int = 8,
) -> list[list[str]]:
    """Enumerate simple paths from every entry point to every crown jewel."""
    if max_hops < 1:
        raise ValueError("max_hops must be at least 1")
    entries = [n for n, d in graph.nodes(data=True) if d.get("is_entry_point")]
    crowns = [n for n, d in graph.nodes(data=True) if d.get("is_crown_jewel")]
    paths: list[list[str]] = []
    for src in entries:
        for dst in crowns:
            if src == dst or not nx.has_path(graph, src, dst):
                continue
            paths.extend(list(nx.all_simple_paths(graph, src, dst, cutoff=max_hops)))
    return paths


def count_attack_paths(graph: nx.DiGraph, *, max_hops: int = 8) -> int:
    return len(enumerate_attack_paths(graph, max_hops=max_hops))


def path_patch_sets(graph: nx.DiGraph, paths: Iterable[list[str]]) -> list[set[str]]:
    """Convert each node path into the patches capable of cutting its edges."""
    result: list[set[str]] = []
    for path in paths:
        patches: set[str] = set()
        for src, dst in zip(path, path[1:]):
            patches.update(graph[src][dst].get("patch_ids", [graph[src][dst].get("patch_id")]))
        result.append({p for p in patches if p})
    return result
