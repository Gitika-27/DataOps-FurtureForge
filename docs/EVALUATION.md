# FutureForge Engine Benchmark & Evaluation

> **Transparency Stamp:** All benchmark evaluations below were measured directly from real engine executions. Results from demo runs use synthetic test data (CVE-2099-* fixtures). Normal mock runs reflect the actual empty offline NVD cache fail-closed rule.

## Summary Metrics Table

| Run Scenario | Status | Findings | Verdicts (C/D/R) | Nodes | Edges | Paths (Before → After) | Patches Selected | Verified? | Reports (HTML/PDF) | Runtime |
|---|---|---|---|---|---|---|---|---|---|---|
| **Synthetic Demo (Lab A)** | `verified` | 2 | 2/0/0 | 6 | 4 | 1 → 0 | `demo-db-fix` | **PASSED** | Yes / Yes | 3.677s |
| **Offline Mock (Lab A)** | `no_modeled_paths` | 2 | 0/2/0 | 6 | 0 | 0 → 0 | `None (0 paths)` | **PASSED** | Yes / Yes | 0.361s |
| **Offline Mock (Lab B)** | `no_modeled_paths` | 2 | 0/2/0 | 6 | 0 | 0 → 0 | `None (0 paths)` | **PASSED** | Yes / Yes | 0.349s |

## Detailed Analysis

### 1. Synthetic Demo (Lab A)
- **Status:** `verified`
- **Outcome:** 1 modeled attack path (`web01` → `app01` → `db01`) discovered by NetworkX simple paths. PuLP binary optimizer identified that applying patch `demo-db-fix` on MariaDB 3306 cuts all 3 inbound edges to the crown jewel at minimal cost ($1 vs $4 candidate total). Independent verification verified that 0 paths remain.
- **Honesty Note:** All CVE IDs are synthetic (`CVE-2099-*`). This scenario demonstrates the active solver and UI choreography.

### 2. Normal Offline Mock (Lab A & Lab B)
- **Status:** `no_modeled_paths`
- **Outcome:** The Skeptic downgraded the image-level findings because the local offline NVD cache is empty and cannot confirm CPE applicability or AV:N network vectors. Because no confirmed remote findings exist on open ports, zero attack edges are drawn.
- **Honesty Note:** This is an intentional, fail-closed security design. It is not an error and not an assertion that the lab is safe.

### 3. Live Scanner Mode
- **Status:** `Unavailable` (Docker Desktop, Nmap, and Trivy not verified in local testing harness). Marked unavailable in UI and API.

*(Generated automatically by scripts/evaluate_demo.py)*
