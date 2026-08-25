from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import get_settings


async def ollama_chat(system: str, user: str, temperature: float = 0.3) -> str:
    """Call local Ollama chat API. Returns empty string if unavailable."""
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "options": {"temperature": temperature},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            res = await client.post(url, json=payload)
            if res.status_code >= 400:
                return ""
            data = res.json()
            return (data.get("message") or {}).get("content") or ""
    except Exception:
        return ""


def extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    raw = text.strip()
    if "```" in raw:
        parts = raw.split("```")
        for p in parts:
            chunk = p.strip()
            if chunk.startswith("json"):
                chunk = chunk[4:].strip()
            if chunk.startswith("{"):
                raw = chunk
                break
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(raw[start : end + 1])
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None
