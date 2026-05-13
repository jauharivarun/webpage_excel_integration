"""Read `.xlsx` data using pandas + openpyxl (open-source stack)."""

from __future__ import annotations

import io
from typing import Any

import pandas as pd


def _cell_to_json_safe(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return str(value)
    return value


DEFAULT_PREVIEW_ROWS = 500


def read_excel_preview(
    content: bytes,
    *,
    sheet_name: str | int = 0,
    max_rows: int = DEFAULT_PREVIEW_ROWS,
) -> tuple[list[str], list[dict[str, Any]]]:
    """
    Parse Excel bytes into header names and row dictionaries.

    Reads at most ``max_rows`` data rows so large uploads stay bounded during preview.
    """
    buffer = io.BytesIO(content)
    df = pd.read_excel(
        buffer,
        sheet_name=sheet_name,
        dtype=object,
        engine="openpyxl",
        nrows=max_rows,
    )
    columns = [str(c).strip() for c in df.columns]
    raw_rows = df.to_dict(orient="records")
    rows: list[dict[str, Any]] = []
    for raw in raw_rows:
        row = {str(k).strip(): _cell_to_json_safe(v) for k, v in raw.items()}
        rows.append(row)
    return columns, rows
