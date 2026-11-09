# FutureForge REST API Contract

**Service:** Patch Min-Cut Planner + Skeptic Agent Engine API  
**Base URL:** `http://127.0.0.1:8000` (FastAPI)  
**Interactive Docs:** `http://127.0.0.1:8000/api/docs`  

---

## 1. System Endpoints

### `GET /api/health`
Check service health and live scan capability flags.

- **Response `200 OK`**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "live_enabled": false,
  "live_reason": "Live mode disabled by default; set FUTUREFORGE_ENABLE_LIVE=1 to enable."
}
```

---

## 2. Analysis Execution Endpoints

### `POST /api/runs`
Submit an engine analysis run for a whitelisted lab and execution mode.

- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "lab": "lab_a",
  "mode": "demo"
}
```
  - `lab`: `"lab_a"` | `"lab_b"`
  - `mode`: `"demo"` | `"mock"` | `"live"`
    - `demo`: Synthetic verified fixture (`data/mock/demo/lab_a/findings.json`). Only valid for `lab_a`.
    - `mock`: Offline mock scanner pipeline (`prepare_lab_findings` + `run_review_pipeline`).
    - `live`: Disabled unless `FUTUREFORGE_ENABLE_LIVE=1` is set.
- **Response `200 OK`**: Returns the complete `RunBundle` object.
- **Errors:**
  - `400 Bad Request`: When `mode="demo"` with `lab="lab_b"` or invalid input parameter.
  - `422 Unprocessable Entity`: Input schema validation failure.
  - `503 Service Unavailable`: When `mode="live"` is requested without host scanner capabilities.

---

### `GET /api/runs/{run_id}`
Retrieve a completed run bundle by its 32-character hexadecimal UUID.

- **Path Parameters:**
  - `run_id`: `^[a-f0-9]{32}$`
- **Response `200 OK`**: Complete `RunBundle` object.
- **Response `404 Not Found`**: Invalid run ID format or run ID not present in registry.

---

### `GET /api/runs/{run_id}/report`
Fetch the generated HTML ledger or PDF executive summary for an analysis run.

- **Path Parameters:**
  - `run_id`: `^[a-f0-9]{32}$`
- **Query Parameters:**
  - `format`: `"html"` (default) or `"pdf"`
- **Response `200 OK`**:
  - `format="html"`: `text/html; charset=utf-8` with restrictive CSP (`default-src 'self' 'unsafe-inline'; img-src 'self' data:;`) and `X-Frame-Options: SAMEORIGIN`.
  - `format="pdf"`: `application/pdf` binary download.
- **Response `404 Not Found`**: Run or report file not found.

---

## 3. Team Guide Legacy Aliases

For compatibility with original team guidelines and CLI curl scripts:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/run?lab=a` | Runs latest analysis for Lab A (`demo` mode) or Lab B (`mock` mode) |
| `GET` | `/graph` | Returns NetworkX node/edge payload for latest run |
| `GET` | `/plan` | Returns `plan.json` contents for latest run |
| `GET` | `/report?format=html\|pdf` | Returns report document for latest run |

---

## 4. The RunBundle Schema Specification

```json
{
  "run_id": "9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c",
  "lab": "lab_a",
  "mode": "demo",
  "source": "engine",
  "status": "verified",
  "error": null,
  "synthetic": true,
  "notes": ["..."],
  "created_at": "2026-11-09T11:06:09.315546+00:00",
  "assets": [
    { "id": "web01", "ip": "172.20.0.2", "zone": "internet", "criticality": 8, "is_crown_jewel": false, "is_entry_point": true }
  ],
  "services": [
    { "asset_id": "web01", "port": 80, "name": "http", "version": "nginx 1.21.6" }
  ],
  "reach": [
    { "src": "web01", "dst": "app01", "port": 80 }
  ],
  "raw_findings": [
    { "id": "...", "asset_id": "app01", "port": 0, "cve": "CVE-2099-90001", "cvss": 7.5, "severity": "HIGH", "package_name": "apache-httpd", "installed_version": "2.4.54", "fixed_version": "2.4.55", "source": "synthetic-demo", "patch_id": "demo-app-fix", "patch_cost": 3 }
  ],
  "verdicts": [
    { "finding_id": "demo-app:CVE-2099-90001:apache-httpd", "status": "downgraded", "confidence": 0.6, "evidence": ["..."], "reasoning": "..." }
  ],
  "reviewed_findings": [
    { "id": "demo-db:CVE-2099-90002:mariadb", "asset_id": "db01", "port": 3306, "cve": "CVE-2099-90002", "cvss": 9.8, "patch_id": "demo-db-fix", "patch_cost": 1 }
  ],
  "graph": {
    "nodes": [
      { "id": "web01", "ip": "172.20.0.2", "zone": "internet", "criticality": 8, "is_entry_point": true, "is_crown_jewel": false }
    ],
    "edges": [
      { "src": "app01", "dst": "db01", "patch_ids": ["demo-db-fix"], "patch_costs": { "demo-db-fix": 1 }, "finding_ids": ["..."], "ports": [3306] }
    ]
  },
  "plan": {
    "lab_id": "lab_a",
    "status": "verified",
    "warning": null,
    "plan": {
      "patches": ["demo-db-fix"],
      "paths_before": 1,
      "paths_after": 0,
      "risk_reduction_pct": 100.0
    },
    "verification": {
      "valid": true,
      "paths_before": 1,
      "paths_after": 0,
      "remaining_paths": []
    },
    "paths": [
      ["web01", "app01", "db01"]
    ]
  },
  "skeptic_result": {
    "status": "verified",
    "verdict_count": 6,
    "graph_finding_count": 1,
    "paths_before": 1,
    "paths_after": 0,
    "patches": ["demo-db-fix"]
  },
  "derived": {
    "max_hops": 8,
    "cut_edges": [
      { "src": "app01", "dst": "db01" },
      { "src": "file01", "dst": "db01" },
      { "src": "jump01", "dst": "db01" }
    ],
    "baseline": {
      "candidate_patches": 2,
      "candidate_cost": 4,
      "plan_patches": 1,
      "plan_cost": 1
    }
  },
  "artifacts": {
    "report_html": true,
    "report_pdf": true
  }
}
```
