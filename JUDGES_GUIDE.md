# FutureForge — Judges' Guide & Technical Architecture

**Product:** Patch Min-Cut Planner + Skeptic Agent  
**Team:** FutureForge  
**Tagline:** *Don't patch everything. Cut the path.*  
**Lead Engineer / Persona 4:** Antigravity Agent  

---

## 1. Executive Summary & Problem Statement

Modern vulnerability scanners generate overwhelming lists of CVEs. Security teams frequently face backlogs of tens of thousands of vulnerabilities, leading to paralysis, patch fatigue, and arbitrary prioritization based solely on CVSS severity. 

**CVSS severity alone fails to answer the fundamental remediation question:**
> *"Which specific remediation actions interrupt the actual attack paths to our critical assets at minimal operational cost and disruption?"*

A high-severity CVSS 9.8 flaw on an internal service isolated from network routing cannot be exploited by an external attacker. Conversely, a medium-severity vulnerability on an exposed edge server may serve as the critical gateway in a multi-hop lateral compromise leading to the crown jewel database.

**FutureForge solves this problem through a 4-part architecture:**
1. **The Skeptic Agent:** Deterministically reviews raw findings against ground truth evidence (observed service ports, software versions, NVD CPE ranges, and reachability), downgrading non-exploitable noise.
2. **Evidence-Bounded Attack Graph:** Constructs a simple directed graph containing only reachable, confirmed attack steps, capped at 8 hops.
3. **Cost-Aware Min-Cut Optimizer:** Formulates remediation as an Integer Linear Program (ILP via PuLP) that minimizes patch effort while breaking all modeled attack paths.
4. **Independent Verification:** Re-evaluates the resulting graph on an independent copy to mathematically verify that zero attack paths remain.

---

## 2. End-to-End Pipeline Architecture

```
[ Ingested Scans (P1) ]
         │ (Nmap XML, Trivy JSON, Docker Inventory)
         ▼
[ Enrichment Handoff (P2) ]
         │ (NVD, CISA KEV, FIRST EPSS Cache-First Enrichment)
         ▼
[ Skeptic Agent Review (P3) ]
         │ (Deterministic rules: service identity, port, CPE, AV:N)
         ▼
[ Attack Graph Builder (P2) ]
         │ (DiGraph: Reach A→B on P + accepted finding on B:P)
         ▼
[ Min-Cut Optimizer (P2) ]
         │ (PuLP binary program: min sum(cost) s.t. all paths cut)
         ▼
[ Independent Verifier (P2) ]
         │ (apply_patches -> recount paths == 0)
         ▼
[ FastAPI + React/Cytoscape UI (P4) ]
```

---

## 3. How the Engine Actually Works (Code Realities)

### 3.1 The Skeptic Agent (`skeptic/skeptic_rules.py`)
- Emits exactly one deterministic `Verdict` per raw finding (`confirmed`, `downgraded`, or `rejected`).
- **Checks executed:**
  1. Asset target existence in scan inventory.
  2. Installed vs. fixed version comparison.
  3. Service identity and exact dotted-numeric version match on the asset.
  4. Observed listening service port (suggested ports alone are never proof). Port 0 container image findings remain unattributed.
  5. Topology reachability into the asset on that port.
  6. NVD CPE version applicability range.
  7. NVD attack vector check (must be `NETWORK` / `AV:N`).
- **Fail-Closed Rule:** In the absence of positive evidence (e.g., an empty offline NVD cache), findings are downgraded to non-exploitable for attack graph purposes. This is an intentional security design.

### 3.2 Graph Construction (`core/graph.py`)
- Nodes represent assets with assigned zones (`internet`, `dmz`, `internal`) and criticality (1–10).
- An edge `A → B` is emitted **only when**:
  1. An accepted finding (`confirmed` or `downgraded`) exists on asset `B`.
  2. The finding is marked `remote_exploitable == True`.
  3. Network reachability data confirms that `A` can reach `B` on that specific service port.
- Path enumeration utilizes NetworkX simple paths from designated entry points (`is_entry_point`) to crown jewels (`is_crown_jewel`), capped at 8 hops.

### 3.3 The Min-Cut Optimizer (`core/optimize.py`)
- Formulated as a binary integer program using PuLP (CBC solver) with a deterministic greedy fallback.
- **Objective:** Minimize $\sum (\text{cost}_p \times x_p)$ over candidate patch variables $x_p \in \{0, 1\}$.
- **Constraints:** For every enumerated attack path $P$, at least one edge in $P$ must be fully patched. If an edge has multiple associated findings, all required patch IDs must be applied to eliminate that edge.

### 3.4 Independent Verification (`core/verify.py`)
- Patches selected by the optimizer are applied to a deep copy of the attack graph using `apply_patches`.
- Simple paths from all entry points to all crown jewels are re-enumerated.
- A plan is marked `"verified"` **only if** `paths_after == 0`.
- If no supported paths existed before optimization, the status is `"no_modeled_paths"` with 0% reduction, never misleadingly reported as 100% protection.

---

## 4. Benchmark & Evaluation Results (Real Engine Output)

*Data sourced directly from automated evaluation on team hardware (`docs/EVALUATION.md`):*

| Scenario | Status | Findings | Verdicts (C/D/R) | Graph Nodes | Graph Edges | Paths (Before → After) | Patches Selected | Verification Result |
|---|---|---|---|---|---|---|---|---|
| **Synthetic Demo (Lab A)** | `verified` | 2 | 2 / 0 / 0 | 6 | 4 | **1 → 0** | `demo-db-fix` (cost $1) | **PASSED** (0 remaining) |
| **Offline Mock (Lab A)** | `no_modeled_paths` | 2 | 0 / 2 / 0 | 6 | 0 | 0 → 0 | *None* | **PASSED** (cautious fail-closed) |
| **Offline Mock (Lab B)** | `no_modeled_paths` | 2 | 0 / 2 / 0 | 6 | 0 | 0 → 0 | *None* | **PASSED** (cautious fail-closed) |

---

## 5. User Interface & Evidence Atelier Highlights (Persona 4)

- **Pure CSS & WAAPI Motion System (Law 4):** Zero third-party animation libraries (no Framer Motion, GSAP, or Three.js). Motion uses CSS keyframes, `@starting-style`, and a 60-line WAAPI sequencer.
- **Physical Depth Metaphor:** The Stage displays three physical depth zone slabs (Internet, DMZ, Internal Core) with pointer parallax behind a transparent Cytoscape canvas.
- **7-Second Choreographed Sequence:** Visualizes the backend's verified cut in 6 synchronized beats: non-path dimming, red path trace, shield token drop, edge slash recoil, count roll-down, and steady verified green transition.
- **Guided Demo Tour:** Press key `G` anywhere to execute an interactive 8-step guided walk-through.
- **Offline & Low-Bandwidth Resilience (Law 5):** All fonts (@fontsource/geist-sans, @fontsource/geist-mono, @fontsource/instrument-serif) are self-hosted. Zero CDN calls. Built-in snapshot fallback (`demo_lab_a.bundle.json`) ensures no blank screens during live presentations.

---

## 6. Honest Limitations & Model Boundaries (Law 2)

1. **Evidence-Bounded Model:** FutureForge represents modeled relationships supported by available data. Missing evidence produces missing modeled paths.
2. **Not Total Security Proof:** A verified 0-path result applies strictly to the bounded graph. It does not establish that all zero-days or lateral paths were identified.
3. **Synthetic Data Transparency:** Fabricated future CVEs (`CVE-2099-*`) are prominently labelled with persistent `SYNTHETIC DATA` stamps.
4. **No Exploits Executed:** The system proposes and verifies remediation plans mathematically; it never executes active payloads against production targets.

---

## 7. Practical Applicability & Future Work

- **Enterprise SIEM/SOAR Integration:** Can ingest raw output from Qualys, Tenable Nessus, Wiz, or AWS Security Hub and output targeted Ansible / Terraform / Kubernetes patch manifests.
- **Dynamic Cost Models:** Incorporating patch downtime risk, blast radius, and vendor maintenance windows into the PuLP cost objective function.
- **Semantic Versioning Engine:** Upgrading the dotted-numeric version parser to package-manager-specific semver (Debian, RPM, Alpine apk).
