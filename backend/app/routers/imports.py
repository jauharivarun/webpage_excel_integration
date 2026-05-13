from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.agent.excel_reader import read_excel_preview
from app.config import Settings, get_settings
from app.schemas.import_validation import ImportValidateResponse, SheetPayload
from app.services.import_validation import get_import_field_catalog, validate_sheet

router = APIRouter()


class ExcelPreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
    row_count: int
    truncated: bool
    validation: ImportValidateResponse | None = None


@router.post("/preview", response_model=ExcelPreviewResponse)
async def preview_excel(
    file: UploadFile = File(...),
    validate: bool = Query(
        False,
        description="If true, include structured validation / discrepancies for the UI.",
    ),
    use_llm: bool = Query(
        False,
        description="If true with validate, try Ollama for unknown headers (requires OLLAMA_ENABLED).",
    ),
    settings: Settings = Depends(get_settings),
) -> ExcelPreviewResponse:
    """
    Upload an Excel file and return the first rows as JSON for UI review.

    This is the first agent building block: Excel → rows; optional validation and optional Ollama column mapping.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=400,
            detail="Upload a `.xlsx` or `.xlsm` file.",
        )
    body = await file.read()
    if len(body) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds configured upload limit.")
    columns, rows = read_excel_preview(body)
    # read_excel_preview already truncates to max_rows inside the agent
    truncated = False  # agent uses fixed cap; expose if we surface total count later
    validation = None
    if validate:
        raw = validate_sheet(columns, rows, use_llm=use_llm, settings=settings)
        validation = ImportValidateResponse.model_validate(raw)
    return ExcelPreviewResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
        validation=validation,
    )


@router.post("/analyze", response_model=ExcelPreviewResponse)
async def analyze_import_excel(
    file: UploadFile = File(...),
    use_llm: bool = Query(
        False,
        description="If true, try Ollama for unknown headers (requires OLLAMA_ENABLED).",
    ),
    settings: Settings = Depends(get_settings),
) -> ExcelPreviewResponse:
    """
    Upload Excel and return preview **with validation always included** (human review step).

    Same response shape as ``/preview`` with ``validate=true``.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(
            status_code=400,
            detail="Upload a `.xlsx` or `.xlsm` file.",
        )
    body = await file.read()
    if len(body) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds configured upload limit.")
    columns, rows = read_excel_preview(body)
    truncated = False
    raw = validate_sheet(columns, rows, use_llm=use_llm, settings=settings)
    validation = ImportValidateResponse.model_validate(raw)
    return ExcelPreviewResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
        validation=validation,
    )


@router.get("/fields")
def list_importable_fields() -> list[dict]:
    """
    Canonical fields the importer accepts, with JSON keys and example spreadsheet headers.

    Use this to build templates or UI copy for recruiters.
    """
    return get_import_field_catalog()


@router.post("/validate", response_model=ImportValidateResponse)
def validate_import_payload(body: SheetPayload) -> ImportValidateResponse:
    """
    Validate already-parsed sheet JSON (same shape as ``/preview`` response).

    Use this after preview so the client can re-run validation without re-uploading the file.
    """
    raw = validate_sheet(
        body.columns,
        body.rows,
        use_llm=body.use_llm,
        settings=get_settings(),
    )
    return ImportValidateResponse.model_validate(raw)
