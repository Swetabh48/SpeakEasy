from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import get_settings

_last_source = "none"
_last_model = ""


def last_llm_meta() -> dict[str, str]:
    return {"source": _last_source, "model": _last_model}


async def _chat_completions(
    base_url: str,
    model: str,
    api_key: str | None,
    system: str,
    user: str,
    temperature: float,
    timeout: float,
) -> str:
    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code >= 400:
            return ""
        data = res.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        return ((choices[0].get("message") or {}).get("content") or "").strip()


async def _ollama_has_model(base_url: str, name: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{base_url.rstrip('/')}/api/tags")
            if res.status_code >= 400:
                return False
            models = (res.json() or {}).get("models") or []
            want = name.lower()
            for m in models:
                n = str(m.get("name") or "").lower()
                if n == want or n.startswith(f"{want}:") or n.startswith(want):
                    return True
    except Exception:
        return False
    return False


async def _resolve_ollama_model(base_url: str, configured: str) -> str:
    if configured and await _ollama_has_model(base_url, configured):
        return configured
    if await _ollama_has_model(base_url, "speakeasy-board"):
        return "speakeasy-board"
    return configured or "llama3.1:latest"


async def board_chat(
    system: str,
    user: str,
    temperature: float = 0.3,
    timeout_seconds: float | None = None,
) -> str:
    """Free hosted EVALUATOR_* → Ollama (prefer speakeasy-board) → ''."""
    global _last_source, _last_model
    settings = get_settings()
    hosted_timeout = timeout_seconds or min(20.0, settings.ollama_timeout_seconds)
    ollama_timeout = timeout_seconds or settings.ollama_timeout_seconds

    if settings.evaluator_url:
        try:
            content = await _chat_completions(
                settings.evaluator_url,
                settings.evaluator_model,
                settings.evaluator_api_key or None,
                system,
                user,
                temperature,
                hosted_timeout,
            )
            if content:
                _last_source = "evaluator"
                _last_model = settings.evaluator_model
                return content
        except Exception:
            pass

    try:
        model = await _resolve_ollama_model(settings.ollama_base_url, settings.ollama_model)
        url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
        payload = {
            "model": model,
            "stream": False,
            "options": {"temperature": temperature},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        async with httpx.AsyncClient(timeout=ollama_timeout) as client:
            res = await client.post(url, json=payload)
            if res.status_code >= 400:
                _last_source = "none"
                _last_model = ""
                return ""
            data = res.json()
            content = ((data.get("message") or {}).get("content") or "").strip()
            if content:
                _last_source = "ollama"
                _last_model = model
                return content
    except Exception:
        pass

    _last_source = "none"
    _last_model = ""
    return ""


async def ollama_chat(system: str, user: str, temperature: float = 0.3) -> str:
    """Back-compat alias used by planner/generator."""
    return await board_chat(system, user, temperature=temperature)


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
