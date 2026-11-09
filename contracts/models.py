"""Shared, frozen data contracts from the project guide.

Team rule: coordinate with everyone before changing field names or types.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Asset(BaseModel):
    id: str
    ip: str
    zone: str  # internet | dmz | internal
    criticality: int = Field(ge=1, le=10)
    is_crown_jewel: bool = False
    is_entry_point: bool = False


class Service(BaseModel):
    asset_id: str
    port: int = Field(ge=1, le=65535)
    name: str
    version: str


class Finding(BaseModel):
    id: str
    asset_id: str
    port: int
    cve: str
    cvss: float = Field(ge=0, le=10)
    epss: Optional[float] = None
    in_kev: bool = False
    remote_exploitable: bool = True
    patch_id: str
    patch_cost: int = 1


class Verdict(BaseModel):
    finding_id: str
    status: Literal["confirmed", "downgraded", "rejected"]
    confidence: float = Field(ge=0, le=1)
    evidence: list[str]
    reasoning: str


class Reach(BaseModel):
    src: str
    dst: str
    port: int = Field(ge=1, le=65535)


class PatchPlan(BaseModel):
    patches: list[str]
    paths_before: int
    paths_after: int
    risk_reduction_pct: float = Field(ge=0, le=100)
