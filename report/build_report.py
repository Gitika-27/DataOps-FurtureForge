"""Render the Person 3 audit report as HTML and optionally PDF."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = Path(__file__).resolve().parent


def _dump(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    raise TypeError(f"Expected a mapping or Pydantic model, got {type(value).__name__}")


def build_report_context(
    *, lab_id: str,
    verdicts: list[Any],
    findings: list[Any],
    plan: Any,
    status: str,
    max_hops: int = 8,
    synthetic: bool = False,
    extra_limitations: list[str] | None = None,
) -> dict[str, Any]:
    verdict_rows = [_dump(item) for item in verdicts]
    finding_rows = [_dump(item) for item in findings]
    plan_row = _dump(plan)
    finding_by_id = {str(item.get("id")): item for item in finding_rows}
    patch_ids = list(plan_row.get("patches") or [])
    patch_rows = []
    for patch_id in patch_ids:
        related = []
        for verdict in verdict_rows:
            finding = finding_by_id.get(str(verdict["finding_id"]), {})
            if str(finding.get("patch_id", "")) == str(patch_id):
                related.append({
                    "finding_id": verdict["finding_id"],
                    "reasoning": verdict["reasoning"],
                    "evidence": list(verdict.get("evidence") or []),
                })
        costs = [int(finding_by_id.get(str(v["finding_id"]), {}).get("patch_cost", 1) or 1)
                 for v in verdict_rows if str(finding_by_id.get(str(v["finding_id"]), {}).get("patch_id", "")) == str(patch_id)]
        patch_rows.append({"id": patch_id, "cost": min(costs) if costs else 1, "findings": related})

    rejected = [row for row in verdict_rows if row.get("status") == "rejected"]
    counts = {status_name: sum(row.get("status") == status_name for row in verdict_rows)
              for status_name in ("confirmed", "downgraded", "rejected")}
    paths_before = int(plan_row.get("paths_before", 0))
    paths_after = int(plan_row.get("paths_after", 0))
    if status == "verified":
        summary = f"The optimizer selected {len(patch_ids)} patch(es); independent verification reduced modeled paths from {paths_before} to {paths_after}."
    elif status == "no_modeled_paths":
        summary = "No supported attack path was constructed from the reviewed evidence. This may reflect missing service attribution or incomplete scan/enrichment data."
    else:
        summary = f"The current run status is {status}; do not apply a plan unless verification succeeds and paths_after equals zero."
    limitations = [
        "The tool reasons from scan evidence and deterministic rules; it does not exploit vulnerabilities and cannot prove exploitability.",
        "Package/image findings are not treated as service vulnerabilities unless an observed service and exact installed version can be matched; suggested ports alone are not proof.",
        "Only NVD affected-CPE version data plus an NVD network attack vector can confirm a remotely exploitable graph finding; unavailable or unmatched metadata is downgraded.",
        f"Paths are simple paths bounded to {max_hops} hops. Results depend on the supplied network reachability and entry-point/crown-jewel labels.",
        "Patch costs are effort heuristics, not measured work estimates. A verified result means all modeled paths are cut, not that the real environment is safe.",
    ]
    if synthetic:
        limitations.insert(0, "This report was generated from synthetic mock data; do not interpret it as a real network assessment.")
    limitations.extend(extra_limitations or [])
    return {
        "lab_id": lab_id,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": status,
        "paths_before": paths_before,
        "paths_after": paths_after,
        "risk_reduction_pct": float(plan_row.get("risk_reduction_pct", 0.0)),
        "patches": patch_rows,
        "verdicts": verdict_rows,
        "rejected": rejected,
        "verdict_counts": counts,
        "summary": summary,
        "max_hops": max_hops,
        "limitations": limitations,
    }


def render_html(context: dict[str, Any]) -> str:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    return env.get_template("template.html").render(**context)


def write_report(
    context: dict[str, Any],
    output_html: Path,
    *,
    output_pdf: Path | None = None,
) -> tuple[Path, Path | None]:
    output_html.parent.mkdir(parents=True, exist_ok=True)
    html = render_html(context)
    output_html.write_text(html, encoding="utf-8")
    pdf_path = None
    if output_pdf is not None:
        try:
            from xhtml2pdf import pisa
        except ImportError as exc:
            raise RuntimeError("PDF export requires xhtml2pdf; install it with: python -m pip install xhtml2pdf") from exc
        output_pdf.parent.mkdir(parents=True, exist_ok=True)
        with output_pdf.open("wb") as target:
            result = pisa.CreatePDF(src=html, dest=target, encoding="utf-8")
        if result.err:
            raise RuntimeError(f"PDF generation failed with {result.err} rendering error(s)")
        pdf_path = output_pdf
    return output_html, pdf_path
