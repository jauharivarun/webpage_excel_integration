"""Persist validated import rows into ``candidates`` (Step 4 — simplified commit)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Candidate
from app.schemas.candidate import CandidateBase


def _apply_candidate_to_orm(orm: Candidate, data: CandidateBase) -> None:
    """Update mutable fields; keep existing ``orm.id`` (primary key) on email match."""
    orm.name = data.name.strip()
    orm.email = data.email.strip()
    orm.contact = data.contact.strip()
    orm.linkedin = data.linkedin.strip()
    orm.experience = data.experience
    orm.skills = list(data.skills)
    orm.current_role = data.current_role.strip()
    orm.current_company = data.current_company.strip()


def _upsert_candidate_base(db: Session, data: CandidateBase, row_ref: str) -> tuple[str, list[str]]:
    """
    Upsert one candidate by email.

    Returns ``(outcome, errors)`` where ``outcome`` is ``inserted`` | ``updated`` | ``skipped``.
    """
    errs: list[str] = []
    email_key = (data.email or "").strip().lower()
    if not email_key:
        errs.append(
            f"{row_ref}: empty email — row not saved "
            "(email is required as the unique key for update vs insert)."
        )
        return "skipped", errs

    existing = db.scalars(
        select(Candidate).where(func.lower(func.trim(Candidate.email)) == email_key)
    ).first()

    try:
        with db.begin_nested():
            if existing is not None:
                _apply_candidate_to_orm(existing, data)
            else:
                row = Candidate(
                    id=data.id,
                    name=data.name.strip(),
                    email=data.email.strip(),
                    contact=data.contact.strip(),
                    linkedin=data.linkedin.strip(),
                    experience=data.experience,
                    skills=list(data.skills),
                    current_role=data.current_role.strip(),
                    current_company=data.current_company.strip(),
                )
                db.add(row)
            db.flush()
    except IntegrityError as e:
        errs.append(f"{row_ref}: could not save (duplicate email or DB constraint): {e!s}")
        return "skipped", errs

    if existing is not None:
        return "updated", []
    return "inserted", []


def persist_candidate_bases(db: Session, candidates: list[CandidateBase]) -> dict[str, Any]:
    """Upsert a list of candidates (e.g. after human review on the frontend)."""
    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for i, data in enumerate(candidates):
        outcome, errs = _upsert_candidate_base(db, data, f"index {i}")
        errors.extend(errs)
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }


def persist_import_rows(db: Session, validation_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Upsert each row with a non-null ``mapped`` payload from ``validate_sheet`` output.

    **Email is the merge key** (trimmed, case-insensitive):

    - If a row already exists with the same email → **update** all fields (``id`` unchanged).
    - If no row has that email → **insert** a new row (uses ``id`` from the mapped payload).

    Rows with blank email are **skipped** (not inserted) and reported in ``errors``.
    """
    inserted = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for item in validation_rows:
        mapped = item.get("mapped")
        row_ref = f"row {item.get('row_index')}"
        if not mapped:
            skipped += 1
            continue
        try:
            data = CandidateBase.model_validate(mapped)
        except Exception as e:
            skipped += 1
            errors.append(f"{row_ref}: {e!s}")
            continue

        outcome, errs = _upsert_candidate_base(db, data, row_ref)
        errors.extend(errs)
        if outcome == "inserted":
            inserted += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }
