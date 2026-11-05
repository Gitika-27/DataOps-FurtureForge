#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: bash ingest/run_scan.sh lab_a|lab_b [--skip-trivy]" >&2
  exit 2
fi

LAB="$1"
shift
exec python3 "$(dirname "$0")/run_scan.py" --lab "$LAB" "$@"
