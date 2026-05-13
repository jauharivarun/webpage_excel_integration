from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# `backend/` root — resolve relative to this package so uvicorn works from any cwd.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime configuration loaded from environment and optional `.env` file."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080"
    )
    database_url: str = "sqlite:///./data/app.db"
    max_upload_bytes: int = 10 * 1024 * 1024
    ollama_base_url: str = "http://127.0.0.1:11434"
    # Small default for quick setup; override with OLLAMA_MODEL in .env (e.g. llama3.2 when downloaded).
    ollama_model: str = "qwen2.5:0.5b"
    # OpenAI (optional): when OPENAI_API_KEY is set, column-mapping LLM uses OpenAI instead of Ollama.
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    # When true, ``use_llm`` can call Ollama for unknown column names (ignored if OPENAI_API_KEY is set).
    ollama_enabled: bool = False

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
