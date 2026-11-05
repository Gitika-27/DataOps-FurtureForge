# Patch Min-Cut Planner — Person 1 starter

This starter bundle implements the **Person 1 (Lab + Ingestion)** boundary from the team guide: two isolated Docker labs, scan orchestration, Nmap/Trivy parsing, mock data, and tests. It is intended to be copied into your team's shared repository, not to replace the other teammates' modules.

## Important safety boundary

These labs are intentionally vulnerable test fixtures. Use them only on your own computer. The Compose files publish **no ports** to the host and mark all three Docker networks `internal: true`. Do not remove those safeguards, connect these containers to a real network, or scan systems you do not own or have explicit permission to test. Scanning is non-exploitative; this project does not run exploits.

## What you need to download

There is **no separate vulnerability dataset** to download. The included mock JSON is the offline/fallback dataset. When you start a real lab, Docker downloads the pinned lab images; the optional Trivy scan downloads its vulnerability database automatically. First-time image/database downloads need Internet access. Start with mock data before attempting the real lab.

## Person 1 deliverables

- `contracts/models.py`: the frozen shared contract from the project guide (coordinate before changing it).
- `lab/lab_a/docker-compose.yml` and `lab/lab_b/docker-compose.yml`: six service containers and three isolated networks per lab.
- `ingest/run_scan.py`: starts the selected lab, discovers container IPs, scans each Docker network with an ephemeral Nmap container, and optionally scans images with Trivy.
- `ingest/parse_scan.py`: converts Nmap XML and Trivy JSON into normalized `scan.json` and `reach.json`.
- `data/mock/lab_a/` and `data/mock/lab_b/`: committed offline data for teammates and demo fallback.

## Windows + VS Code setup (beginner path)

1. Install **Docker Desktop** and start it. In Docker Desktop, make sure the engine says it is running and Linux containers are enabled. The Compose files use Linux images.
2. In VS Code, open this repository folder and open **Terminal → New Terminal** (PowerShell is fine). This starter works with Python 3.11+; if you already have Python 3.13, use it instead of installing 3.11.
3. Confirm Python 3.13 is available, create the virtual environment, and install the pinned packages:

   ```powershell
   py -3.13 --version
   py -3.13 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

   You do not need to activate the environment; calling its `python.exe` directly avoids PowerShell activation-policy issues. The same code remains compatible with Python 3.11 if a teammate uses that version.
4. Prove the starter works without Docker:

   ```powershell
   .\.venv\Scripts\python.exe -m pytest -q
   .\.venv\Scripts\python.exe ingest/parse_scan.py --mock lab_a
   ```

   Mock files are already committed; this command validates/normalizes the mock input and does not scan anything.
5. When ready to run a real lab, first try Nmap only:

   ```powershell
   .\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a --skip-trivy
   ```

   Then try the full scan (Trivy's initial database download can take a while):

   ```powershell
   .\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a
   ```

   `lab_b` works the same way. Outputs are written under `data/scans/<lab_id>/`. The scan script leaves the lab running so you can inspect it. Stop it when finished:

   ```powershell
   docker compose -f lab/lab_a/docker-compose.yml down
   ```

6. In VS Code, use Source Control to initialize/clone the team's Git repo (or run `git init` if this folder itself will be the repo), commit the mock files and starter first, and push a branch such as `person1-lab-ingestion`. Never commit `.env`, credentials, or generated Docker image/cache data. Ask your teammates to agree to the exact contract before anyone edits it.

## Exact scan commands

The `run_scan.py` wrapper invokes Docker Compose, builds the small Nmap scanner image, scans only the Docker networks in the chosen lab, then parses its raw artifacts. It does not need host-installed Nmap or Trivy. `--skip-trivy` is useful for checking network/service discovery quickly; findings will be empty for that run. The full Trivy run reads image contents and is not proof that every package CVE is remotely exploitable.

For a one-command Windows shortcut, `ingest/run_scan.ps1` is included. Example:

```powershell
.\ingest\run_scan.ps1 -Lab lab_a -SkipTrivy
```

On Linux, macOS, WSL, or Git Bash, use:

```bash
bash ingest/run_scan.sh lab_a --skip-trivy
```

## Output and integration notes

`scan.json` contains `assets`, `services`, `raw_findings`, and network-interface metadata. `reach.json` contains `reach` entries derived from two facts: both assets share a declared Docker bridge network, and Nmap observed the destination port open on that network. This models reachability **inside the lab only**; it is not a firewall-policy scanner.

Trivy reports image/package CVEs, not necessarily remotely reachable service vulnerabilities. Therefore a raw image finding uses `port: 0` and an empty/explicit `suggested_ports` list rather than falsely claiming a CVE belongs to a particular open service. Person 2/3 should use the raw package/version evidence and deterministic checks before creating an integration `Finding` or attack-graph edge. Coordinate this mapping with them before integrating.

The mock data is synthetic, clearly labeled `mock`; it is designed so the rest of the team can begin immediately. It is not evidence from a real scan. Commit real raw scan outputs only if your team wants them as demo artifacts and has checked that they contain no secrets or identifying data.

## Person 1 completion checklist

- [ ] Teammates can load both mock JSON files without Docker.
- [ ] `pytest` passes.
- [ ] Both Compose labs validate and start; no ports are published to the host.
- [ ] Nmap XML is generated for all three networks in each lab.
- [ ] `parse_scan.py` produces normalized `scan.json` and `reach.json` for both labs.
- [ ] Full Trivy scan either succeeds or the team documents that the cached mock is the demo fallback.
- [ ] Team confirms the `port: 0` raw image-finding handoff and shared contracts.
- [ ] Stop each lab after testing with `docker compose ... down`.

See `PERSON1_STEPS.md` for the ordered task plan and Git/VS Code instructions.
