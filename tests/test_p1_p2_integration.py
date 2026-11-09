import json
from pathlib import Path

import pytest

from contracts.models import Finding, Verdict
from core.enrich import prepare_findings_document
from core.pipeline import run_verified_planner

ROOT = Path(__file__).resolve().parents[1]
MOCK = ROOT / "data" / "mock"


def _load_lab(lab_id):
    folder = MOCK / lab_id
    scan = json.loads((folder / "scan.json").read_text(encoding="utf-8"))
    reach = json.loads((folder / "reach.json").read_text(encoding="utf-8"))
    return scan, reach


def test_p1_mock_documents_flow_through_p2_enrichment_without_false_port_mapping(tmp_path):
    scan, reach = _load_lab("lab_a")
    handoff = prepare_findings_document(scan, reach, cache_dir=tmp_path, offline=True)

    assert handoff["stage"] == "awaiting_skeptic_review"
    assert len(handoff["assets"]) == 6
    assert len(handoff["services"]) == 6
    assert len(handoff["reach"]) == len(reach["reach"])
    assert len(handoff["findings"]) == len(scan["raw_findings"])
    # P2 must preserve package evidence without pretending it has a service port.
    assert all(finding["port"] == 0 for finding in handoff["findings"])


@pytest.mark.parametrize(
    ("lab_id", "reviewed_findings"),
    [
        (
            "lab_a",
            [
                Finding(id="f-app", asset_id="app01", port=80, cve="CVE-2021-41773", cvss=7.5,
                        remote_exploitable=True, patch_id="app-fix", patch_cost=2),
                Finding(id="f-db", asset_id="db01", port=3306, cve="CVE-2021-41773", cvss=7.5,
                        remote_exploitable=True, patch_id="db-fix", patch_cost=1),
            ],
        ),
        (
            "lab_b",
            [
                Finding(id="f-jump", asset_id="jump01", port=22, cve="CVE-2021-41773", cvss=7.5,
                        remote_exploitable=True, patch_id="jump-fix", patch_cost=2),
                Finding(id="f-db", asset_id="db01", port=3306, cve="CVE-2021-41773", cvss=7.5,
                        remote_exploitable=True, patch_id="db-fix", patch_cost=1),
            ],
        ),
    ],
)
def test_p1_reachability_plus_p2_graph_optimizer_and_verifier(lab_id, reviewed_findings):
    scan, reach = _load_lab(lab_id)
    verdicts = [
        Verdict(finding_id=finding.id, status="confirmed", confidence=0.95,
                evidence=["integration fixture: port and reachability explicitly reviewed"],
                reasoning="Synthetic test fixture only.")
        for finding in reviewed_findings
    ]

    result = run_verified_planner(
        scan["assets"], reach["reach"], reviewed_findings, verdicts, use_ilp=True
    )

    assert result["status"] == "verified"
    assert result["verification"]["paths_before"] == 1
    assert result["verification"]["paths_after"] == 0
    # The cheaper database patch cuts the only path in both topologies.
    assert result["plan"].patches == ["db-fix"]
    assert result["plan"].risk_reduction_pct == 100.0


def test_no_supported_paths_is_not_reported_as_risk_reduction():
    scan, reach = _load_lab("lab_a")
    result = run_verified_planner(scan["assets"], reach["reach"], [], [], use_ilp=True)

    assert result["status"] == "no_modeled_paths"
    assert result["plan"].paths_before == 0
    assert result["plan"].risk_reduction_pct == 0.0
    assert "not proof" in result["warning"]


def test_planner_refuses_to_skip_skeptic_verdicts():
    scan, reach = _load_lab("lab_a")
    with pytest.raises(ValueError, match="Skeptic verdicts are required"):
        run_verified_planner(scan["assets"], reach["reach"], [], None)


def test_patch_plan_reports_zero_reduction_when_there_was_no_baseline_path():
    import networkx as nx

    from core.verify import make_patch_plan

    graph = nx.DiGraph()
    graph.add_node("entry", is_entry_point=True)
    graph.add_node("db", is_crown_jewel=True)
    plan = make_patch_plan(graph, [])
    assert plan.paths_before == 0
    assert plan.paths_after == 0
    assert plan.risk_reduction_pct == 0.0
