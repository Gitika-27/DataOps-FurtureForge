# Patch Min-Cut Planner + Skeptic Agent

A four-person security automation prototype that prioritizes vulnerability remediation by **whether a finding blocks an attack path to a critical asset**, not by severity score alone. The system builds an attack graph from scan and reachability data, challenges scanner findings with evidence, and proposes a low-cost set of patches. It then verifies that the proposed plan leaves no modeled path from an entry point to a crown jewel.

> **Project status:** Person 1's lab/ingestion and Person 2's enrichment/graph/optimizer/verification modules are present. Person 3's Skeptic/report and Person 4's API/UI/demo modules are still separate team deliverables. The mock pipeline and P1→P2 integration tests are available now.

## Why this project

A critical vulnerability on an isolated machine may be less urgent than a medium-severity vulnerability that an attacker can use to reach a database. Conventional severity sorting does not explain which small set of fixes would cut every modeled path to important assets. This project combines network context, vulnerability evidence, and patch-cost optimization to help a team focus its remediation effort.

The term “min-cut style” is useful for the pitch, but the optimizer is more precisely a **minimum-cost hitting-set problem**: each candidate patch may remove multiple attack edges, and the chosen patch set must touch every entry-point-to-crown-jewel path.

## End-to-end workflow

1. **Lab and ingest:** Start one of the local Docker lab variants. Nmap identifies open services; Trivy scans container images. The parser writes normalized assets, services, raw findings, and reachability data.

1. **Enrich:** Look up CVE details from NVD, whether a CVE appears in CISA KEV, and EPSS exploitation probability. Cache responses for repeatable, offline-friendly runs.

1. **Challenge findings:** Apply deterministic checks first, such as affected-version range, observed open port, reachability, and compensating controls. Use an LLM only for ambiguous cases or explanations. Validate its output against the shared `Verdict` model; it may downgrade or reject a finding but must not invent new findings.

1. **Build the attack graph:** Treat assets as nodes. Add an edge only when reachability and a sufficiently supported remotely exploitable finding justify it. Keep the patch identifier on each edge.

1. **Optimize:** Use integer linear programming to select the lowest-cost set of patches that intersects every modeled attack path. Keep a greedy fallback for solver failures.

1. **Verify:** Apply the plan to a copy of the graph and recalculate reachability. A valid plan must leave zero paths from any entry point to any crown jewel.

1. **Report and visualize:** Show the graph before and after, path counts, the patch plan with evidence, rejected findings and reasons, and the project’s limitations.

## Team ownership

- **Person 1 — Lab + ingestion:** Docker Compose labs, scanner runner, Nmap/Trivy parsing, `scan.json` and `reach.json`, mock fallback data.

- **Person 2 — Enrichment + graph + optimizer:** NVD/KEV/EPSS cache, graph construction, path enumeration, minimum hitting-set optimizer, greedy fallback, and verification.

- **Person 3 — Skeptic + report:** Deterministic skeptic rules, carefully bounded LLM use, validated verdicts, and HTML/PDF report generation.

- **Person 4 — API + UI + demo:** FastAPI integration, React/Vite/Cytoscape interface, demo mode, final integration, pitch, and backup demo.

Keep `contracts/models.py` stable. Discuss and agree with the whole team before changing a field name or type. Each module should work against the mock data before full integration.

## Data handoff and contracts

The shared models are in `contracts/models.py`: `Asset`, `Service`, `Finding`, `Verdict`, `Reach`, and `PatchPlan`.

The planned handoff is:

```
scan.json + reach.json  →  enriched findings  →  verdicts.json
       Person 1                  Person 2          Person 3
                                                   ↓
                  graph + verified plan  →  report and UI
                         Person 2             Persons 3–4
```

`scan.json` contains assets, observed services, and scanner-native `raw_findings`. `reach.json` contains `{ "src", "dst", "port" }` records. Agree on exact file paths and the input shape with the other module owners before integration.

**Important:** A Trivy image/package CVE is evidence that a package in an image may be vulnerable; it is not by itself proof of a remotely reachable service vulnerability. In the current ingestion output, `port: 0` means no service port has been justified for that raw finding. The Skeptic/graph pipeline must check package/version evidence and service context before turning it into an attack-graph edge.


## Person 2 core modules

The enrichment, graph, optimization, verification, and P1→P2 handoff modules live in `core/`.
Run the complete local test suite, including the P1→P2 integration tests, with:

```bash
python -m pip install -r requirements.txt
python -m pytest -q
```

On Windows PowerShell with the project's Python 3.13 virtual environment, use:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

`core.enrich.enrich_scan(scan, offline=True)` uses existing JSON files in `cache/`
without making network requests. Online mode fetches NVD CVE details, the CISA KEV
catalog, and FIRST EPSS scores, then caches each response. `offline=False` is the
default; `offline=True` is recommended for a repeatable demo.

To combine a P1 mock scan and reachability file with P2 enrichment, run:

```powershell
.\.venv\Scripts\python.exe -m core.pipeline --lab lab_a --mock --offline
```

This writes `data/processed/lab_a/findings.json`, preserving the P1 assets,
services, and reach records while attaching any cached enrichment. To process a
real scan from `data/scans/lab_a/`, omit `--mock`. Omit `--offline` only when you
want P2 to make live enrichment requests. The document is marked
`awaiting_skeptic_review`; it is not yet a confirmed attack graph or patch plan.

`core.graph.build_attack_graph(assets, reach, findings, verdicts)` implements the
guide's edge rule. If verdicts are supplied, only `confirmed` and `downgraded`
findings are accepted. A finding must be remotely exploitable and have a real
service port matching the destination reachability record. In particular, the
ingestion contract's `port: 0` and `suggested_ports` are not proof of service
attribution and are not converted into graph edges. This protects the graph from
turning image/package evidence into an unsupported network exploit claim.

The optimizer enumerates simple entry-point-to-crown-jewel paths with an 8-hop
default cap, solves the minimum-cost patch hitting-set with PuLP when available,
and falls back to a deterministic greedy method. `core.verify.verify_plan` then
independently applies the patches to a graph copy and checks that no bounded
attack paths remain. The shared `contracts/models.py` is unchanged.

`core.pipeline.run_verified_planner(...)` is the integration entry point for
port-specific `Finding` objects and their P3 `Verdict` objects. It refuses to
plan if verdicts are missing. Its P1/P2 integration tests use the included mock
reachability records plus explicitly synthetic, reviewed findings to check that
Lab A and Lab B each produce a path, choose a low-cost patch, and verify zero
remaining paths. These fixtures test the integration seam; they are not scanner
evidence. An end-to-end real-scan-to-plan run still requires Person 3 to provide
the reviewed findings and verdicts.
