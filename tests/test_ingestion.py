import json
from pathlib import Path

from ingest.parse_scan import normalize, parse_nmap_xml, validate_mock

ROOT = Path(__file__).resolve().parents[1]


def test_both_mock_labs_are_valid_and_have_six_assets():
    for lab_id in ("lab_a", "lab_b"):
        assets, services, reach = validate_mock(lab_id)
        assert assets == 6
        assert services >= 5
        assert reach > 0


def test_nmap_parser_keeps_only_open_ports(tmp_path):
    xml = tmp_path / "scan.xml"
    xml.write_text(
        """<?xml version='1.0'?>
<nmaprun>
  <host>
    <status state='up'/>
    <address addr='10.0.0.2' addrtype='ipv4'/>
    <ports>
      <port protocol='tcp' portid='80'><state state='open'/><service name='http' product='nginx' version='1.21.6'/></port>
      <port protocol='tcp' portid='443'><state state='closed'/><service name='https'/></port>
    </ports>
  </host>
</nmaprun>
""",
        encoding="utf-8",
    )
    services = parse_nmap_xml(xml, {"10.0.0.2": "web01"})
    assert services == [
        {"asset_id": "web01", "port": 80, "name": "http", "version": "nginx 1.21.6"}
    ]


def test_normalize_does_not_invent_reachability_or_port_attribution(tmp_path):
    raw_dir = tmp_path / "raw"
    out_dir = tmp_path / "out"
    raw_dir.mkdir()
    inventory = {
        "lab_id": "test",
        "assets": [
            {
                "id": "a", "ip": "10.0.0.2", "interfaces": {"dmz": "10.0.0.2"},
                "zone": "dmz", "criticality": 5, "is_crown_jewel": False,
                "is_entry_point": True,
            },
            {
                "id": "b", "ip": "10.0.0.3", "interfaces": {"dmz": "10.0.0.3"},
                "zone": "dmz", "criticality": 10, "is_crown_jewel": True,
                "is_entry_point": False,
            },
            {
                "id": "c", "ip": "10.1.0.2", "interfaces": {"internal": "10.1.0.2"},
                "zone": "internal", "criticality": 3, "is_crown_jewel": False,
                "is_entry_point": False,
            },
        ],
        "networks": {
            "dmz": {"docker_name": "test-dmz", "asset_ids": ["a", "b"]},
            "internal": {"docker_name": "test-internal", "asset_ids": ["c"]},
        },
    }
    (raw_dir / "inventory.json").write_text(json.dumps(inventory), encoding="utf-8")
    (raw_dir / "nmap_dmz.xml").write_text(
        """<nmaprun>
<host><address addr='10.0.0.2'/><ports><port protocol='tcp' portid='80'><state state='open'/><service name='http' product='nginx' version='1.21.6'/></port></ports></host>
<host><address addr='10.0.0.3'/><ports><port protocol='tcp' portid='3306'><state state='open'/><service name='mysql' product='MariaDB' version='10.6.18'/></port></ports></host>
</nmaprun>""",
        encoding="utf-8",
    )
    (raw_dir / "nmap_internal.xml").write_text(
        "<nmaprun><host><address addr='10.1.0.2'/><ports/></host></nmaprun>",
        encoding="utf-8",
    )
    (raw_dir / "trivy_a.json").write_text(
        json.dumps(
            {
                "Results": [
                    {
                        "Target": "nginx:1.21.6",
                        "Vulnerabilities": [
                            {
                                "VulnerabilityID": "CVE-2099-00001",
                                "PkgName": "nginx",
                                "InstalledVersion": "1.21.6",
                                "FixedVersion": "1.21.7",
                                "Severity": "HIGH",
                                "CVSS": {"nvd": {"V3Score": 8.0}},
                            }
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    scan_path, reach_path = normalize(raw_dir, out_dir)
    scan = json.loads(scan_path.read_text(encoding="utf-8"))
    reach = json.loads(reach_path.read_text(encoding="utf-8"))["reach"]

    assert {s["asset_id"] for s in scan["services"]} == {"a", "b"}
    assert {tuple((edge["src"], edge["dst"], edge["port"])) for edge in reach} == {
        ("a", "b", 3306),
        ("b", "a", 80),
    }
    assert scan["raw_findings"][0]["port"] == 0
    assert scan["raw_findings"][0]["suggested_ports"] == [80]
    assert scan["raw_findings"][0]["cvss"] == 8.0
