from __future__ import annotations

from dataclasses import dataclass

import feedparser
import httpx

RSS_FEEDS = [
    ("PIB", "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Reg=3"),
    ("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss"),
    ("Indian Express", "https://indianexpress.com/section/india/feed/"),
]


@dataclass
class AffairsResult:
    summary: str
    sources: list[str]


def _score_entry(topic: str, title: str, summary: str) -> int:
    t = topic.lower()
    blob = f"{title} {summary}".lower()
    score = 0
    for token in t.replace(",", " ").split():
        if len(token) < 3:
            continue
        if token in blob:
            score += 2
    return score


async def current_affairs_lookup(topic: str | None) -> AffairsResult:
    """Fetch free RSS feeds and return a short grounding snippet for the topic."""
    query = (topic or "India").strip()
    hits: list[tuple[int, str, str, str]] = []

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        for source, url in RSS_FEEDS:
            try:
                res = await client.get(url, headers={"User-Agent": "SpeakEasyBoard/1.0"})
                if res.status_code >= 400:
                    continue
                feed = feedparser.parse(res.text)
                for entry in feed.entries[:12]:
                    title = getattr(entry, "title", "") or ""
                    summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
                    score = _score_entry(query, title, summary)
                    if score > 0 or not hits:
                        hits.append((score, source, title, summary[:280]))
            except Exception:
                continue

    hits.sort(key=lambda x: x[0], reverse=True)
    top = hits[:4]
    if not top:
        return AffairsResult(
            summary=f"No live RSS hit for '{query}'. Ask a principled question without inventing facts.",
            sources=[],
        )

    lines = []
    sources: list[str] = []
    for score, source, title, summary in top:
        sources.append(source)
        clean = " ".join(summary.split())
        lines.append(f"- [{source}] {title}. {clean}")
    return AffairsResult(summary="\n".join(lines), sources=list(dict.fromkeys(sources)))
