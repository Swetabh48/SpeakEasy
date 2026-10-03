from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import get_settings
from app.db import Base, engine
from app.routes import board, eval as eval_routes
from app.schemas import HealthResponse

# Import models so metadata is registered
from app import models  # noqa: F401

settings = get_settings()

app = FastAPI(title="SpeakEasy Board API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(board.router)
app.include_router(eval_routes.router)


def _migrate_sqlite_columns() -> None:
    """Add columns introduced after initial schema without wiping the DB."""
    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    tables = insp.get_table_names()
    alters: list[str] = []
    if "board_turns" in tables:
        existing = {c["name"] for c in insp.get_columns("board_turns")}
        if "speaker_id" not in existing:
            alters.append("ALTER TABLE board_turns ADD COLUMN speaker_id VARCHAR(64)")
        if "category" not in existing:
            alters.append("ALTER TABLE board_turns ADD COLUMN category VARCHAR(64)")
        if "is_follow_up" not in existing:
            alters.append(
                "ALTER TABLE board_turns ADD COLUMN is_follow_up BOOLEAN DEFAULT 0 NOT NULL"
            )
    if "board_sessions" in tables:
        sess_cols = {c["name"] for c in insp.get_columns("board_sessions")}
        if "memory_json" not in sess_cols:
            alters.append("ALTER TABLE board_sessions ADD COLUMN memory_json JSON")
    if not alters:
        return
    with engine.begin() as conn:
        for stmt in alters:
            conn.execute(text(stmt))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_columns()


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok")
