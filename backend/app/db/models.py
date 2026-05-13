from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ImportBatchStatus(str, enum.Enum):
    pending_review = "pending_review"
    processing = "processing"
    ready_to_commit = "ready_to_commit"
    committed = "committed"
    failed = "failed"
    cancelled = "cancelled"


class ImportBatch(Base):
    """One uploaded spreadsheet run through extract → review → commit."""

    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )
    original_filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[ImportBatchStatus] = mapped_column(
        Enum(ImportBatchStatus, native_enum=False, length=32),
        default=ImportBatchStatus.pending_review,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    staging_rows: Mapped[list["ImportStagingRow"]] = relationship(
        back_populates="batch",
        cascade="all, delete-orphan",
    )


class ImportStagingRow(Base):
    """One spreadsheet row held for mapping validation before merging into `candidates`."""

    __tablename__ = "import_staging_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(
        # CASCADE: deleting an import batch removes its staging rows only (cleanup).
        # This is not a business hierarchy with ``candidates`` — ``candidates`` has no FK here.
        String(36), ForeignKey("import_batches.id", ondelete="CASCADE"), index=True
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_cells_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    mapped_candidate_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    issues_json: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)

    batch: Mapped["ImportBatch"] = relationship(back_populates="staging_rows")


class Candidate(Base):
    """Persisted candidate aligned with the frontend `Candidate` shape (snake_case in DB)."""

    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    contact: Mapped[str] = mapped_column(String(128), default="")
    linkedin: Mapped[str] = mapped_column(String(512), default="")
    experience: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    current_role: Mapped[str] = mapped_column(String(255), default="")
    current_company: Mapped[str] = mapped_column(String(255), default="")
