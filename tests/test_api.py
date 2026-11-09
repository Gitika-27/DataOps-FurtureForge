"""Comprehensive test suite for FutureForge FastAPI API endpoints and engine integration."""
from __future__ import annotations

import concurrent.futures
import re
from pathlib import Path
from unittest.mock import patch

import networkx as nx
import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from api.models import RunBundle
from api.service import compute_derived_metrics, strip_nvd_blobs
from core.verify import apply_patches

client = TestClient(create_app())


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert "live_enabled" in data
    assert "live_reason" in data


def test_invalid_lab_rejected():
    response = client.post("/api/runs", json={"lab": "invalid_lab", "mode": "demo"})
    assert response.status_code == 422  # Pydantic validation error


def test_invalid_mode_rejected():
    response = client.post("/api/runs", json={"lab": "lab_a", "mode": "invalid_mode"})
    assert response.status_code == 422


def test_demo_with_lab_b_rejected():
    response = client.post("/api/runs", json={"lab": "lab_b", "mode": "demo"})
    assert response.status_code == 400
    assert "Synthetic demo mode is only available for lab_a" in response.json()["message"]


def test_demo_run_returns_verified_plan():
    response = client.post("/api/runs", json={"lab": "lab_a", "mode": "demo"})
    assert response.status_code == 200
    bundle = response.json()

    assert bundle["status"] == "verified"
    assert bundle["synthetic"] is True
    assert bundle["source"] == "engine"
    assert bundle["plan"]["plan"]["paths_before"] == 1
    assert bundle["plan"]["plan"]["paths_after"] == 0
    assert "demo-db-fix" in bundle["plan"]["plan"]["patches"]

    # Verify cut_edges exist and are valid
    cut_edges = bundle["derived"]["cut_edges"]
    assert len(cut_edges) > 0
    assert any(ce["dst"] == "db01" for ce in cut_edges)

    # Verify baseline metrics
    baseline = bundle["derived"]["baseline"]
    assert baseline is not None
    assert baseline["plan_patches"] == 1
    assert baseline["candidate_patches"] >= 1

    # Verify run_id format
    run_id = bundle["run_id"]
    assert re.match(r"^[a-f0-9]{32}$", run_id)

    # Verify GET by run_id
    get_res = client.get(f"/api/runs/{run_id}")
    assert get_res.status_code == 200
    assert get_res.json()["run_id"] == run_id

    # Verify HTML report retrieval
    report_res = client.get(f"/api/runs/{run_id}/report?format=html")
    assert report_res.status_code == 200
    assert "text/html" in report_res.headers["content-type"]
    assert "Content-Security-Policy" in report_res.headers


def test_mock_lab_a_and_lab_b_return_no_modeled_paths():
    for lab_id in ("lab_a", "lab_b"):
        response = client.post("/api/runs", json={"lab": lab_id, "mode": "mock"})
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["status"] == "no_modeled_paths"
        assert bundle["plan"]["plan"]["paths_before"] == 0
        assert bundle["plan"]["plan"]["paths_after"] == 0
        # In mock offline mode without NVD cache, verdicts are downgraded
        verdicts = bundle["verdicts"]
        assert len(verdicts) > 0
        assert all(v["status"] in ("downgraded", "rejected") for v in verdicts)


def test_cut_edges_matches_apply_patches_logic():
    # Construct a test graph with 2 nodes and an edge
    graph_dict = {
        "nodes": [{"id": "A"}, {"id": "B"}],
        "edges": [
            {
                "src": "A",
                "dst": "B",
                "patch_ids": ["P1"],
                "patch_costs": {"P1": 2},
            }
        ],
    }
    plan_dict = {
        "plan": {
            "patches": ["P1"],
            "paths_before": 1,
            "paths_after": 0,
        }
    }
    derived = compute_derived_metrics(graph_dict, plan_dict)
    assert len(derived.cut_edges) == 1
    assert derived.cut_edges[0].src == "A"
    assert derived.cut_edges[0].dst == "B"
    assert derived.baseline is not None
    assert derived.baseline.candidate_patches == 1
    assert derived.baseline.candidate_cost == 2
    assert derived.baseline.plan_patches == 1
    assert derived.baseline.plan_cost == 2


def test_baseline_is_none_when_no_edges():
    graph_dict = {"nodes": [{"id": "A"}], "edges": []}
    plan_dict = {"plan": {"patches": []}}
    derived = compute_derived_metrics(graph_dict, plan_dict)
    assert derived.baseline is None
    assert len(derived.cut_edges) == 0


def test_strip_nvd_blobs():
    raw = [
        {"id": "F1", "cve": "CVE-1", "nvd": {"giant": "tree", "nested": [1, 2, 3]}},
        {"id": "F2", "cve": "CVE-2"},
    ]
    cleaned = strip_nvd_blobs(raw)
    assert len(cleaned) == 2
    assert "nvd" not in cleaned[0]
    assert cleaned[0]["id"] == "F1"
    assert cleaned[1]["id"] == "F2"


def test_run_id_path_traversal_rejected():
    traversal_ids = [
        "../etc/passwd",
        "../../run",
        "00000000000000000000000000000000/../../x",
        "not-a-32-hex-uuid",
    ]
    for tid in traversal_ids:
        res = client.get(f"/api/runs/{tid}")
        assert res.status_code in (404, 405)
        report_res = client.get(f"/api/runs/{tid}/report")
        assert report_res.status_code in (404, 405)


def test_missing_report_returns_404():
    # Valid hex but non-existent run id
    fake_id = "11111111111111111111111111111111"
    res = client.get(f"/api/runs/{fake_id}/report")
    assert res.status_code == 404


def test_monkeypatched_engine_failure_returns_demo_snapshot():
    # Monkeypatch run_review_pipeline to fail
    with patch("api.service.run_review_pipeline", side_effect=RuntimeError("Simulated engine crash")):
        response = client.post("/api/runs", json={"lab": "lab_a", "mode": "demo"})
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["source"] == "snapshot"
        assert bundle["status"] == "verified"
        assert "Simulated engine crash" in bundle["error"]


def test_aliases_matching_team_guide():
    # First execute a run via alias
    res = client.post("/run?lab=a")
    assert res.status_code == 200
    bundle = res.json()
    assert bundle["status"] == "verified"

    # Now verify /graph, /plan, /report
    graph_res = client.get("/graph")
    assert graph_res.status_code == 200
    assert "nodes" in graph_res.json()

    plan_res = client.get("/plan")
    assert plan_res.status_code == 200
    assert "plan" in plan_res.json()

    report_res = client.get("/report?format=html")
    assert report_res.status_code == 200
    assert "text/html" in report_res.headers["content-type"]


def test_concurrent_runs_do_not_collide():
    def make_run(lab: str):
        c = TestClient(create_app())
        return c.post("/api/runs", json={"lab": lab, "mode": "mock"})

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(make_run, "lab_a"),
            executor.submit(make_run, "lab_b"),
            executor.submit(make_run, "lab_a"),
        ]
        results = [f.result() for f in futures]

    run_ids = set()
    for res in results:
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "no_modeled_paths"
        run_ids.add(data["run_id"])

    # All 3 runs must have distinct unique run_ids
    assert len(run_ids) == 3
