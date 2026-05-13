from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ValidationIssue(BaseModel):
    code: str
    severity: Literal["error", "warning", "info"]
    field: str | None = None
    message: str


class ValidationSummary(BaseModel):
    total_rows: int
    rows_with_issues: int
    sheet_issues: list[ValidationIssue]
    mapped_headers: dict[str, str] = Field(
        description="Original Excel header → canonical field name"
    )
    llm_mapping_applied: bool = Field(
        default=False,
        description="True when an LLM suggested extra header→field mappings (see llm_error if failed).",
    )
    llm_error: str | None = Field(default=None, description="Set when use_llm was on but the LLM call failed.")
    ollama_enabled: bool = Field(
        default=False,
        description="Server config: OLLAMA_ENABLED — used when OPENAI_API_KEY is not set.",
    )
    openai_configured: bool = Field(
        default=False,
        description="True when OPENAI_API_KEY is non-empty (OpenAI takes precedence over Ollama).",
    )
    llm_provider: str | None = Field(
        default=None,
        description="Which backend was used for this request: openai | ollama | null if none.",
    )
    llm_requested: bool = Field(
        default=False,
        description="Client asked for LLM mapping (use_llm query/body).",
    )
    llm_http_attempted: bool = Field(
        default=False,
        description="True if the backend attempted an HTTP call to OpenAI or Ollama for this request.",
    )


class RowValidationResult(BaseModel):
    row_index: int
    mapped: dict[str, Any] | None = Field(
        default=None,
        description="Candidate-shaped dict (camelCase keys) or null if schema rejected",
    )
    issues: list[ValidationIssue]


class ImportValidateResponse(BaseModel):
    summary: ValidationSummary
    rows: list[RowValidationResult]


class SheetPayload(BaseModel):
    """Body from ``/preview`` (columns + rows) for validation without re-uploading the file."""

    columns: list[str]
    rows: list[dict[str, Any]]
    use_llm: bool = Field(
        default=False,
        description="If true and OPENAI_API_KEY or OLLAMA_ENABLED, ask the LLM to map unrecognized headers.",
    )
