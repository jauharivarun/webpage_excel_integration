"""Import pipeline: Excel ingestion, validation, optional LLM normalization (later steps)."""

from app.agent.excel_reader import read_excel_preview

__all__ = ["read_excel_preview"]
