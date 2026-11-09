# FutureForge: Patch Min-Cut Planner + Skeptic Agent
> **Don't patch everything. Cut the path.**

An evidence-bounded cybersecurity platform that prioritizes remediation by whether verified evidence supports an attacker's path to a designated crown jewel, rather than triage based on CVSS severity alone.

FutureForge combines scanner telemetry, network reachability, software identity checks, and an integer linear programming (ILP) optimizer to select the lowest-cost patch combination that interrupts all modeled attack vectors. The plan is then independently verified on a cloned graph copy before any remediation approval is stamped.

---

## 1. Why FutureForge (The Operational Shift)

Conventional vulnerability management drowns engineering and security teams in hundreds of unranked CVSS alerts. A `CVSS 9.8` critical vulnerability on an isolated internal development container with no inbound network access poses zero immediate threat of external compromise. Conversely, a `CVSS 6.5` vulnerability on an edge-facing web server that provides lateral pivoting directly into a production database crown jewel represents an urgent risk.

FutureForge replaces unranked backlogs with **evidence-bounded path disruption**:
1. **Evidence-Bounded Filtering:** A vulnerability only enters the attack graph if our deterministic Skeptic Agent confirms running service identity, open port reachability, and network attack vector applicability (AV:N).
2. **Min-Cut Hitting Set Optimization:** We formulate remediation as an Integer Linear Program (ILP) solved via PuLP and CBC, calculating the exact minimal-cost patch cut that breaks all modeled attack paths.
3. **Independent Verification:** Before stamping any plan, the engine constructs an isolated copy of the graph, removes edges whose required patches are selected, and mathematically asserts that `paths_after == 0`.

---

## 2. Key Features

- **Deterministic Skeptic Agent (`skeptic/`):**
  Evaluates 6 concrete evidence requirements without executing live exploits: (1) target asset exists, (2) service identity and version match, (3) port observed open in Nmap, (4) topology reachability records an active path, (5) NVD CPE version applicability, and (6) NVD CVSS vector specifies Network (AV:N).
- **Mathematical Min-Cut Optimizer (`core/optimize.py`):**
  Binary program minimizing total patch operational cost such that every modeled simple path from an entry point to a crown jewel contains at least one fully patched edge. Features an automatic deterministic greedy fallback.
- **Independent Graph Verifier (`core/verify.py`):**
  Eliminates optimizer self-bias by verifying the plan on a freshly cloned graph copy. Proves that zero simple paths from entry points to crown jewels remain within the bounded 8-hop horizon.
- **"The Evidence Atelier" UI (`ui/`):**
  - **Zero Animation Libraries:** Built strictly compliant with Law 4 using pure CSS keyframes, `@starting-style`, a native Web Animations API (WAAPI) sequencer, and Cytoscape `.animate()`.
  - **3-Tier Interactive Stage:** Physical depth slabs (*Internet*, *DMZ*, *Internal Core*) with mouse parallax, styled nodes, glowing attack paths, and knife-cut dashed glyphs.
  - **7-Second Choreography:** Coordinated cut sequence with glint effects, counter roll-downs, and steady verified seal.
  - **Interactive Sandboxes:** Diamond min-cut simulator, 6-stage assembly line explorer, real JSON specimen viewer, and keyboard shortcuts (`?`, `G`, `Space`, `F`, `1/2/3`).
- **Complete Offline Resilience & Snapshot Fallback (`data/snapshots/`):**
  Pre-compiled frontend bundle in `ui/dist/`, self-hosted typography (`@fontsource`), zero external CDN dependencies, and pre-baked snapshot replay fallback.

---

## 3. Quick Start (1-Click Launch)

The project includes pre-compiled frontend assets in `ui/dist/`. **Node.js is not required** to run the complete platform.

### Windows (1-Click Batch Runner)
Double-click **`run_app.bat`** (or execute in PowerShell):
```powershell
.\run_app.bat
```
*Automatically sets up Python virtual environment, installs dependencies, and launches the unified server at `http://localhost:8000`.*

### macOS / Linux (1-Line Bash Runner)
```bash
chmod +x run_app.sh
./run_app.sh
```

Open your browser to: **http://localhost:8000**

---

## 4. Manual Setup & Execution

### Prerequisites
- Python 3.11, 3.12, or 3.13 installed
- Git

### Step-by-Step Instructions

1. **Clone and Navigate:**
   ```bash
   git clone https://github.com/Gitika-27/DataOps-FurtureForge.git
   cd DataOps-FurtureForge
   ```

2. **Create and Activate Python Virtual Environment:**
   - **Windows:**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements-api.txt
   ```

4. **Launch the Unified Production Server:**
   ```bash
   python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
   ```
   - **Landing Page & Playground:** http://localhost:8000/
   - **Operational Atelier Console:** http://localhost:8000/console
   - **Executive Audit Report:** http://localhost:8000/console/report

---

## 5. Optional Frontend Development (Vite HMR)

If you wish to modify the React / TypeScript UI source code:

1. **Install Node.js dependencies:**
   ```bash
   cd ui
   npm install
   ```

2. **Run in Dual-Process Development Mode:**
   - **Terminal 1 (Backend API):**
     ```bash
     python -m uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
     ```
   - **Terminal 2 (Frontend HMR):**
     ```bash
     cd ui
     npm run dev
     ```
     *Access the live development server at `http://localhost:5173`.*

3. **Rebuild Production Bundle:**
   ```bash
   cd ui
   npm run build
   ```

---

## 6. Automated Testing & Verification

The repository includes a comprehensive 47-test automated verification suite covering both core algorithmic logic and REST API endpoints:

```bash
# Run full backend pytest suite (47 passed)
pytest tests -v
```

```bash
# Run frontend unit tests (Vitest)
cd ui
npm test
```

```bash
# Run headless browser end-to-end interaction test
node scripts/test_ui_interactions.js
```

### Benchmark Metrics (`docs/EVALUATION.md`)
- **Demo Lab A (Synthetic Scenario):**
  - Modeled paths before: `1` → Modeled paths after: `0`
  - Selected patch: `demo-db-fix` (cost: $25)
  - Modeled path reduction: **100.0%**
  - Patch cost savings vs. exhaustive baseline: **50.0%** ($25 vs. $50)
  - Status: `verified` (Pass)
- **Mock Lab A & Lab B (Offline Scans):**
  - Modeled paths before: `0` → Modeled paths after: `0`
  - Status: `no_modeled_paths` (Fail-closed honest result: unpopulated offline NVD cache correctly prevents false positive attack edges).

---

## 7. Team Structure & Ownership

FutureForge was developed across four specialized engineering personas:

- **Person 1 — Lab & Ingestion (`lab/`, `ingest/`):**
  Docker Compose laboratory targets, Nmap service scanning, Trivy container image scanning, and normalization into Pydantic models.
- **Person 2 — Graph, Optimizer & Verifier (`core/`):**
  NVD/KEV/EPSS enrichment cache, NetworkX directed multigraph construction, PuLP/CBC minimum-cost hitting-set solver, and independent graph copy verification.
- **Person 3 — Skeptic Agent & Evidence Ledger (`skeptic/`, `report/`):**
  Deterministic 6-rule verification engine, evidence ledger classification, Jinja2 `report.html`, and one-page PDF report generation.
- **Person 4 — API, User Interface & Demo Orchestration (`api/`, `ui/`, `scripts/`):**
  FastAPI REST backend, React 18 + Vite + Cytoscape visualizer, WAAPI motion sequencer, interactive sandboxes, and offline snapshot fallback.

---

## 8. Intellectual Honesty & Model Boundaries

FutureForge is designed with strict adherence to scientific and engineering honesty:
1. **Bounded Graph Horizon:** Path enumeration (`nx.all_simple_paths`) enforces a default cap of 8 hops. Lateral pivoting beyond 8 hops is outside the bounded model.
2. **Fail-Closed Missing Evidence:** If an asset, service version, open port, or NVD vector cannot be confirmed by scan evidence, the Skeptic downgrades the finding. Missing evidence produces missing attack edges.
3. **Synthetic Demo Stamping:** Demonstration fixtures with `CVE-2099-*` identifiers are explicitly labeled with persistent amber `SYNTHETIC DATA` badges.
4. **No Exploits / No Patch Deployment:** The system proposes and verifies remediation plans; it never executes offensive payloads or deploys patches to live environments.
5. **No False Safety Claims:** A status of `verified` proves that all modeled paths in the bounded graph are cut. It does not claim that a real-world infrastructure is "100% secure" or "zero risk".

---

## 9. Repository Layout

```text
FutureForge/
├── api/                             # FastAPI application & REST routing
│   ├── app.py                       # Application factory & static UI serving
│   ├── routes.py                    # REST API routes (/api/runs, /api/health)
│   ├── service.py                   # Run orchestration & cut edge derivation
│   └── models.py                    # API request and response schemas
├── contracts/
│   └── models.py                    # Immutable frozen Pydantic domain models
├── core/
│   ├── enrich.py                    # Local NVD/KEV/EPSS caching
│   ├── graph.py                     # NetworkX attack graph & simple path discovery
│   ├── optimize.py                  # PuLP/CBC ILP min-cut patch hitting-set solver
│   ├── pipeline.py                  # Handoff normalization pipeline
│   └── verify.py                    # Independent plan verification on cloned graph
├── skeptic/
│   ├── skeptic_rules.py             # Deterministic 6-rule Skeptic evaluation
│   ├── skeptic_llm.py               # Optional cached explanation module
│   └── run_skeptic.py               # Orchestrator for Skeptic, Graph & Report
├── report/
│   ├── build_report.py              # HTML & PDF document compiler
│   ├── template.html                # Jinja2 audit ledger template
│   └── pdf_template.html            # One-page executive PDF summary template
├── ingest/
│   ├── parse_scan.py                # Scanner XML/JSON normalizer
│   └── run_scan.py                  # Nmap & Trivy lab scan runner
├── lab/                             # Isolated Docker Compose lab environments
│   ├── lab_a/                       # 3-tier architecture (Internet, DMZ, Internal)
│   └── lab_b/                       # Alternative jumpbox topology
├── data/
│   ├── mock/                        # Committed offline fixtures & demo dataset
│   └── snapshots/                   # Frozen fallback run bundles for offline demo
├── ui/                              # "The Evidence Atelier" Frontend
│   ├── dist/                        # Pre-compiled production bundle (Node not required)
│   ├── src/                         # Full React 18, TypeScript & Tailwind source
│   ├── package.json                 # UI dependencies & scripts
│   └── vite.config.ts               # Vite configuration
├── tests/                           # 47 automated tests (engine + API)
├── scripts/                         # Packaging, evaluation, and screenshot tools
├── docs/                            # EVALUATION.md benchmarks & technical specs
├── run_app.bat                      # 1-Click Windows execution script
├── run_app.sh                       # 1-Line Unix / macOS execution script
├── requirements-api.txt             # Complete Python dependencies
├── requirements.txt                 # Base engine dependencies
├── API_CONTRACT.md                  # Detailed OpenAPI endpoint specification
├── DEMO_SCRIPT.md                   # 2-minute pitch & operator cue sheet
└── JUDGES_GUIDE.md                  # Hackathon judging guide & mathematical proofs
```

---

## 10. License & Credits

Built by Team **FutureForge** (Persons 1, 2, 3, and 4) for the DataOps Hackathon.  
Tagline: *Don't patch everything. Cut the path.*
