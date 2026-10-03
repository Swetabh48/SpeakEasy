from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default SQLite so API runs without Docker. For Postgres use:
    # postgresql+psycopg://speakeasy:speakeasy@127.0.0.1:5432/speakeasy
    database_url: str = "sqlite:///./speakeasy_board.db"
    ollama_base_url: str = "http://127.0.0.1:11434"
    # Prefer fine-tuned tag when present; client falls back to llama3.1
    ollama_model: str = "speakeasy-board"
    # Free hosted OpenAI-compatible (e.g. Groq) — tried before Ollama
    evaluator_url: str = ""
    evaluator_model: str = "llama-3.1-8b-instant"
    evaluator_api_key: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    prompt_version: str = "board-v6"
    # False = full agent (planner → tools → LLM generator). True = instant banks only.
    board_fast_mode: bool = False
    ollama_timeout_seconds: float = 90.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
