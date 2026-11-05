# Person 1: what to do, in order

Your role is **Lab + Ingestion**. You are responsible for providing safe, consistent input data to Persons 2–4. You are not responsible for the optimizer, Skeptic/LLM, API, UI, or final report.

## First: agree on the handoff

1. Share `contracts/models.py` with your teammates immediately. The team guide calls these contracts frozen. Do not independently rename fields or change their types.
2. Tell Person 2: `scan.json` carries assets, observed services, and scanner-native `raw_findings`; `reach.json` carries `{src, dst, port}` records. A Trivy image CVE is not automatically a remotely exploitable service finding. In this starter it has `port: 0` (image-level / not attributed to a network port) until your team agrees how to map it.
3. Get a quick agreement on naming (`lab_a`, `lab_b`, IDs such as `web01` and `db01`) and where the integration branch expects `scan.json` and `reach.json`.

## First hour: enable the rest of the team

1. Copy this starter's `contracts/`, `data/mock/`, and `requirements.txt` into the shared repo.
2. Commit the mock data before attempting to build containers. Ask one teammate to load the mock files; they should not need Docker.
3. Run the local parser tests (`python -m pytest -q`). Fix any errors before push.
4. Push a small branch and open a pull request. Keep the main branch runnable; do not push generated scans or caches unless the team agrees.

## Set up on Windows with Docker Desktop + VS Code

1. Start Docker Desktop and wait until it reports the Docker engine is running. These are Linux containers. Docker Desktop's WSL 2 backend is a common Windows setup; if Compose says it cannot connect, first start/restart Docker Desktop and wait for it to finish loading.
2. Open the repository folder in VS Code. Select **Terminal → New Terminal**. The included commands work from PowerShell.
3. Use the Python 3.13 already installed on your computer. This project code also remains compatible with Python 3.11+, so teammates can use either version. Make a virtual environment and install the pinned packages:

   ```powershell
   py -3.13 --version
   py -3.13 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

   You do not need to activate `.venv`; using its `python.exe` directly avoids PowerShell activation-policy problems.

4. Validate the mock pipeline before using Docker:

   ```powershell
   .\.venv\Scripts\python.exe -m pytest -q
   .\.venv\Scripts\python.exe ingest/parse_scan.py --mock lab_a
   .\.venv\Scripts\python.exe ingest/parse_scan.py --mock lab_b
   ```

   If `py -3.13` is unavailable, check `py --list` and use the version shown there, provided it is Python 3.11 or newer.

## Run Lab A (only after mocks work)

1. Start with Nmap only; this avoids waiting for Trivy's first vulnerability database download:

   ```powershell
   .\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a --skip-trivy
   ```

2. Watch the terminal. The script validates Docker, starts six containers, builds a small Nmap scanner image, scans the lab's three private networks, and produces `data/scans/lab_a/scan.json` and `reach.json`. If it fails, save the first error message; do not repeatedly rebuild without checking that Docker Desktop is running.
3. Inspect the outputs in VS Code. Confirm IDs are stable, at least one service is found on the expected ports, and `reach.json` only contains pairs that share a declared network.
4. Run the full Trivy scan:

   ```powershell
   .\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_a
   ```

   Trivy needs Internet to download its vulnerability database and may take several minutes the first time. NVD enrichment and optimizer code are not part of your work.
5. Stop the containers:

   ```powershell
   docker compose -f lab/lab_a/docker-compose.yml down
   ```

## Run Lab B and prove it is not hardcoded

Repeat the exact steps with `lab_b`:

```powershell
.\.venv\Scripts\python.exe ingest/run_scan.py --lab lab_b --skip-trivy
.\.venv\Scripts\python.exe -m pytest -q
docker compose -f lab/lab_b/docker-compose.yml down
```

Compare both normalized outputs. They should differ because the container-to-network topology differs. Do not edit the parser to special-case a lab; it reads the Compose labels and network attachments.

## What to commit

Commit source/configuration and small mock fallback files: Compose YAML, scanner Dockerfile, Python scripts, tests, shared contracts (after team agreement), README, requirements, and mock JSON. Do not commit `.venv/`, Docker images, Trivy database/cache, `.env`, access tokens, or other secrets. Usually keep `data/scans/` out of Git unless the team deliberately wants sanitized raw scans as a fallback.

A reasonable Git sequence, if the team has given you a remote URL and you have access, is:

```powershell
git status
git switch -c person1-lab-ingestion
git add README.md PERSON1_STEPS.md .gitignore requirements.txt contracts lab ingest data/mock tests
git commit -m "Add isolated labs and scan ingestion"
git push -u origin person1-lab-ingestion
```

If you are creating the repo from scratch, create an **empty** GitHub repository first (do not add a second README/license if you already have these files), then copy the remote URL and run `git remote add origin <your-repo-url>`. Do not paste credentials into a file or chat. If your group already created a repo, clone that repo instead of making a competing one; create your branch inside the team's repo.

## Definition of done for your part

You are done when all of these are true:

- Both mock labs load with no Docker and pass the parser tests.
- The two Compose files each define the required three isolated networks and six services, with no published ports.
- Lab A and Lab B can start and stop on the same machine.
- Scans are repeatable enough for the demo, and the parser never invents a service or reachability edge.
- `scan.json` and `reach.json` match the agreed team contract and are handed to the other people.
- Mock scan outputs are committed so a demo can still proceed if Docker/network/Trivy is unavailable.
