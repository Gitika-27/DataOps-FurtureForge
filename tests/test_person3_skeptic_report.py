import json
import re
from pathlib import Path

import pytest

from contracts.models import Finding, Verdict
from report.build_report import build_report_context, write_report
from skeptic.run_skeptic import run_review_pipeline
from skeptic.skeptic_llm import explain_verdict
from skeptic.skeptic_rules import review_finding, review_findings

ROOT = Path(__file__).resolve().parents[1]


def assert_one_pdf_page(path: Path):
    pdf = path.read_bytes()
    assert len(re.findall(rb"/Type\s*/Page(?!s)", pdf)) == 1


def _nvd(package="apache", product="http_server", version="2.4.49", vector="NETWORK"):
    return {
        "vulnerabilities": [{
            "cve": {
                "id": "CVE-2021-41773",
                "configurations": [{"nodes": [{"cpeMatch": [{
                    "vulnerable": True,
                    "criteria": f"cpe:2.3:a:{package}:{product}:{version}:*:*:*:*:*:*:*",
                }]}]}],
                "metrics": {"cvssMetricV31": [{"cvssData": {"attackVector": vector}}]},
            }
        }]
    }


def _base_inputs():
    assets = [
        {"id": "internet", "ip": "10.0.0.1", "zone": "internet", "criticality": 8, "is_entry_point": True},
        {"id": "app", "ip": "10.0.0.2", "zone": "dmz", "criticality": 7},
        {"id": "db", "ip": "10.0.0.3", "zone": "internal", "criticality": 10, "is_crown_jewel": True},
    ]
    services = [
        {"asset_id": "app", "port": 80, "name": "http", "version": "Apache httpd 2.4.49"},
        {"asset_id": "db", "port": 3306, "name": "mysql", "version": "MariaDB 10.6.18"},
    ]
    reach = [{"src": "internet", "dst": "app", "port": 80}, {"src": "app", "dst": "db", "port": 3306}]
    raw = {
        "id": "app-cve", "asset_id": "app", "port": 0, "suggested_ports": [80],
        "cve": "CVE-2021-41773", "cvss": 7.5, "package_name": "apache-httpd",
        "installed_version": "2.4.49", "fixed_version": "2.4.51", "nvd": _nvd(),
    }
    return assets, services, reach, raw


def test_confirm_only_when_exact_service_version_reachable_cpe_and_network_vector_match():
    assets, services, reach, raw = _base_inputs()
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach)
    assert verdict.status == "confirmed"
    assert finding is not None
    assert finding.port == 80
    assert finding.remote_exploitable is True
    assert any("NVD vulnerable CPE" in item for item in verdict.evidence)


def test_suggested_port_alone_does_not_attribute_image_finding():
    assets, services, reach, raw = _base_inputs()
    services[0]["version"] = "Apache httpd 2.4.54"
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach)
    assert verdict.status == "rejected"
    assert finding is None
    assert any("suggested ports were not treated as proof" in item for item in verdict.evidence)


def test_fixed_version_or_nvd_cpe_mismatch_rejects_finding():
    assets, services, reach, raw = _base_inputs()
    raw["installed_version"] = "2.4.54"
    raw["fixed_version"] = "2.4.51"
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach)
    assert verdict.status == "rejected"
    assert finding is None


def test_no_topology_reachability_rejects_network_use():
    assets, services, _, raw = _base_inputs()
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=[])
    assert verdict.status == "rejected"
    assert finding is None
    assert any("No ingested reachability" in item for item in verdict.evidence)


def test_nvd_non_network_vector_is_downgraded_and_not_graph_exploitable():
    assets, services, reach, raw = _base_inputs()
    raw["nvd"] = _nvd(vector="LOCAL")
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach)
    assert verdict.status == "downgraded"
    assert finding is not None
    assert finding.remote_exploitable is False


def test_explicit_effective_blocking_control_excludes_finding_from_graph():
    assets, services, reach, raw = _base_inputs()
    control = {"finding_id": raw["id"], "name": "verified WAF rule", "effective": True, "blocks_exploitation": True}
    verdict, finding = review_finding(raw, assets=assets, services=services, reach=reach, controls=[control])
    assert verdict.status == "rejected"
    assert finding is None
    assert "verified WAF rule" in " ".join(verdict.evidence)


def test_one_verdict_is_returned_per_input_and_no_raw_finding_is_added():
    assets, services, reach, raw = _base_inputs()
    rejected = {"id": "bad", "asset_id": "missing", "cve": "CVE-2024-0001"}
    verdicts, findings = review_findings([raw, rejected], assets=assets, services=services, reach=reach)
    assert len(verdicts) == 2
    assert [v.finding_id for v in verdicts] == ["app-cve", "bad"]
    assert all(isinstance(item, Finding) for item in findings)


def test_llm_retries_once_and_caches_only_valid_bounded_verdict(tmp_path):
    base = Verdict(finding_id="x", status="downgraded", confidence=0.7,
                   evidence=["deterministic evidence"], reasoning="Rule-based uncertain result.")
    calls = []

    def responder(_):
        calls.append(1)
        if len(calls) == 1:
            return {"bad": "not a Verdict"}
        return {"finding_id": "x", "status": "downgraded", "confidence": 0.6,
                "evidence": ["deterministic evidence"], "reasoning": "Explained using only supplied evidence."}

    result = explain_verdict(base, cache_dir=tmp_path, request_fn=responder)
    assert result.reasoning == "Explained using only supplied evidence."
    assert len(calls) == 2
    cached = explain_verdict(base, cache_dir=tmp_path, request_fn=lambda _: pytest.fail("cache should be used"))
    assert cached == result


def test_llm_cannot_upgrade_status_or_invent_evidence_and_fails_closed(tmp_path):
    base = Verdict(finding_id="x", status="downgraded", confidence=0.7,
                   evidence=["known fact"], reasoning="Rule-based uncertain result.")
    calls = []

    def invalid(_):
        calls.append(1)
        return {"finding_id": "x", "status": "confirmed", "confidence": 0.99,
                "evidence": ["invented fact"], "reasoning": "Unsafe upgrade."}

    result = explain_verdict(base, cache_dir=tmp_path, request_fn=invalid)
    assert result == base
    assert len(calls) == 2


def test_report_html_escapes_untrusted_strings_and_contains_audit_sections(tmp_path):
    verdict = Verdict(finding_id="<script>alert(1)</script>", status="rejected", confidence=0.9,
                      evidence=["closed port"], reasoning="Not reachable.")
    plan = {"patches": [], "paths_before": 0, "paths_after": 0, "risk_reduction_pct": 0.0}
    context = build_report_context(lab_id="lab_a", verdicts=[verdict], findings=[], plan=plan,
                                   status="no_modeled_paths", synthetic=True)
    html_path, pdf_path = write_report(context, tmp_path / "report.html", output_pdf=tmp_path / "report.pdf")
    html = html_path.read_text(encoding="utf-8")
    assert "&lt;script&gt;" in html
    assert "Rejected findings" in html
    assert "Limitations" in html
    assert pdf_path is not None and pdf_path.exists() and pdf_path.stat().st_size > 1000
    assert_one_pdf_page(pdf_path)


def test_complete_p1_p2_p3_chain_builds_and_verifies_graph_then_report(tmp_path):
    assets, services, reach, app = _base_inputs()
    db = {
        "id": "db-cve", "asset_id": "db", "port": 0, "suggested_ports": [3306],
        "cve": "CVE-2021-41773", "cvss": 7.5, "package_name": "mariadb",
        "installed_version": "10.6.18", "fixed_version": "10.6.19", "nvd": _nvd("mariadb", "mariadb", "10.6.18"),
    }
    app["patch_id"], app["patch_cost"] = "app-fix", 3
    db["patch_id"], db["patch_cost"] = "db-fix", 1
    document = {
        "schema_version": 1, "lab_id": "lab_a", "generated_at": "synthetic test",
        "assets": assets, "services": services, "reach": reach,
        "findings": [app, db], "notes": ["SYNTHETIC TEST DATA"],
    }
    result = run_review_pipeline(document, output_dir=tmp_path, create_pdf=True)

    assert result["status"] == "verified"
    assert result["paths_before"] == 1
    assert result["paths_after"] == 0
    assert result["patches"] == ["db-fix"]
    for name in ("verdicts.json", "reviewed_findings.json", "graph.json", "plan.json", "report.html", "report.pdf", "skeptic_result.json"):
        assert (tmp_path / name).exists()
    plan_doc = json.loads((tmp_path / "plan.json").read_text(encoding="utf-8"))
    assert plan_doc["verification"]["valid"] is True


def test_committed_synthetic_demo_fixture_produces_verified_plan_and_report(tmp_path):
    fixture = ROOT / "data" / "mock" / "demo" / "lab_a" / "findings.json"
    document = json.loads(fixture.read_text(encoding="utf-8"))
    result = run_review_pipeline(document, output_dir=tmp_path, create_pdf=True)
    assert result["status"] == "verified"
    assert result["paths_before"] == 1
    assert result["paths_after"] == 0
    assert result["patches"] == ["demo-db-fix"]
    report = (tmp_path / "report.html").read_text(encoding="utf-8")
    assert "SYNTHETIC DEMO FIXTURE ONLY" in report
    assert (tmp_path / "report.pdf").stat().st_size > 1000
    assert_one_pdf_page(tmp_path / "report.pdf")
