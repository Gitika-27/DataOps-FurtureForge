import networkx as nx
import pytest

from core.graph import build_attack_graph, count_attack_paths, enumerate_attack_paths
from core.optimize import optimize_patches
from core.verify import apply_patches, make_patch_plan, verify_plan


def node(graph, name, *, entry=False, crown=False):
    graph.add_node(name, is_entry_point=entry, is_crown_jewel=crown)


def edge(graph, src, dst, patch, cost=1):
    graph.add_edge(src, dst, patch_id=patch, patch_ids=[patch], patch_cost=cost)


def test_chain_graph_is_cut_and_verified():
    g = nx.DiGraph()
    node(g, "internet", entry=True); node(g, "app"); node(g, "db", crown=True)
    edge(g, "internet", "app", "patch-web", 2)
    edge(g, "app", "db", "patch-db", 1)
    assert count_attack_paths(g) == 1
    plan = optimize_patches(g)
    assert plan == ["patch-db"]
    assert verify_plan(g, plan)["paths_after"] == 0


def test_diamond_requires_two_branch_patches_or_shared_patch():
    g = nx.DiGraph()
    for name, flags in {"entry": {"entry": True}, "left": {}, "right": {}, "crown": {"crown": True}}.items():
        node(g, name, entry=flags.get("entry", False), crown=flags.get("crown", False))
    edge(g, "entry", "left", "shared-entry", 1)
    edge(g, "entry", "right", "shared-entry", 1)
    edge(g, "left", "crown", "left-fix", 1)
    edge(g, "right", "crown", "right-fix", 1)
    assert len(enumerate_attack_paths(g)) == 2
    plan = optimize_patches(g)
    assert plan == ["shared-entry"]
    assert verify_plan(g, plan)["valid"]


def test_decoy_is_not_on_crown_jewel_path_and_is_not_patched():
    g = nx.DiGraph()
    node(g, "entry", entry=True); node(g, "app"); node(g, "db", crown=True); node(g, "decoy")
    edge(g, "entry", "app", "web-fix")
    edge(g, "app", "db", "db-fix")
    edge(g, "entry", "decoy", "decoy-fix")
    assert count_attack_paths(g) == 1
    assert "decoy-fix" not in optimize_patches(g)


def test_graph_builder_obeys_reach_port_verdict_and_remote_rule():
    assets = [
        {"id": "a", "ip": "1.1.1.1", "zone": "internet", "criticality": 5, "is_entry_point": True},
        {"id": "b", "ip": "1.1.1.2", "zone": "internal", "criticality": 10, "is_crown_jewel": True},
    ]
    reach = [{"src": "a", "dst": "b", "port": 443}]
    findings = [
        {"id": "f1", "asset_id": "b", "port": 443, "remote_exploitable": True, "patch_id": "p1"},
        {"id": "f2", "asset_id": "b", "port": 0, "remote_exploitable": True, "patch_id": "p2"},
    ]
    verdicts = [{"finding_id": "f1", "status": "confirmed"}]
    graph = build_attack_graph(assets, reach, findings, verdicts)
    assert graph.has_edge("a", "b")
    assert graph["a"]["b"]["patch_id"] == "p1"
    assert count_attack_paths(graph) == 1


def test_multiple_findings_on_same_edge_require_all_patches_to_remove_edge():
    g = nx.DiGraph()
    node(g, "entry", entry=True); node(g, "db", crown=True)
    g.add_edge("entry", "db", patch_id="p1", patch_ids=["p1", "p2"], patch_cost=1)
    assert verify_plan(g, ["p1"], raise_on_failure=False)["paths_after"] == 1
    assert verify_plan(g, ["p1", "p2"])["paths_after"] == 0


def test_optimizer_handles_multiple_independent_findings_on_one_edge():
    g = nx.DiGraph()
    node(g, "entry", entry=True); node(g, "db", crown=True)
    g.add_edge("entry", "db", patch_id="p1", patch_ids=["p1", "p2"], patch_cost=1)
    plan = optimize_patches(g)
    assert plan == ["p1", "p2"]
    assert verify_plan(g, plan)["paths_after"] == 0


def test_merged_edge_preserves_individual_patch_costs():
    assets = [
        {"id": "entry", "ip": "10.0.0.1", "zone": "internet", "criticality": 8, "is_entry_point": True},
        {"id": "app", "ip": "10.0.0.2", "zone": "dmz", "criticality": 6},
        {"id": "db", "ip": "10.0.0.3", "zone": "internal", "criticality": 10, "is_crown_jewel": True},
    ]
    reach = [{"src": "entry", "dst": "app", "port": 80}, {"src": "app", "dst": "db", "port": 3306}]
    findings = [
        {"id": "app-vuln", "asset_id": "app", "port": 80, "remote_exploitable": True, "patch_id": "app-fix", "patch_cost": 5},
        {"id": "db-vuln-one", "asset_id": "db", "port": 3306, "remote_exploitable": True, "patch_id": "db-fix-one", "patch_cost": 1},
        {"id": "db-vuln-two", "asset_id": "db", "port": 3306, "remote_exploitable": True, "patch_id": "db-fix-two", "patch_cost": 8},
    ]
    verdicts = [{"finding_id": finding["id"], "status": "confirmed"} for finding in findings]
    graph = build_attack_graph(assets, reach, findings, verdicts)
    assert graph["app"]["db"]["patch_costs"] == {"db-fix-one": 1, "db-fix-two": 8}
    assert optimize_patches(graph) == ["app-fix"]
    assert verify_plan(graph, ["app-fix"])["paths_after"] == 0


def test_greedy_fallback_returns_a_verified_plan():
    g = nx.DiGraph()
    node(g, "entry", entry=True); node(g, "app"); node(g, "db", crown=True)
    edge(g, "entry", "app", "web-fix", 4)
    edge(g, "app", "db", "db-fix", 1)
    plan = optimize_patches(g, use_ilp=False)
    assert plan == ["db-fix"]
    assert verify_plan(g, plan)["valid"]
