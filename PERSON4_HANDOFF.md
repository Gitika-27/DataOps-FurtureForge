# Person 4 Handoff — Patch Min-Cut Planner

This note is the implementation handoff from Persons 1–3 to Person 4. It describes the code that exists now, its input/output files, how to run it from VS Code on Windows, and the remaining API/UI/demo work.

## Current state in one minute

Persons 1–3 have an integrated command-line pipeline and a tested report flow. The current suite has **33 passing tests**. The branch still needs Person 4's FastAPI API, React/Vite/Cytoscape UI, and demo integration. A real Docker/Nmap/Trivy run and real live NVD/KEV/EPSS fetch still need confirmation on the team's Windows machine; synthetic fixtures are not proof of those external runs.

The ordinary offline mock pipeline intentionally returns `no_modeled_paths`: the default empty offline NVD cache cannot confirm CPE applicability and a network attack vector, so the Skeptic does not invent graph edges. For UI development, a separate, clearly labelled synthetic fixture produces a non-empty graph, a verified plan, and a one-page PDF. It uses fake future CVE IDs and is **not** a real security finding.

## Person 4 scope from the team guide

Person 4 owns:

- FastAPI endpoints: `POST /run?lab=a`, `GET /graph`, `GET /plan`, and `GET /report`.
- React + Vite + Cytoscape.js UI: zone-coloured nodes, highlighted crown jewels, red attack paths, an Optimize action/animation, a before/after counter, and an evidence panel for patches/findings.
- A demo-mode toggle that reads committed synthetic/cached inputs so Wi-Fi/API failures do not break the demo.
- Final integration, two-minute pitch/demo, rehearsal, and a recorded backup demo.

Do not modify `contracts/models.py` without agreement from all owners. Do not calculate a second, different optimizer in the browser; display the backend's reviewed graph and verified plan.

## What the existing stages produce

### P1 inputs and outputs

A real P1 scan is started from the repository root:

```powershell
.\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a
```

Use `lab_b` for the alternate lab. P1 starts the Compose services (unless `--no-start` is specified), collects Docker inventory, runs Nmap and Trivy, and normalizes results to `data/scans/<lab>/scan.json` and `data/scans/<lab>/reach.json`. The lab remains running at the end; stop it with:

```powershell
docker compose -f lab/lab_a/docker-compose.yml down
```

The committed `data/mock/<lab>/scan.json` and `reach.json` are synthetic normalized inputs for Docker-free work. `data/mock/scanner-format/<lab>/` contains **synthetic Nmap XML / Trivy JSON / inventory fixtures**, not captures from a real scan. They exercise the parser offline:

```powershell
.\.venv\Scripts\python.exe -m ingest.parse_scan --raw-dir data/mock/scanner-format/lab_a --output-dir data/processed/parser-check/lab_a
.\.venv\Scripts\python.exe -m ingest.parse_scan --raw-dir data/mock/scanner-format/lab_b --output-dir data/processed/parser-check/lab_b
```

### P2 enrichment handoff

For a repeatable Docker-free run, prepare the P2 document from the normalized mocks using cache-only mode:

```powershell
.\.venv\Scripts\python.exe -m core.pipeline --lab lab_a --mock --offline
```

This writes `data/processed/lab_a/findings.json`. Use `lab_b` for the other mock. Its top-level shape is:

```json
{
  "schema_version": 1,
  "lab_id": "lab_a",
  "assets": [],
  "services": [],
  "findings": [],
  "reach": [],
  "stage": "awaiting_skeptic_review",
  "notes": []
}
```

`findings` are still scanner-native records enriched with NVD/KEV/EPSS fields; they are **not yet approved** `Finding` model instances. An image/package record with `port: 0` remains unattributed until P3 has enough service evidence. `suggested_ports` alone are never proof. P2's live API responses are cache-first under `cache/`; `--offline` makes no network requests. An empty cache intentionally yields unavailable enrichment.

### P3 review, graph, plan, and report

Run Person 3 on a P2 handoff:

```powershell
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/processed/lab_a/findings.json --output-dir data/processed/lab_a --pdf
```

P3 returns one shared `Verdict` per raw finding. The deterministic rules check target asset, installed/fixed version where available, same-asset service identity/version, observed service port, topology reachability, NVD CPE version applicability, and NVD network attack vector. A `confirmed` graph candidate requires the package version to match an observed service, the service port to be reachable, the NVD vulnerable CPE range to include the version, and an NVD AV:N vector. Ambiguous package-only data is downgraded/not remotely exploitable for graph purposes. The rules do not run exploits or independently test firewall policy.

P3 writes these backend-consumable artifacts to the output directory:

| File | Shape/use |
|---|---|
| `verdicts.json` | `{ "lab_id": ..., "verdicts": [Verdict, ...] }`; join a `Verdict.finding_id` to a finding ID. |
| `reviewed_findings.json` | `{ "lab_id": ..., "findings": [Finding, ...] }`; only justified service-port candidates appear here. |
| `graph.json` | `{ "nodes": [...], "edges": [...] }`. Node IDs are asset IDs. Edge fields include `src`, `dst`, `patch_ids`, `finding_ids`, `ports`, and per-patch costs. Join `finding_ids` to verdicts for evidence. |
| `plan.json` | Contains `status`, `warning`, nested `plan` (`patches`, `paths_before`, `paths_after`, `risk_reduction_pct`), independent `verification`, and bounded `paths`. |
| `skeptic_result.json` | Compact counts/status plus output paths, useful for the API response. |
| `report.html` | Detailed, escaped evidence ledger. |
| `report.pdf` | Optional one-page executive summary when `--pdf` is supplied. |

The graph is a simple directed graph: an edge `A → B` is emitted only when a reviewed remotely exploitable finding is on `B:port` and the ingested reach data includes `A → B` on that port. Multiple independent findings on the same edge require all associated patch IDs to cut that edge. Costs are per patch ID. The path count is capped at 8 hops by default.

Treat status values distinctly:

- `verified`: the optimizer plan passed independent verification; `paths_after` must be zero for the bounded modeled graph.
- `no_modeled_paths`: there was no supported path before optimization. Show a warning; do **not** call it a successful 100% remediation or proof of safety.
- `invalid`: do not display as an approved plan; report the failure to verify.

`risk_reduction_pct` is a percentage of **modeled path-count reduction**, not a CVSS/EPSS weighted measure of all risk.

## Demo inputs for the UI

### Deterministic non-empty UI graph

Use this fixture for a reliable graph/Optimize animation:

```powershell
.\.venv\Scripts\python.exe -m skeptic.run_skeptic --input data/mock/demo/lab_a/findings.json --output-dir data/processed/demo/lab_a --pdf
```

Expected result: `verified`, one modeled path before, zero after, and `demo-db-fix` selected. The file deliberately uses invented future CVE identifiers and fabricated NVD-shaped data. The UI should display the synthetic-data warning from `report.html`; never represent this fixture as a real scan or real CVE evidence.

### Normal offline mock

Run the P1 mock → P2 → P3 commands in the README for both lab IDs. The present mock findings do not have usable NVD CPE/AV:N evidence, so `no_modeled_paths` is an expected, safe outcome. This is good for demonstrating the system's fail-closed rule, but the synthetic demo fixture is better for showing the animation and patch selection.

## Suggested API integration pattern

Use `core.pipeline.prepare_lab_findings(...)` and `skeptic.run_skeptic.run_review_pipeline(...)` rather than invoking shells from FastAPI. A route handler can prepare a selected fixed lab, load its JSON, and call the integrated P3 orchestration:

```python
from pathlib import Path
import json
from core.pipeline import prepare_lab_findings
from skeptic.run_skeptic import run_review_pipeline

handoff_path = prepare_lab_findings("lab_a", mock=True, offline=True)
document = json.loads(handoff_path.read_text(encoding="utf-8"))
result = run_review_pipeline(
    document,
    output_dir=Path("data/processed/lab_a"),
    create_pdf=True,
)
```

Use a whitelist of `lab_a` and `lab_b`; do not expose arbitrary filesystem paths or arbitrary scan targets through the demo API. For demo mode, load `data/mock/demo/lab_a/findings.json` directly and mark the response as synthetic. For live mode, P1 scan/Docker can take time; avoid blocking a web request indefinitely (use a job/status pattern or return an appropriate timeout/status).

Suggested route behavior:

- `POST /run?lab=a` (and `lab=b`) starts a run for a fixed lab. Return the stage/status and result paths; document whether the run is mock or live.
- `GET /graph` returns graph nodes/edges plus run status; preserve finding IDs for evidence joins.
- `GET /plan` returns `plan.json`; display `verification.valid` and `paths_after` explicitly.
- `GET /report` serves the generated HTML report (or offer PDF via a documented format parameter).

## Person 4 acceptance checklist

- [ ] API uses fixed lab IDs, never scans arbitrary targets, and distinguishes real vs synthetic mode.
- [ ] `POST /run` produces the P1→P2→P3 output files and a stable status.
- [ ] `GET /graph`, `/plan`, and `/report` serve the generated artifacts with the contracts above.
- [ ] UI highlights zone, entry points, and crown jewels; connects edge IDs to findings/verdict evidence.
- [ ] Optimize animation only presents a verified result; `no_modeled_paths` is shown as “no modeled path,” not “safe.”
- [ ] UI can load the synthetic demo fixture without internet and visibly labels its synthetic data.
- [ ] Normal offline Lab A and Lab B workflows continue to run.
- [ ] Full `pytest -q` passes after P4 integration.
- [ ] Demo has been run and rehearsed twice; record a backup video as required by the team guide.

## Known boundaries handed to Person 4

- The real Docker scan and real public API fetch should be confirmed on the team's Windows machine; the committed fallback inputs are synthetic.
- Current version matching is a conservative dotted-numeric implementation, not a package-manager-aware semantic-version engine. Review any critical real result manually.
- P3's control input is explicitly supplied JSON; the tool does not discover or independently verify compensating controls.
- The NVD CPE parsing and AV:N check are deterministic prototype rules, not proof of exploitability; no exploit is executed.
- The one-page PDF is designed for the included small lab/demo. The accompanying HTML preserves the complete ledger for review.
