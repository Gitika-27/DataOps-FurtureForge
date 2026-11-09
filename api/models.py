"""Pydantic schemas and models for the FutureForge API."""
from __future__ import annotations

import re
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class RunRequest(BaseModel):
    lab: Literal["lab_a", "lab_b"] = "lab_a"
    mode: Literal["demo", "mock", "live"] = "demo"


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    live_enabled: bool = False
    live_reason: str = "Disabled by default; set FUTUREFORGE_ENABLE_LIVE=1 and confirm Docker/Nmap/Trivy"


class CutEdge(BaseModel):
    src: str
    dst: str


class BaselineMetrics(BaseModel):
    candidate_patches: int
    candidate_cost: int
    plan_patches: int
    plan_cost: int


class DerivedData(BaseModel):
    max_hops: int = 8
    cut_edges: list[CutEdge] = Field(default_factory=list)
    baseline: Optional[BaselineMetrics] = None


class ArtifactFlags(BaseModel):
    report_html: bool = False
    report_pdf: bool = False


class RunBundle(BaseModel):
    run_id: str = Field(..., pattern=r"^[a-f0-9]{32}$")
    lab: Literal["lab_a", "lab_b"]
    mode: Literal["demo", "mock", "live"]
    source: Literal["engine", "snapshot"]
    status: Literal["verified", "no_modeled_paths", "invalid"]
    error: Optional[str] = None
    synthetic: bool = False
    notes: list[str] = Field(default_factory=list)
    created_at: str
    assets: list[dict[str, Any]] = Field(default_factory=list)
    services: list[dict[str, Any]] = Field(default_factory=list)
    reach: list[dict[str, Any]] = Field(default_factory=list)
    raw_findings: list[dict[str, Any]] = Field(default_factory=list)
    verdicts: list[dict[str, Any]] = Field(default_factory=list)
    reviewed_findings: list[dict[str, Any]] = Field(default_factory=list)
    graph: dict[str, Any] = Field(default_factory=dict)
    plan: dict[str, Any] = Field(default_factory=dict)
    skeptic_result: dict[str, Any] = Field(default_factory=dict)
    derived: DerivedData
    artifacts: ArtifactFlags


class ErrorDetail(BaseModel):
    message: str
    code: str
    details: Optional[dict[str, Any]] = None
