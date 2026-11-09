"""API route handlers for FutureForge."""
from __future__ import annotations

import os
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse, JSONResponse

from api.models import (
    ErrorDetail,
    HealthResponse,
    RunBundle,
    RunRequest,
)
from api.service import (
    execute_run,
    get_latest_run,
    get_run,
    get_run_dir,
    validate_run_id,
)

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    live_enabled = os.environ.get("FUTUREFORGE_ENABLE_LIVE") == "1"
    reason = (
        "Live scan mode is enabled (Docker/Nmap/Trivy must be active)."
        if live_enabled
        else "Live mode disabled by default; set FUTUREFORGE_ENABLE_LIVE=1 to enable."
    )
    return HealthResponse(
        status="ok",
        version="1.0.0",
        live_enabled=live_enabled,
        live_reason=reason,
    )


@router.post("/api/runs", response_model=RunBundle)
def create_run(request: RunRequest) -> RunBundle:
    if request.mode == "demo" and request.lab != "lab_a":
        raise HTTPException(
            status_code=400,
            detail="Synthetic demo mode is only available for lab_a.",
        )
    try:
        bundle = execute_run(lab=request.lab, mode=request.mode)
        return bundle
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except NotImplementedError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Engine run failed: {str(exc)}")


@router.get("/api/runs/{run_id}", response_model=RunBundle)
def fetch_run(run_id: str) -> RunBundle:
    if not validate_run_id(run_id):
        raise HTTPException(status_code=404, detail="Invalid run_id format.")
    bundle = get_run(run_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return bundle


@router.get("/api/runs/{run_id}/report")
def fetch_run_report(
    run_id: str,
    format: Literal["html", "pdf"] = Query("html", description="Report format"),
):
    if not validate_run_id(run_id):
        raise HTTPException(status_code=404, detail="Invalid run_id format.")

    run_dir = get_run_dir(run_id)
    if not run_dir or not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run directory not found.")

    if format == "pdf":
        pdf_path = run_dir / "report.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="PDF report was not generated for this run.")
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"futureforge_report_{run_id}.pdf",
        )

    html_path = run_dir / "report.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="HTML report not found.")

    content = html_path.read_text(encoding="utf-8")
    headers = {
        "Content-Security-Policy": (
            "default-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline';"
        ),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
    }
    return Response(content=content, media_type="text/html", headers=headers)


# --- Aliases matching the team guide ---


@router.post("/run", response_model=RunBundle)
def alias_run(lab: str = Query("a", pattern="^(a|b|lab_a|lab_b)$")) -> RunBundle:
    canonical_lab = "lab_a" if lab in ("a", "lab_a") else "lab_b"
    mode = "demo" if canonical_lab == "lab_a" else "mock"
    return create_run(RunRequest(lab=canonical_lab, mode=mode))


@router.get("/graph")
def alias_graph():
    latest = get_latest_run()
    if not latest:
        raise HTTPException(status_code=404, detail="No run has been executed yet.")
    return latest.graph


@router.get("/plan")
def alias_plan():
    latest = get_latest_run()
    if not latest:
        raise HTTPException(status_code=404, detail="No run has been executed yet.")
    return latest.plan


@router.get("/report")
def alias_report(format: Literal["html", "pdf"] = "html"):
    latest = get_latest_run()
    if not latest:
        raise HTTPException(status_code=404, detail="No run has been executed yet.")
    return fetch_run_report(latest.run_id, format=format)
