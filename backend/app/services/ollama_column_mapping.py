"""Shim: use ``llm_header_mapping.run_llm_header_mapping`` (OpenAI preferred when configured)."""

from __future__ import annotations

from app.config import Settings
from app.services.llm_header_mapping import run_llm_header_mapping


def llm_extend_header_map(
    unmapped_headers: list[str],
    settings: Settings,
) -> tuple[dict[str, str], str | None, bool]:
    """Return ``(extra_mapping, error, http_attempted)`` for backward compatibility."""
    extra, err, att, _prov = run_llm_header_mapping(unmapped_headers, settings)
    return extra, err, att
