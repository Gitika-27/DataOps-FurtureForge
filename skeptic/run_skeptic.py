"""Run Person 3 review, then P2 graph/optimization, verification, and reporting."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from contracts.models import Verdict
from core.pipeline import run_verified_planner
from report.build_report import build_report_context, write_report
from skeptic.skeptic_rules import review_findings
from skeptic.skeptic_llm import explain_verdict

ROOT = Path(__file__).resolve().parents[1]


def _load(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Input file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    for field in ("assets", "services", "findings", "reach"):
        if not isinstance(data.get(field), list):
            raise ValueError(f"Input must contain a '{field}' array")
    return data


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(path)


def _asset_is_synthetic(document: dict[str, Any]) -> bool:
    text = json.dumps(document).lower()
    return "synthetic" in text or '"generated_at": "mock"' in text


def run_review_pipeline(
    document: dict[str, Any],
    *,
    output_dir: Path,
    controls: list[dict[str, Any]] | None = None,
    llm_explanations: bool = False,
    create_pdf: bool = False,
    max_hops: int = 8,
    use_ilp: bool = True,
) -> dict[str, Any]:
    """Run deterministic P3 review followed by P2 planning and report outputs."""
    verdicts, graph_findings = review_findings(
        document["findings"],
        assets=document["assets"],
        services=document["services"],
        reach=document["reach"],
        controls=controls,
    )
    if llm_explanations:
        cache_dir = ROOT / "cache" / "llm"
        verdicts = [explain_verdict(v, cache_dir=cache_dir) if v.status == "downgraded" else v for v in verdicts]

    planner = run_verified_planner(
        document["assets"],
        document["reach"],
        graph_findings,
        verdicts,
        max_hops=max_hops,
        use_ilp=use_ilp,
    )
    graph = planner["graph"]
    graph_payload = {
        "nodes": [{"id": str(node), **data} for node, data in graph.nodes(data=True)],
        "edges": [{"src": str(src), "dst": str(dst), **data} for src, dst, data in graph.edges(data=True)],
    }
    plan_payload = planner["plan"].model_dump(mode="json")
    verdict_payload = [verdict.model_dump(mode="json") for verdict in verdicts]
    finding_payload = [finding.model_dump(mode="json") for finding in graph_findings]
    output_dir.mkdir(parents=True, exist_ok=True)
    _write_json(output_dir / "verdicts.json", {"lab_id": document.get("lab_id", "unknown"), "verdicts": verdict_payload})
    _write_json(output_dir / "reviewed_findings.json", {"lab_id": document.get("lab_id", "unknown"), "findings": finding_payload})
    _write_json(output_dir / "plan.json", {
        "lab_id": document.get("lab_id", "unknown"),
        "status": planner["status"],
        "warning": planner["warning"],
        "plan": plan_payload,
        "verification": planner["verification"],
        "paths": planner["paths"],
    })
    _write_json(output_dir / "graph.json", graph_payload)

    context = build_report_context(
        lab_id=str(document.get("lab_id", "unknown")),
        verdicts=verdicts,
        findings=graph_findings,
        plan=planner["plan"],
        status=planner["status"],
        max_hops=max_hops,
        synthetic=_asset_is_synthetic(document),
        extra_limitations=[
            str(note) for note in (document.get("notes") or [])
            if "synthetic" in str(note).lower()
        ],
    )
    html_path = output_dir / "report.html"
    pdf_path = output_dir / "report.pdf" if create_pdf else None
    write_report(context, html_path, output_pdf=pdf_path)

    result = {
        "status": planner["status"],
        "warning": planner["warning"],
        "verdict_count": len(verdicts),
        "graph_finding_count": len(graph_findings),
        "graph_node_count": graph.number_of_nodes(),
        "graph_edge_count": graph.number_of_edges(),
        "paths_before": plan_payload["paths_before"],
        "paths_after": plan_payload["paths_after"],
        "patches": plan_payload["patches"],
        "outputs": {
            "verdicts": str(output_dir / "verdicts.json"),
            "findings": str(output_dir / "reviewed_findings.json"),
            "graph": str(output_dir / "graph.json"),
            "plan": str(output_dir / "plan.json"),
            "report_html": str(html_path),
            "report_pdf": str(pdf_path) if pdf_path else None,
        },
    }
    _write_json(output_dir / "skeptic_result.json", result)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="P2 findings.json input")
    parser.add_argument("--output-dir", type=Path, help="directory for verdicts, plan, graph, and report")
    parser.add_argument("--controls", type=Path, help="optional JSON array of explicitly blocking controls")
    parser.add_argument("--llm-explanations", action="store_true", help="use optional cached LLM explanations; requires an API key")
    parser.add_argument("--pdf", action="store_true", help="also produce report.pdf (xhtml2pdf)")
    parser.add_argument("--max-hops", type=int, default=8)
    parser.add_argument("--greedy", action="store_true", help="force deterministic greedy optimizer fallback")
    args = parser.parse_args(argv)
    try:
        document = _load(args.input.resolve())
        controls = None
        if args.controls:
            parsed = json.loads(args.controls.read_text(encoding="utf-8"))
            if not isinstance(parsed, list) or not all(isinstance(row, dict) for row in parsed):
                raise ValueError("--controls file must be a JSON array of control objects")
            controls = parsed
        output_dir = (args.output_dir or args.input.resolve().parent).resolve()
        result = run_review_pipeline(
            document,
            output_dir=output_dir,
            controls=controls,
            llm_explanations=args.llm_explanations,
            create_pdf=args.pdf,
            max_hops=args.max_hops,
            use_ilp=not args.greedy,
        )
        print(json.dumps(result, indent=2))
        if result["status"] == "verified":
            print("Verified: paths_after is 0 for the bounded modeled graph.")
        elif result["status"] == "no_modeled_paths":
            print("Warning: no supported paths were modeled; this is not proof of safety.")
        return 0
    except (OSError, ValueError, TypeError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
