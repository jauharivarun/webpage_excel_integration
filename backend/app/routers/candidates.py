from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.agent.excel_reader import read_excel_preview
from app.config import Settings, get_settings
from app.db.session import get_db
from app.db.models import Candidate
from app.schemas.candidate import BulkCommitRequest, CandidateBase
from app.services.import_persist import persist_candidate_bases, persist_import_rows
from app.services.import_validation import validate_sheet
from pydantic import BaseModel
from sqlalchemy import select

router = APIRouter()


class ImportResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: list[str]


@router.get("", response_model=list[CandidateBase])
def list_candidates(db: Session = Depends(get_db)) -> list[CandidateBase]:
    """Return all persisted candidates (empty list until imports are committed)."""
    rows = db.scalars(select(Candidate).order_by(Candidate.created_at.desc())).all()
    return [CandidateBase.model_validate(r, from_attributes=True) for r in rows]


@router.post("/commit", response_model=ImportResult)
def commit_candidates(body: BulkCommitRequest, db: Session = Depends(get_db)) -> ImportResult:
    """
    Upsert reviewed candidate rows (same merge rule as file import: **email** is the key).

    Use after ``POST /api/imports/analyze`` and human edits in the UI.
    """
    stats = persist_candidate_bases(db, body.candidates)
    db.commit()
    return ImportResult(**stats)


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    row = db.get(Candidate, candidate_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/import", response_model=ImportResult)
async def import_candidates_xlsx(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    use_llm: bool = Query(
        False,
        description="If true, map unknown Excel headers via Ollama (requires OLLAMA_ENABLED).",
    ),
) -> ImportResult:
    """
    Upload ``.xlsx`` / ``.xlsm``, validate rows, upsert into SQLite ``candidates``.

    **Merge rule:** non-blank **email** (trimmed, case-insensitive) is the unique key.
    Same email as an existing row → **update** that row; new email → **insert**.
    Rows with blank email are skipped (see ``errors`` in the response).

    Rows without a valid ``mapped`` payload after validation are skipped.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload a `.xlsx` or `.xlsm` file.")
    body = await file.read()
    if len(body) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds configured upload limit.")
    columns, rows = read_excel_preview(body)
    raw = validate_sheet(columns, rows, use_llm=use_llm, settings=settings)
    stats = persist_import_rows(db, raw["rows"])
    db.commit()
    return ImportResult(**stats)
