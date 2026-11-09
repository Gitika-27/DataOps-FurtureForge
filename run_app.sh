#!/usr/bin/env bash
set -e

echo "==================================================="
echo "Starting FutureForge: Patch Min-Cut Planner"
echo "Tagline: Don't patch everything. Cut the path."
echo "==================================================="

if [ ! -d ".venv" ]; then
    echo "[1/3] Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

echo "[2/3] Activating virtual environment..."
source .venv/bin/activate

echo "[3/3] Checking dependencies (FastAPI, NetworkX, PuLP, Jinja2)..."
pip install -r requirements-api.txt --quiet

echo ""
echo "==================================================="
echo "Unified Server running at: http://localhost:8000"
echo "- Landing Page: http://localhost:8000/"
echo "- Atelier Console: http://localhost:8000/console"
echo "- Ledger Report: http://localhost:8000/console/report"
echo "Press Ctrl+C to stop."
echo "==================================================="
echo ""

python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
