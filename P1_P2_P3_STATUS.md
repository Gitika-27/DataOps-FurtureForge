# Person 1–3 Completion Audit

**Audit basis:** original `PatchMin-CutPlanner+SkepticAgentFullProjectGuide.pdf`, current source tree, and the integrated test run after the audit fixes.

## Bottom line

**The P1, P2, and P3 implementation work is integrated and its automated suite passes (33 tests).** Person 4 can begin API/UI work against the documented JSON files and demo fixture.

That does **not** mean the entire four-person hackathon project is complete. The FastAPI service, React/Vite/Cytoscape UI, demo-mode toggle, pitch/rehearsal, and backup video are Person 4's work and remain outstanding. Also, the team still needs to run at least one real Docker/Nmap/Trivy scan and real external enrichment on its Windows/Docker Desktop machine; those runs cannot be claimed from the synthetic fixtures or the current cloud test environment.

## P1 — Lab and ingestion

| Requirement | Status | Evidence / qualification |
|---|---|---|
| Two Docker Compose labs, each with six assets and three isolated networks | **Implemented** | `lab/lab_a/docker-compose.yml`, `lab/lab_b/docker-compose.yml`; A and B use different network membership patterns. |
| Nmap service/version scan and Trivy image scan orchestration | **Implemented; real scan must be confirmed locally** | `ingest/run_scan.py`, `ingest/run_scan.ps1`, `ingest/run_scan.sh`, `lab/scanner/Dockerfile`. Runner obtains Docker inventory, scans networks/images, and calls the parser. |
| Parser outputs assets, services, scanner-native findings and declared-network/open-port reachability | **Implemented and tested** | `ingest/parse_scan.py`; `tests/test_ingestion.py`. Lab A normalized mock reach was corrected to match parser-derived shared-network/open-port reachability. |
| Docker-free fallback and six-asset mock data | **Implemented** | Normalized `data/mock/lab_a/` and `lab_b/`; parser-ready Nmap XML/Trivy JSON/inventory under `data/mock/scanner-format/`. |
| Real raw scan capture checked into repo | **Not yet present** | The scanner-format fixtures are clearly synthetic and are **not** real Docker/Nmap/Trivy output. Run P1 locally; decide with the team whether a sanitized real capture should be committed as an additional demo fallback. |
| Actual scan run on Windows Docker Desktop | **Still to verify** | This audit ran the mock/raw-fixture paths only. The P1 PowerShell entry point is included, but a real run on the team's computer has not been evidenced here. |

## P2 — Enrichment, graph, optimizer, verification

| Requirement | Status | Evidence / qualification |
|---|---|---|
| NVD, CISA KEV, FIRST EPSS integration | **Implemented and mock-tested** | `core/enrich.py`; tests seed cache data and simulate successful online fetch/cache writes without making real external requests. |
| Cache-first, offline operation | **Implemented and tested** | `cache/` file layout; `--offline` makes no network calls and returns cached data if present. The committed default cache is empty, so offline mock enrichment may show unavailable NVD/EPSS. |
| Attack graph edge rule and patch IDs | **Implemented and tested** | `core/graph.py`: only accepted verdict plus remotely exploitable finding on a reachable destination port makes an edge. Graph edges retain finding/patch IDs and individual patch costs. |
| Hop-capped path enumeration | **Implemented and tested** | Default cap is 8 hops. Counts and verification apply to bounded simple paths only. |
| ILP optimizer and greedy fallback | **Implemented and tested** | `core/optimize.py`; PuLP ILP, forced greedy test, plus verification. |
| Independent plan verification | **Implemented and tested** | `core/verify.py`; applies selected patches to a graph copy, recounts paths, rejects remaining modeled paths. |
| Chain, diamond, decoy tests | **Implemented and tested** | `tests/test_person2_core.py`. Additional tests cover merged-edge findings, independent patch costs, and greedy fallback. |
| Correct patch-cost assignment on merged edges | **Fixed and regression-tested** | Per-patch costs are now retained; inconsistent cost values for one patch ID fail clearly rather than silently understating effort. |
| Live NVD/KEV/EPSS calls from a real scan | **Still to verify** | Current tests mock the online transport; local external service availability, rate limiting, and meaningful non-empty enrichment must be confirmed by the team. |
| Real lab A/B to verified plan | **Not yet proven** | The normal offline mock run safely produces `no_modeled_paths`; the separate synthetic test fixture proves the graph/optimizer/verification seam. Neither substitutes for live-scan acceptance. |

## P3 — Skeptic and report

| Requirement | Status | Evidence / qualification |
|---|---|---|
| One verdict per raw finding; no new finding generation | **Implemented and tested** | `skeptic/skeptic_rules.py`; regression test checks one-to-one verdicts. |
| Version, observed service/port, topology reachability, NVD CPE and AV:N triage | **Implemented and tested** | Service/package/version match is required; suggested ports do not count. NVD affected CPE and network vector are required for `confirmed` remote graph use. |
| Compensating-control check | **Implemented, input-driven** | Only explicitly supplied control JSON marked both `effective` and `blocks_exploitation` excludes a finding. The tool does not discover or verify controls itself. |
| Optional bounded LLM explanations | **Implemented and unit-tested with stubbed calls** | Opt-in only; JSON parsed into `Verdict`, one retry, hash cache, no new findings/evidence, no status/confidence upgrade, deterministic fallback. A real provider call is optional and has not been required/tested. |
| Detailed HTML and one-page PDF | **Implemented and tested** | `report/template.html` is the full evidence ledger. `report/pdf_template.html` produces a one-page executive PDF for the current small lab/demo; automated tests assert one-page output. |
| Report sections | **Implemented** | Summary, before/after counts, patch/evidence, rejected findings/reasons, verdict ledger, honest limitations. |
| Known algorithm boundary | **Documented** | Version parsing is dotted-numeric, CPE identity matching is prototype logic, topology is supplied rather than firewall-verified, and no exploit is run. Review real high-impact results manually. |

## Verified test and demo results

Current automated run from the integrated source tree: **33 passed**. It includes P1 parser tests, offline cache and mocked fetch/cache tests, graph chain/diamond/decoy, greedy and ILP planning, the P1→P2 handoff, P3 safeguards, report generation/page count, and synthetic verified-chain tests.

The expected behaviors are intentionally different:

1. **Normal Lab A/B offline mock:** generates two verdicts and reports `no_modeled_paths` because default NVD cache is empty and the rules cannot establish the missing vulnerability applicability/network evidence. This is a cautious result, not a pass/fail error.
2. **Synthetic UI demo fixture:** `data/mock/demo/lab_a/findings.json` contains invented future CVEs and fabricated NVD-shaped metadata, labelled synthetic. It yields `verified`, 1 modeled path before, 0 after, and `demo-db-fix`. Use only to exercise software/UI behavior; never call it a real security assessment.
3. **Synthetic raw scanner-format fixtures:** `data/mock/scanner-format/` lets P1 parser code run without Docker. These are generated from mock JSON and are not captured raw scanner output.

## Remaining acceptance actions before claiming the complete project is demo-ready

1. Run the real P1 scan on the team's Windows/Docker Desktop machine for both labs. Check that Docker Compose starts, Nmap and Trivy complete, and `data/scans/<lab>/scan.json` and `reach.json` are written. Stop each lab afterward.
2. Run live P2 enrichment without `--offline`; confirm responses are cached and at least one valid CVE produces useful NVD/KEV/EPSS data. Avoid committing credentials or private data. Caches are ignored by Git.
3. Run P3 on the real P2 handoff. Inspect all verdicts and report manually. If the output is `no_modeled_paths`, investigate whether the scan/evidence really supports none; do not force a path to appear.
4. Decide whether the team wants to add sanitized, genuine raw scan artifacts as an offline fallback. Current committed scanner-format fixtures are synthetic only.
5. Person 4 implements the API/UI/demo toggle, consumes the outputs described in `PERSON4_HANDOFF.md`, runs the full tests again, rehearses twice, and records the backup demo video.

## README status

`README.md` is project-wide and reflects this actual implementation: it explains the shared architecture and ownership for all four persons, documents setup/run commands, distinguishes normal mocks from the synthetic UI fixture, documents P3 outputs and safety limits, and leaves Person 4's API/UI/demo work clearly marked outstanding. It is no longer a Person-1-only setup README.
