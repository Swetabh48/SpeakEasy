from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default SQLite so API runs without Docker. For Postgres use:
    # postgresql+psycopg://speakeasy:speakeasy@127.0.0.1:5432/speakeasy
    database_url: str = "sqlite:///./speakeasy_board.db"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1:latest"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    prompt_version: str = "board-v5"
    # False = full agent (planner → tools → Ollama generator). True = instant banks only.
    board_fast_mode: bool = False
    ollama_timeout_seconds: float = 90.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
