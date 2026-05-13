"""Structured validation of parsed sheet rows against ``CandidateBase`` (Step 3)."""

from __future__ import annotations

import re
import unicodedata
import uuid
from typing import Any, Literal

from pydantic import ValidationError

from app.config import Settings, get_settings
from app.schemas.candidate import CandidateBase
from app.services.llm_header_mapping import run_llm_header_mapping

Severity = Literal["error", "warning", "info"]


def _norm_header(s: str) -> str:
    """
    Normalize a spreadsheet header for alias lookup.

    Handles spaces/hyphens, **camelCase / PascalCase** (``CurrentRole`` → ``current_role``),
    and digit boundaries (``exp3`` → ``exp_3`` — rare).
    """
    t = unicodedata.normalize("NFKC", str(s)).strip()
    if not t:
        return ""
    # NBSP / narrow NBSP / thin space / ideographic space → ASCII space (Excel often uses these).
    t = re.sub(r"[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]+", " ", t)
    t = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", t)
    t = re.sub(r"([A-Za-z])([0-9])", r"\1_\2", t)
    t = t.replace(" ", "_").replace("-", "_")
    t = re.sub(r"_+", "_", t)
    return t.lower().strip("_")


# Normalized header → canonical attribute name on CandidateBase (early-stage fields only).
_HEADER_ALIASES: dict[str, str] = {
    "id": "id",
    "candidateid": "id",
    "candidate_id": "id",
    "uuid": "id",
    "name": "name",
    "fullname": "name",
    "full_name": "name",
    "candidate_name": "name",
    "applicant": "name",
    "email": "email",
    "e-mail": "email",
    "e_mail": "email",
    "mail": "email",
    "email_address": "email",
    "work_email": "email",
    "contact": "contact",
    "phone": "contact",
    "mobile": "contact",
    "linkedin": "linkedin",
    "linked_in": "linkedin",
    "linkedin_url": "linkedin",
    "linkedin_profile": "linkedin",
    "linkedln": "linkedin",
    "linkdin": "linkedin",
    "linked_in_link": "linkedin",
    "linkedin_link": "linkedin",
    "li_profile": "linkedin",
    "linkedin_handle": "linkedin",
    "social_linkedin": "linkedin",
    "profile_url": "linkedin",
    "experience": "experience",
    "years": "experience",
    "yoe": "experience",
    "years_of_experience": "experience",
    "exp": "experience",
    "exps": "experience",
    "total_experience": "experience",
    "total_exp": "experience",
    "work_experience": "experience",
    "professional_experience": "experience",
    "industry_experience": "experience",
    "tenure": "experience",
    "skills": "skills",
    "skill": "skills",
    "tech_stack": "skills",
    "currentrole": "current_role",
    "current_role": "current_role",
    "current_position": "current_role",
    "position": "current_role",
    "job": "current_role",
    "job_title": "current_role",
    "job_role": "current_role",
    "role_title": "current_role",
    "designation": "current_role",
    "role": "current_role",
    "title": "current_role",
    "currentcompany": "current_company",
    "current_company": "current_company",
    "company": "current_company",
    "company_name": "current_company",
    "organization": "current_company",
    "organisation": "current_company",
    "org_name": "current_company",
    "employer": "current_company",
}

# Spreadsheet columns we do not import (ignored silently — no UNMAPPED warning).
_LEGACY_HEADER_NORM: frozenset[str] = frozenset(
    {
        _norm_header(h)
        for h in [
            "matchScore",
            "match_score",
            "score",
            "status",
            "location",
            "city",
            "education",
            "degree",
            "expectedSalary",
            "expected_salary",
            "salary",
            "noticePeriod",
            "notice_period",
            "notice",
            "summary",
            "bio",
            "resumeFile",
            "resume",
            "cv",
            "appliedFor",
            "applied_for",
            "appliedDate",
            "applied_date",
            "date_applied",
        ]
    }
)


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value).strip()


def _coerce_int(value: Any) -> tuple[int | None, bool]:
    """Return (int or None, ok)."""
    if value is None or value == "":
        return None, True
    if isinstance(value, bool):
        return None, False
    if isinstance(value, int):
        return value, True
    if isinstance(value, float):
        if value != value:  # NaN
            return None, False
        return int(round(value)), True
    s = str(value).strip()
    if not s:
        return None, True
    try:
        return int(float(s)), True
    except ValueError:
        return None, False


def _parse_experience_years(value: Any) -> tuple[int, list[dict[str, Any]]]:
    """
    Parse experience as integer years.

    Accepts plain numbers and strings like ``3 Years``, ``5 yrs``, ``1+``.
    Returns ``(years, issues)`` — issues only when non-empty input could not be parsed.
    """
    issues: list[dict[str, Any]] = []
    if value is None:
        return 0, issues
    s = str(value).strip()
    if not s:
        return 0, issues

    n_plain, ok = _coerce_int(value)
    if ok and n_plain is not None:
        y = max(0, min(n_plain, 80))
        return y, issues

    m = re.search(r"(\d+)", s)
    if m:
        y = int(m.group(1))
        y = max(0, min(y, 80))
        return y, issues

    issues.append(
        {
            "code": "INVALID_TYPE",
            "severity": "error",
            "field": "experience",
            "message": f"Could not parse `{value!r}` as years of experience; defaulted to 0.",
        }
    )
    return 0, issues


def _coerce_skills(value: Any) -> tuple[list[str], bool]:
    if value is None or value == "":
        return [], True
    if isinstance(value, list):
        out = [str(x).strip() for x in value if str(x).strip()]
        return out, True
    s = str(value).strip()
    if not s:
        return [], True
    parts = re.split(r"[,;/|]", s)
    return [p.strip() for p in parts if p.strip()], True


def _build_header_to_canonical(columns: list[str]) -> dict[str, str]:
    """Excel header string → canonical field (first wins)."""
    mapping: dict[str, str] = {}
    for col in columns:
        key = _norm_header(col)
        canon = _HEADER_ALIASES.get(key)
        if canon:
            mapping[col] = canon
    return mapping


def _discover_sheet_headers(columns: list[str], rows: list[dict[str, Any]]) -> list[str]:
    """
    All header names to consider for mapping.

    Uses the ``columns`` list first (sheet order), then any keys present in row dicts
    that were not listed (fixes Postman / clients that omit headers but include cells).
    """
    seen: set[str] = set()
    ordered: list[str] = []
    for c in columns:
        if c is None:
            continue
        cs = str(c).strip()
        if not cs or cs in seen:
            continue
        seen.add(cs)
        ordered.append(cs)
    for row in rows:
        for k in row:
            if k is None:
                continue
            ks = str(k).strip()
            if not ks or ks in seen:
                continue
            seen.add(ks)
            ordered.append(ks)
    return ordered


def _canonical_fields() -> list[str]:
    return list(CandidateBase.model_fields.keys())


_OPTIONAL_MISSING_COLUMN_FIELDS = frozenset(
    {
        "email",
        "contact",
        "linkedin",
        "experience",
        "skills",
        "current_role",
        "current_company",
    }
)


def _merge_llm_mappings_into_header_map(
    header_map: dict[str, str],
    extra_from_llm: dict[str, str],
    unmapped_headers: list[str],
) -> None:
    """
    Apply Ollama suggestions to ``header_map`` in-place.

    Matches LLM keys to real Excel headers by exact string, then by normalized form.
    """
    if not extra_from_llm or not unmapped_headers:
        return

    allowed = frozenset(CandidateBase.model_fields.keys())
    unmapped_set = set(unmapped_headers)
    norm_to_original: dict[str, str] = {}
    for u in unmapped_headers:
        norm_to_original.setdefault(_norm_header(u), u)

    for raw_key, canon in extra_from_llm.items():
        if not isinstance(raw_key, str) or not isinstance(canon, str):
            continue
        ck = canon.strip()
        ks = raw_key.strip()
        if ck not in allowed:
            continue
        if ks in header_map:
            continue

        if ks in unmapped_set:
            header_map[ks] = ck
            continue

        kn = _norm_header(ks)
        orig = norm_to_original.get(kn)
        if orig is not None and orig not in header_map:
            header_map[orig] = ck
            continue

        for u in unmapped_headers:
            if u in header_map:
                continue
            if _norm_header(u) == kn:
                header_map[u] = ck
                break


def get_import_field_catalog() -> list[dict[str, Any]]:
    """Human-readable list of importable candidate fields for UI / spreadsheet templates."""
    return [
        {
            "canonical": "id",
            "json_key": "id",
            "required": False,
            "auto_generated_if_missing": True,
            "description": "Stable unique id; a UUID is generated when the sheet does not provide one.",
            "example_headers": ["Id", "Candidate ID", "UUID"],
        },
        {
            "canonical": "name",
            "json_key": "name",
            "required": True,
            "auto_generated_if_missing": False,
            "description": "Full name as the candidate entered it.",
            "example_headers": ["Name", "Full Name", "Candidate Name", "Applicant"],
        },
        {
            "canonical": "email",
            "json_key": "email",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Primary email for outreach.",
            "example_headers": ["Email", "E-mail", "Email Address", "Work Email"],
        },
        {
            "canonical": "contact",
            "json_key": "contact",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Phone or messaging contact.",
            "example_headers": ["Contact", "Phone", "Mobile"],
        },
        {
            "canonical": "linkedin",
            "json_key": "linkedin",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "LinkedIn profile URL or handle.",
            "example_headers": ["LinkedIn", "LinkedIn URL", "LinkedIn Profile"],
        },
        {
            "canonical": "experience",
            "json_key": "experience",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Years of professional experience (integer). Values like “3 Years” are parsed.",
            "example_headers": ["Experience", "Exp", "YOE", "Years", "Years of Experience"],
        },
        {
            "canonical": "skills",
            "json_key": "skills",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Comma / semicolon / pipe separated skills, or JSON array.",
            "example_headers": ["Skills", "Tech Stack", "Skill"],
        },
        {
            "canonical": "current_role",
            "json_key": "currentRole",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Current job title (pre-interview).",
            "example_headers": ["Current Role", "CurrentRole", "Title", "Role", "Job Title"],
        },
        {
            "canonical": "current_company",
            "json_key": "currentCompany",
            "required": False,
            "auto_generated_if_missing": False,
            "description": "Current employer name.",
            "example_headers": ["Current Company", "CurrentCompany", "Company", "Employer"],
        },
    ]


def validate_sheet(
    columns: list[str],
    rows: list[dict[str, Any]],
    *,
    use_llm: bool = False,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Return a JSON-serializable structure: summary, per-row mapped candidate + issues.

    Missing sheet columns → sheet-level issues; bad cell values → row issues;
    defaults fill gaps before final ``CandidateBase`` parse.

    When ``use_llm`` is true and ``OPENAI_API_KEY`` or ``OLLAMA_ENABLED`` is set, unknown headers are
    sent to OpenAI (preferred) or Ollama for extra mappings.
    """
    settings = settings or get_settings()
    all_headers = _discover_sheet_headers(columns, rows)
    header_map: dict[str, str] = dict(_build_header_to_canonical(all_headers))
    llm_error: str | None = None
    llm_mapping_applied = False
    llm_http_attempted = False
    llm_requested = use_llm
    ollama_enabled_flag = settings.ollama_enabled
    openai_configured = bool((settings.openai_api_key or "").strip())
    llm_provider_used: str | None = None

    unmapped_for_llm = [
        c
        for c in all_headers
        if c not in header_map and _norm_header(c) not in _LEGACY_HEADER_NORM
    ]
    if use_llm:
        llm_can_run = bool(unmapped_for_llm) and (
            openai_configured or settings.ollama_enabled
        )
        if llm_can_run:
            extra, llm_error, llm_http_attempted, llm_provider_used = run_llm_header_mapping(
                unmapped_for_llm, settings
            )
            n_keys_before = len(header_map)
            _merge_llm_mappings_into_header_map(header_map, extra, unmapped_for_llm)
            llm_mapping_applied = len(header_map) > n_keys_before
        elif not openai_configured and not settings.ollama_enabled:
            llm_error = (
                "LLM mapping skipped: set OPENAI_API_KEY (recommended) or OLLAMA_ENABLED=true in "
                "backend/.env, then restart the API."
            )

    covered_canonical = set(header_map.values())

    still_unmapped = [
        c
        for c in all_headers
        if c not in header_map and _norm_header(c) not in _LEGACY_HEADER_NORM
    ]

    sheet_issues: list[dict[str, Any]] = []
    for field in _canonical_fields():
        if field == "id":
            continue  # generated if absent
        if field not in covered_canonical:
            if field in _OPTIONAL_MISSING_COLUMN_FIELDS and still_unmapped:
                # Avoid claiming "column missing" when extra columns exist but are not mapped yet
                # (e.g. renamed "Linkedin" — show UNMAPPED_HEADER / LLM instead).
                continue
            sheet_issues.append(
                {
                    "code": "MISSING_COLUMN",
                    "severity": "warning",
                    "field": field,
                    "message": f"No spreadsheet column mapped to `{field}`. Values will default until the user maps or edits them.",
                }
            )

    row_results: list[dict[str, Any]] = []
    rows_with_any_issue = 0

    for idx, raw in enumerate(rows):
        issues: list[dict[str, Any]] = []
        data: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "name": "",
            "email": "",
            "contact": "",
            "linkedin": "",
            "experience": 0,
            "skills": [],
            "current_role": "",
            "current_company": "",
        }

        for excel_header, cell in raw.items():
            if excel_header not in header_map:
                if str(excel_header).strip() == "":
                    continue
                nh = _norm_header(excel_header)
                if nh in _LEGACY_HEADER_NORM:
                    continue
                issues.append(
                    {
                        "code": "UNMAPPED_HEADER",
                        "severity": "info",
                        "field": None,
                        "message": f"Column `{excel_header}` is not mapped to a known candidate field.",
                    }
                )
                continue
            canon = header_map[excel_header]
            if canon == "id":
                s = _coerce_str(cell)
                if s:
                    data["id"] = s
            elif canon in ("name", "email", "contact", "linkedin", "current_role", "current_company"):
                data[canon] = _coerce_str(cell)
            elif canon == "experience":
                y, exp_issues = _parse_experience_years(cell)
                data["experience"] = y
                issues.extend(exp_issues)
            elif canon == "skills":
                skills, _ok = _coerce_skills(cell)
                data["skills"] = skills

        if not data["name"]:
            issues.append(
                {
                    "code": "MISSING_VALUE",
                    "severity": "warning",
                    "field": "name",
                    "message": "Name is empty after mapping; user should confirm before commit.",
                }
            )

        email = data.get("email", "")
        if email and "@" not in email:
            issues.append(
                {
                    "code": "INVALID_EMAIL",
                    "severity": "warning",
                    "field": "email",
                    "message": f"Email `{email}` looks invalid (no `@`); stored as-is.",
                }
            )

        mapped: dict[str, Any] | None
        try:
            model = CandidateBase.model_validate(data)
            mapped = model.model_dump(mode="json", by_alias=True)
        except ValidationError as e:
            issues.append(
                {
                    "code": "SCHEMA_REJECT",
                    "severity": "error",
                    "field": None,
                    "message": str(e),
                }
            )
            mapped = None

        if issues:
            rows_with_any_issue += 1

        row_results.append({"row_index": idx, "mapped": mapped, "issues": issues})

    summary = {
        "total_rows": len(rows),
        "rows_with_issues": rows_with_any_issue,
        "sheet_issues": sheet_issues,
        "mapped_headers": header_map,
        "llm_mapping_applied": llm_mapping_applied,
        "llm_error": llm_error,
        "ollama_enabled": ollama_enabled_flag,
        "openai_configured": openai_configured,
        "llm_provider": llm_provider_used,
        "llm_requested": llm_requested,
        "llm_http_attempted": llm_http_attempted,
    }
    return {"summary": summary, "rows": row_results}
