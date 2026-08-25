"""CLI entry for eval harness: python -m app.eval.run_eval"""

from __future__ import annotations

import asyncio

from app.db import SessionLocal
from app.routes.eval import run_eval
from app.schemas import EvalRunRequest


async def main() -> None:
    db = SessionLocal()
    try:
        result = await run_eval(EvalRunRequest(notes="cli run"), db)
        print(result.model_dump())
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
