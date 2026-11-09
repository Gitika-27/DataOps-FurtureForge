"""FastAPI application factory and middleware configuration for FutureForge."""
from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api.routes import router

ROOT = Path(__file__).resolve().parents[1]
UI_DIST = ROOT / "ui" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="FutureForge Patch Min-Cut Planner API",
        description="Evidence-bounded attack graph remediation planner and Skeptic verification engine.",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(router)

    from fastapi.exceptions import HTTPException

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": exc.detail, "detail": exc.detail, "code": "HTTP_ERROR"},
        )

    # Global sanitized error handler to prevent internal path / secret leakage
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "message": "An internal error occurred during engine analysis.",
                "detail": "An internal error occurred during engine analysis.",
                "code": "INTERNAL_ENGINE_ERROR",
            },
        )

    # Single-process mode: serve pre-built ui/dist if it exists
    if UI_DIST.exists() and (UI_DIST / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=UI_DIST / "assets"), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Do not intercept API paths
            if full_path.startswith("api/") or full_path in ("graph", "plan", "report", "run"):
                return JSONResponse(status_code=404, content={"message": "Not found", "code": "NOT_FOUND"})
            file_candidate = UI_DIST / full_path
            if file_candidate.is_file():
                return FileResponse(file_candidate)
            return FileResponse(UI_DIST / "index.html")

    return app


app = create_app()
