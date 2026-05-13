from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import BACKEND_ROOT, get_settings

_engine = None
_SessionLocal = None


def resolve_database_url() -> str:
    """Return SQLAlchemy URL with SQLite paths resolved under ``backend/``."""
    settings = get_settings()
    url = settings.database_url.strip()
    if url.startswith("sqlite:///"):
        rest = url.removeprefix("sqlite:///")
        # Absolute paths on Windows start like "C:/..."; POSIX absolute starts with "/"
        if rest.startswith("/") or (len(rest) > 2 and rest[1] == ":"):
            return url
        db_path = (BACKEND_ROOT / rest).resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"
    return url


def get_engine():
    global _engine
    if _engine is None:
        url = resolve_database_url()
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, connect_args=connect_args, echo=False)
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a DB session and always closes it."""
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sqlite_file_path() -> Path | None:
    """If using SQLite, return the resolved filesystem path to the DB file (else None)."""
    url = resolve_database_url()
    if not url.startswith("sqlite:///"):
        return None
    rest = url.removeprefix("sqlite:///")
    return Path(rest)
