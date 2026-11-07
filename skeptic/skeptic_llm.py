"""Optional bounded LLM explanations for deterministic Skeptic decisions.

The model is never used to add findings or upgrade a deterministic verdict.
It must return a Verdict-shaped JSON object; evidence must be copied exactly
from deterministic evidence. Results are cached by a stable input hash.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from contracts.models import Verdict


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LLM_CACHE = ROOT / "cache" / "llm"
_STATUS_RANK = {"rejected": 0, "downgraded": 1, "confirmed": 2}


def _cache_path(verdict: Verdict, cache_dir: Path) -> tuple[Path, str]:
    payload = verdict.model_dump(mode="json")
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    return cache_dir / f"{digest}.json", digest


def _read_cache(path: Path) -> Verdict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        verdict = Verdict.model_validate(data)
        return verdict
    except (OSError, json.JSONDecodeError, ValueError, TypeError):
        return None


def _validate_proposal(proposal: Any, base: Verdict) -> Verdict:
    if not isinstance(proposal, dict):
        raise ValueError("model response must be a JSON object")
    candidate = Verdict.model_validate(proposal)
    if candidate.finding_id != base.finding_id:
        raise ValueError("model changed finding_id")
    if _STATUS_RANK[candidate.status] > _STATUS_RANK[base.status]:
        raise ValueError("model may not upgrade the deterministic status")
    if candidate.confidence > base.confidence:
        raise ValueError("model may not increase deterministic confidence")
    allowed = set(base.evidence)
    if not set(candidate.evidence).issubset(allowed):
        raise ValueError("model introduced or altered evidence")
    if len(candidate.reasoning) > 1200 or not candidate.reasoning.strip():
        raise ValueError("model reasoning is empty or too long")
    return candidate


def _request_json(base: Verdict, *, timeout: int = 20) -> Any:
    api_key = os.environ.get("P3_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = (os.environ.get("P3_LLM_BASE_URL") or os.environ.get("OPENAI_API_BASE") or "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("P3_LLM_MODEL", "gpt-4o-mini")
    if not api_key:
        raise RuntimeError("P3_LLM_API_KEY or OPENAI_API_KEY is not set")
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "finding_id": {"type": "string"},
            "status": {"type": "string", "enum": ["confirmed", "downgraded", "rejected"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "evidence": {"type": "array", "items": {"type": "string"}},
            "reasoning": {"type": "string"},
        },
        "required": ["finding_id", "status", "confidence", "evidence", "reasoning"],
    }
    body = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": (
                "You explain, but do not decide, a deterministic security finding verdict. "
                "Return only JSON matching the schema. You may keep or downgrade status, "
                "never upgrade it; do not add evidence; copy evidence items exactly. "
                "Use only the supplied facts and state uncertainty honestly."
            )},
            {"role": "user", "content": json.dumps(base.model_dump(mode="json"), sort_keys=True)},
        ],
        "response_format": {"type": "json_schema", "json_schema": {"name": "Verdict", "strict": True, "schema": schema}},
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read().decode("utf-8"))
    content = result["choices"][0]["message"]["content"]
    if isinstance(content, str):
        # Tolerate a provider that wraps strict JSON in a code fence, then validate.
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.I)
        return json.loads(content)
    return content


def explain_verdict(
    verdict: Verdict,
    *,
    cache_dir: Path = DEFAULT_LLM_CACHE,
    request_fn=None,
) -> Verdict:
    """Return cached/model explanation if valid, otherwise deterministic verdict.

    Invalid output gets one retry. All errors fail closed to the rule-based result.
    """
    path, _ = _cache_path(verdict, cache_dir)
    cached = _read_cache(path)
    if cached is not None:
        try:
            return _validate_proposal(cached.model_dump(mode="json"), verdict)
        except ValueError:
            pass
    if verdict.status != "downgraded":
        return verdict
    call = request_fn or _request_json
    for attempt in range(2):
        try:
            proposal = call(verdict)
            accepted = _validate_proposal(proposal, verdict)
            path.parent.mkdir(parents=True, exist_ok=True)
            temp = path.with_suffix(".tmp")
            temp.write_text(json.dumps(accepted.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8")
            temp.replace(path)
            return accepted
        except Exception:
            if attempt == 1:
                return verdict
    return verdict
