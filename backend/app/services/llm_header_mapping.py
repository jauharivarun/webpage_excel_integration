"""LLM-backed spreadsheet header → canonical field mapping (OpenAI or Ollama)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import Settings
from app.schemas.candidate import CandidateBase

_CANONICAL = list(CandidateBase.model_fields.keys())


def _build_mapping_prompt(unmapped_headers: list[str]) -> str:
    allowed = ", ".join(_CANONICAL)
    cols_json = json.dumps(unmapped_headers, ensure_ascii=False)
    return (
        "You map recruiting spreadsheet column headers to a fixed list of database fields.\n"
        f"Allowed target fields (use these exact strings as values): {allowed}.\n"
        f"Unmapped column headers from the sheet (JSON array): {cols_json}\n"
        'Return a single JSON object only, shape: {"mappings": {"Original Header": "canonical_field", ...}}.\n'
        "CRITICAL: For each mapping, use the header string EXACTLY as it appears in the JSON array above "
        "(same spelling and punctuation) as the object key.\n"
        "Include only headers you can map with reasonable confidence; omit unknown or useless columns.\n"
        "Examples: 'Exp' or 'YOE' → experience; 'E-mail' → email; 'Phone' → contact; "
        "'Linkedln URL' or 'LI Profile' → linkedin; "
        "'Job title' → current_role; 'Employer' → current_company.\n"
        "Do not map to fields not in the allowed list."
    )


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


def _parse_mapping_payload(content: str) -> tuple[dict[str, str], str | None]:
    """Parse model output into header → canonical strings."""
    try:
        parsed = _extract_json_object(content)
        raw = parsed.get("mappings") or parsed
        if not isinstance(raw, dict):
            return {}, "LLM response missing mappings object"
        allowed_set = set(_CANONICAL)
        out: dict[str, str] = {}
        for k, v in raw.items():
            if not isinstance(k, str) or not isinstance(v, str):
                continue
            if v.strip() in allowed_set:
                out[k.strip()] = v.strip()
        return out, None
    except Exception as e:
        return {}, f"Could not parse LLM JSON: {e!s}"


def _call_openai(prompt: str, settings: Settings) -> tuple[dict[str, str], str | None, bool]:
    api_key = (settings.openai_api_key or "").strip()
    if not api_key:
        return {}, None, False

    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.openai_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            r = client.post(url, headers=headers, json=payload)
            if r.status_code == 400 and "response_format" in (r.text or ""):
                payload.pop("response_format", None)
                r = client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            body = r.json()
    except httpx.HTTPStatusError as e:
        detail = ""
        try:
            detail = e.response.text[:500]
        except Exception:
            pass
        return {}, f"OpenAI HTTP {e.response.status_code}: {detail or e!s}", True
    except Exception as e:
        return {}, f"OpenAI request failed: {e!s}", True

    try:
        choices = body.get("choices") or []
        msg = (choices[0].get("message") or {}) if choices else {}
        content = msg.get("content") or ""
        if not content:
            return {}, "OpenAI response missing message content", True
        mapped, err = _parse_mapping_payload(content)
        return mapped, err, True
    except Exception as e:
        return {}, f"OpenAI response parse error: {e!s}", True


def _call_ollama(prompt: str, settings: Settings) -> tuple[dict[str, str], str | None, bool]:
    if not settings.ollama_enabled:
        return {}, None, False

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
    }
    try:
        with httpx.Client(timeout=90.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            body = r.json()
    except Exception as e:
        return {}, f"Ollama request failed: {e!s}", True

    try:
        msg = body.get("message") or {}
        content = msg.get("content") or ""
        if not content:
            return {}, "Ollama response missing message content", True
        mapped, err = _parse_mapping_payload(content)
        return mapped, err, True
    except Exception as e:
        return {}, f"Could not parse Ollama JSON: {e!s}", True


def run_llm_header_mapping(
    unmapped_headers: list[str],
    settings: Settings,
) -> tuple[dict[str, str], str | None, bool, str | None]:
    """
    Call OpenAI (if ``OPENAI_API_KEY`` is set) else Ollama (if ``OLLAMA_ENABLED``).

    Returns ``(extra_mapping, error, http_attempted, provider)`` where ``provider`` is
    ``\"openai\"``, ``\"ollama\"``, or ``None``.
    """
    if not unmapped_headers:
        return {}, None, False, None

    prompt = _build_mapping_prompt(unmapped_headers)

    if (settings.openai_api_key or "").strip():
        extra, err, attempted = _call_openai(prompt, settings)
        return extra, err, attempted, "openai" if attempted else None

    if settings.ollama_enabled:
        extra, err, attempted = _call_ollama(prompt, settings)
        return extra, err, attempted, "ollama" if attempted else None

    return {}, None, False, None
