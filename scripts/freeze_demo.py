"""Freeze engine output for synthetic demo into a committed snapshot bundle."""
from __future__ import annotations

import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.models import ArtifactFlags, RunBundle
from api.service import compute_derived_metrics, strip_nvd_blobs
from skeptic.run_skeptic import run_review_pipeline

ROOT = Path(__file__).resolve().parents[1]
DEMO_FIXTURE = ROOT / "data" / "mock" / "demo" / "lab_a" / "findings.json"
SNAPSHOT_DIR = ROOT / "data" / "snapshots"
UI_SNAPSHOT_DIR = ROOT / "ui" / "public" / "snapshots"


def freeze_demo_snapshot() -> Path:
    if not DEMO_FIXTURE.exists():
        raise FileNotFoundError(f"Missing demo fixture: {DEMO_FIXTURE}")

    document = json.loads(DEMO_FIXTURE.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        print(f"Executing real engine review pipeline in {tmp_path}...")
        result = run_review_pipeline(
            document,
            output_dir=tmp_path,
            create_pdf=True,
            max_hops=8,
            use_ilp=True,
        )

        verdicts_data = json.loads((tmp_path / "verdicts.json").read_text(encoding="utf-8"))
        reviewed_findings_data = json.loads((tmp_path / "reviewed_findings.json").read_text(encoding="utf-8"))
        plan_data = json.loads((tmp_path / "plan.json").read_text(encoding="utf-8"))
        graph_data = json.loads((tmp_path / "graph.json").read_text(encoding="utf-8"))
        skeptic_result_data = json.loads((tmp_path / "skeptic_result.json").read_text(encoding="utf-8"))

        derived = compute_derived_metrics(graph_data, plan_data, max_hops=8)

        frozen_run_id = "00000000000000000000000000000001"
        bundle = RunBundle(
            run_id=frozen_run_id,
            lab="lab_a",
            mode="demo",
            source="snapshot",
            status=plan_data.get("status", "verified"),
            error=None,
            synthetic=True,
            notes=document.get("notes", []) or [
                "Freeze snapshot generated from real engine execution on demo fixture"
            ],
            created_at=datetime.now(timezone.utc).isoformat(),
            assets=document.get("assets", []),
            services=document.get("services", []),
            reach=document.get("reach", []),
            raw_findings=strip_nvd_blobs(document.get("findings", [])),
            verdicts=verdicts_data.get("verdicts", []),
            reviewed_findings=reviewed_findings_data.get("findings", []),
            graph=graph_data,
            plan=plan_data,
            skeptic_result=skeptic_result_data,
            derived=derived,
            artifacts=ArtifactFlags(
                report_html=True,
                report_pdf=(tmp_path / "report.pdf").exists(),
            ),
        )

        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        dest_file = SNAPSHOT_DIR / "demo_lab_a.bundle.json"
        dest_file.write_text(json.dumps(bundle.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8")
        print(f"Wrote snapshot to {dest_file}")

        # Also copy to ui/public/snapshots if ui exists
        UI_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dest_file, UI_SNAPSHOT_DIR / "demo_lab_a.bundle.json")
        print(f"Copied snapshot to {UI_SNAPSHOT_DIR / 'demo_lab_a.bundle.json'}")

        # Also store the generated report.html and report.pdf in snapshots
        shutil.copy2(tmp_path / "report.html", SNAPSHOT_DIR / "demo_lab_a.report.html")
        if (tmp_path / "report.pdf").exists():
            shutil.copy2(tmp_path / "report.pdf", SNAPSHOT_DIR / "demo_lab_a.report.pdf")

        return dest_file


if __name__ == "__main__":
    freeze_demo_snapshot()
