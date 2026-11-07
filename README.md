# Patch Min-Cut Planner + Skeptic Agent

A four-person cybersecurity automation prototype that prioritizes fixes by whether evidence supports an attacker path to a critical asset, rather than sorting by CVSS alone. It ingests a contained Docker lab, enriches scanner evidence, challenges findings, builds a bounded attack graph, selects a low-cost set of patches, verifies the modeled paths are cut, and generates an auditable report.

> **Project status:** Persons 1, 2, and 3 are integrated in this repository. Person 4 still owns the FastAPI service, React/Vite/Cytoscape UI, and final demo integration. The command-line pipeline and report work without Person 4's code.

## Why this project

A severe issue on an isolated host may be less urgent than a lower-scored issue that can be used to reach a database. The project combines scan evidence, network reachability, vulnerability metadata, and patch effort estimates to propose a small set of fixes. The optimizer is precisely a **minimum-cost patch hitting-set** problem: selected patches must intersect every modeled entry-point-to-crown-jewel path.

## End-to-end workflow

1. **Person 1 — Lab and ingest:** Docker Compose labs, Nmap open-service scan, Trivy image scan, normalized `scan.json` and `reach.json`.
2. **Person 2 — Enrich:** Cache-first NVD, CISA KEV, and FIRST EPSS lookups. Preserve raw scanner evidence; do not infer a service port from `suggested_ports`.
3. **Person 3 — Skeptic:** One Pydantic `Verdict` per input finding. Deterministic version, exact service/version, open port, topology reachability, NVD CPE range, network attack-vector, and explicitly supplied compensating-control checks run first. LLM use is optional and cannot add findings, invent evidence, or upgrade a rule-based verdict.
4. **Person 2 — Graph and optimize:** Only a remotely exploitable finding with accepted verdict and matching reachability can produce a graph edge. The hitting-set optimizer uses PuLP with a deterministic greedy fallback.
5. **Person 2 — Verify:** Apply chosen patches to a graph copy; a valid modeled plan must leave `paths_after == 0`.
6. **Person 3 — Report:** Generate an escaped, printable Jinja2 HTML report, and optionally PDF, with summary, before/after paths, patch evidence, rejected findings, and limitations.
7. **Person 4 — API/UI/demo:** Consume the JSON handoff outputs, add the API, visualization, and demo experience.

## Team ownership and handoff

- **Person 1:** `lab/`, `ingest/`, `data/mock/`, `scan.json`, `reach.json`.
- **Person 2:** `core/enrich.py`, `core/graph.py`, `core/optimize.py`, `core/verify.py`, `core/pipeline.py`.
- **Person 3:** `skeptic/`, `report/`, and `tests/test_person3_skeptic_report.py`.
- **Person 4:** `api/`, `ui/`, and final demo integration (not included yet).

The frozen data models are in `contracts/models.py`: `Asset`, `Service`, `Finding`, `Verdict`, `Reach`, and `PatchPlan`. Coordinate with the team before changing any field names or types.

```text
P1 scan.json + reach.json
          │
          ▼
P2 core.pipeline → enriched findings.json
          │
          ▼
P3 skeptic.run_skeptic → verdicts + reviewed findings
          │                     │
          ├── P2 graph/optimizer/verifier → graph.json + plan.json
          └── P3 report → report.html (+ optional report.pdf)
                                │
                                ▼
                         P4 API and UI
```

## Requirements

- Python 3.11 or newer (the Windows steps below use Python 3.13).
- Docker Desktop with its engine running only for real lab scans; included mock runs need no Docker.
- Internet access for first-time Docker pulls or live enrichment. Cached/offline mock runs make no network requests.

There is no separate CSV dataset. The Docker labs are the controlled scan target; mock JSON is committed for repeatable development. NVD/KEV/EPSS are enrichment sources, not a manual dataset download.

## Windows PowerShell / VS Code quick start

Open the **repository root** in VS Code. In its PowerShell terminal, install project dependencies into the existing virtual environment (or create it first if it does not exist):

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Run all tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Expected test result in this integrated version: **29 passed**.

### Run both mock labs offline

These commands exercise the full P1→P2→P3 pipeline, including HTML and PDF reports. They do not need Docker or a CVE API key:

```powershell
.\.venv\Scripts\python.exe -m core.pipeline --lab lab_a --mock --offline
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/processed/lab_a/findings.json --output-dir data/processed/lab_a --pdf

.\.venv\Scripts\python.exe -m core.pipeline --lab lab_b --mock --offline
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/processed/lab_b/findings.json --output-dir data/processed/lab_b --pdf
```

For this included mock set, the Skeptic should produce two valid verdicts and a report. **`no_modeled_paths` is an expected, honest result with the default empty offline NVD cache:** the mock data does not establish affected NVD CPE ranges and AV:N evidence, so the system must not invent a network attack path. The report explains that no paths is not proof of safety. Unit/integration tests also exercise a clearly synthetic, fully evidenced chain that results in a selected patch and `paths_after == 0`.

For Person 4's graph/Optimize UI to have a non-empty path in a deterministic local demo, use the separately committed fixture:

```powershell
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/mock/demo/lab_a/findings.json --output-dir data/processed/demo/lab_a --pdf
```

This fixture uses **invented future CVE IDs and fabricated NVD-shaped metadata** and is labelled synthetic throughout. It exercises the software path only; it is not scanner evidence, a real CVE, or a security assessment. The expected result is `verified`, one modeled path before, zero after, with `demo-db-fix` selected.

To produce only HTML, omit `--pdf`. To force the optimizer fallback, add `--greedy` to the Skeptic command.

### Run a real lab scan

With Docker Desktop running, scan Lab A or Lab B first. For example:

```powershell
.\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a
.\.venv\Scripts\python.exe -m core.pipeline --lab lab_a
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/processed/lab_a/findings.json --output-dir data/processed/lab_a --pdf
```

For Lab B, replace `lab_a` with `lab_b`. The scan writes scanner outputs under `data/scans/<lab>/`; enrichment produces `data/processed/<lab>/findings.json`. The enrichment command without `--offline` makes best-effort live requests and caches responses. It can use stale cache or continue without enrichment if a service is unavailable. Stop the lab after a scan with:

```powershell
docker compose -f lab/lab_a/docker-compose.yml down
```

### Optional LLM explanations

No LLM is needed to run the default workflow. To request a cached explanation for downgraded findings, set a compatible chat-completions API configuration in your local shell (never commit a real key):

```powershell
$env:P3_LLM_API_KEY = "YOUR_API_KEY"
$env:P3_LLM_BASE_URL = "https://api.openai.com/v1"
$env:P3_LLM_MODEL = "gpt-4o-mini"
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/processed/lab_a/findings.json --output-dir data/processed/lab_a --llm-explanations --pdf
```

The LLM response is parsed as a `Verdict`, validated, retried once on invalid output, and cached by a hash of the deterministic input. The LLM may keep or downgrade a verdict, never upgrade it, and its evidence must be an exact subset of rule evidence. If the service is unavailable or output invalid, the deterministic verdict is kept. An LLM explanation is not proof of exploitability.

### Optional compensating-control input

A control is considered only when explicitly provided and marked effective and blocking; the program does not discover or validate controls itself. Example `controls.json`:

```json
[
  {
    "finding_id": "asset:CVE-2024-1234:package",
    "name": "verified blocking control",
    "effective": true,
    "blocks_exploitation": true
  }
]
```

Pass it with `--controls controls.json` to the Skeptic command.

## Person 3 rules and outputs

`skeptic/skeptic_rules.py` returns a valid shared `Verdict` for every raw finding. A package finding with `port: 0` is attributed only when its package identity and installed version match an observed service on the same asset; `suggested_ports` alone never count as proof. The service port must also be present in the topology's incoming reach records. A `confirmed` graph finding additionally requires an NVD vulnerable CPE match for the installed version and an NVD network attack vector. Missing or ambiguous metadata is downgraded and marked not remotely exploitable for graph construction. Checks are deterministic triage, not exploit validation.

The Skeptic run writes these files to `data/processed/<lab>/`:

- `verdicts.json`: one auditable shared `Verdict` per raw input finding.
- `reviewed_findings.json`: graph-facing findings with service attribution only where justified.
- `graph.json`: nodes and accepted attack edges for Person 4's visualization.
- `plan.json`: status, paths, selected patches, and independent verification details.
- `report.html`: printable report; `report.pdf` is created when `--pdf` is used.
- `skeptic_result.json`: compact status/count summary for API integration.

The report shows rejected findings with reasons, selected patches with supporting verdict evidence, before/after path counts, and the limitations of the model. `paths_after` must be zero for a status of `verified`. If there are no supported paths before optimization, the system reports `no_modeled_paths` and **0% measured reduction**, not a false 100% success.

## Repository layout

```text
contracts/models.py                  Frozen shared models
lab/lab_a/, lab/lab_b/               Isolated Docker labs
lab/scanner/                         Nmap scanner container
ingest/                               Nmap/Trivy parsing and scan runner
data/mock/                           Synthetic mock scans and reachability
core/enrich.py                        NVD/KEV/EPSS cache
core/graph.py                         Graph and bounded path enumeration
core/optimize.py                      ILP plus greedy patch optimizer
core/verify.py                        Independent plan verification
core/pipeline.py                      P1→P2 handoff
skeptic/skeptic_rules.py              Deterministic P3 rules
skeptic/skeptic_llm.py                Optional validated explanations
skeptic/run_skeptic.py                P3→P2→report orchestration
report/template.html                  Jinja2 report template
report/build_report.py                HTML and optional PDF rendering
tests/                                P1, P2, P3 and integration tests
api/, ui/                             Person 4's remaining deliverables
```

## Safety and honest limitations

The labs contain intentionally old software and must be run only on your own machine and isolated Docker networks. Do not connect them to a real network or scan systems without authorization. The tool runs no exploits. Reachability is modeled from the lab's declared network membership and observed open ports; it is not a general firewall-policy scanner. CVE applicability and software-version parsing can be incomplete, NVD metadata may be unavailable, and a Skeptic verdict does not prove whether a vulnerability is exploitable. Path counts are bounded by the hop limit. Patch costs are effort heuristics. A verified plan means every **modeled** path is cut, not that a real environment is secure.

## Handoff checklist for Person 4

- [x] Frozen contracts and P1/P2 modules retained.
- [x] P3 returns a valid `Verdict` for every supplied finding.
- [x] P3 cannot add findings or allow an LLM to upgrade a verdict.
- [x] Mock P1→P2→P3 run works for both labs offline.
- [x] Graph, plan, verdicts, report HTML, and optional PDF are written as files.
- [x] Verified synthetic chain demonstrates `paths_after == 0` in tests.
- [ ] Person 4 integrates the FastAPI endpoints, React/Vite/Cytoscape interface, and demo mode.
- [ ] Run and rehearse the complete UI demo after Person 4 integration.
