import json
from pathlib import Path

from core.enrich import enrich_findings, fetch_epss, fetch_kev, fetch_nvd


def test_cache_first_offline_enrichment_preserves_raw_finding(tmp_path):
    (tmp_path / "kev").mkdir()
    (tmp_path / "nvd").mkdir()
    (tmp_path / "epss").mkdir()
    (tmp_path / "kev" / "known_exploited_vulnerabilities.json").write_text(
        json.dumps({"vulnerabilities": [{"cveID": "CVE-2024-0001"}]}), encoding="utf-8"
    )
    (tmp_path / "nvd" / "CVE-2024-0001.json").write_text(json.dumps({"vulnerabilities": []}), encoding="utf-8")
    (tmp_path / "epss" / "CVE-2024-0001.json").write_text(
        json.dumps({"data": [{"cve": "CVE-2024-0001", "epss": "0.42"}]}), encoding="utf-8"
    )
    raw = {"id": "f1", "asset_id": "host1", "port": 0, "cve": "CVE-2024-0001", "suggested_ports": [443]}
    result = enrich_findings([raw], cache_dir=tmp_path, offline=True)
    assert result[0]["in_kev"] is True
    assert result[0]["epss"] == 0.42
    assert result[0]["port"] == 0
    assert result[0]["suggested_ports"] == [443]
    assert "nvd" in result[0]


def test_non_cve_is_preserved_without_network_lookup(tmp_path):
    raw = {"id": "f2", "cve": "GHSA-1234", "asset_id": "host1"}
    result = enrich_findings([raw], cache_dir=tmp_path, offline=True)
    assert result[0]["id"] == "f2"
    assert result[0]["enrichment"]["status"] == "skipped"


def test_live_source_responses_are_cached_then_available_offline(tmp_path, monkeypatch):
    calls = []

    def fake_get_json(url):
        calls.append(url)
        if "cisa.gov" in url:
            return {"vulnerabilities": [{"cveID": "CVE-2024-0002"}]}
        if "services.nvd.nist.gov" in url:
            return {"vulnerabilities": [{"cve": {"id": "CVE-2024-0002"}}]}
        if "api.first.org" in url:
            return {"data": [{"cve": "CVE-2024-0002", "epss": "0.27"}]}
        raise AssertionError(f"Unexpected source URL: {url}")

    monkeypatch.setattr("core.enrich._get_json", fake_get_json)
    raw = {"id": "f3", "asset_id": "host2", "port": 0, "cve": "CVE-2024-0002"}
    enriched = enrich_findings([raw], cache_dir=tmp_path, offline=False)
    assert len(calls) == 3
    assert enriched[0]["in_kev"] is True
    assert enriched[0]["epss"] == 0.27
    assert (tmp_path / "kev" / "known_exploited_vulnerabilities.json").exists()
    assert (tmp_path / "nvd" / "CVE-2024-0002.json").exists()
    assert (tmp_path / "epss" / "CVE-2024-0002.json").exists()

    def forbidden_network(_url):
        raise AssertionError("offline cache read attempted a network request")

    monkeypatch.setattr("core.enrich._get_json", forbidden_network)
    offline_result = enrich_findings([raw], cache_dir=tmp_path, offline=True)
    assert offline_result[0]["in_kev"] is True
    assert offline_result[0]["epss"] == 0.27
