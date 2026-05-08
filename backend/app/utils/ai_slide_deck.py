"""
Slide deck generation: Claude when API key present, heuristic mock fallback.
Animation rules — title slides → zoom, bullets → stagger, steps → slide-up (can be overridden later).
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Literal, Optional

from app.config import settings
from app.schemas.slides_ai import (
    GenerateSlidesRequest,
    GenerateSlidesResponse,
    SlideDeckItem,
)

logger = logging.getLogger(__name__)


def _assign_animation(layout: str) -> str:
    if layout == "title-only":
        return "zoom"
    if layout == "steps":
        return "slide-up"
    if layout in ("title-bullets", "two-column"):
        return "stagger"
    if layout == "highlight":
        return "slide-left"
    if layout == "quote":
        return "fade"
    return "fade"


def _normalize_slide(raw: dict) -> SlideDeckItem:
    layout = raw.get("layout") or "title-bullets"
    if layout not in (
        "title-only",
        "title-bullets",
        "two-column",
        "steps",
        "highlight",
        "quote",
    ):
        layout = "title-bullets"
    content = raw.get("content") or []
    if not isinstance(content, list):
        content = [str(content)]
    else:
        content = [str(c).strip() for c in content if str(c).strip()]
    animation = raw.get("animation") or ""
    if not animation or animation == "none":
        animation = _assign_animation(layout)
    return SlideDeckItem(
        title=str(raw.get("title") or "Slide").strip()[:280],
        content=content,
        layout=layout,
        animation=animation,
    )


def _sentence_chunks(text: str, max_segments: int) -> List[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    out = [p.strip() for p in parts if len(p.strip()) > 24]
    if not out and text:
        out = [text[i : i + 160].strip() for i in range(0, len(text), 160) if text[i : i + 160].strip()]
    return out[:max_segments]


async def persist_generation(topic: str, slides: List[dict], template: Optional[str]) -> None:
    """Insert one row into ai_slide_generations (best-effort)."""
    try:
        from app.utils.database import execute_write

        await execute_write(
            """
            INSERT INTO ai_slide_generations (topic, content, template)
            VALUES ($1, $2::jsonb, $3)
            """,
            topic[:500],
            json.dumps(slides),
            template,
        )
    except Exception as e:
        logger.warning("Could not persist slide generation: %s", e)


def build_mock_slides(req: GenerateSlidesRequest) -> List[SlideDeckItem]:
    """Deterministic mock deck from topic + optional content."""
    topic = req.topic.strip()
    body = (req.content or "").strip()
    n = max(4, min(req.slide_count, 28))
    chunks = _sentence_chunks(body, n * 4) if body else []

    slides: List[SlideDeckItem] = []
    # Title slide
    audience_note = (
        "A session tailored for learners."
        if req.audience == "students"
        else "Technical depth included."
    )
    slides.append(
        SlideDeckItem(
            title=topic,
            content=[audience_note] if req.tone == "simple" else [f"{audience_note} Professional tone."],
            layout="title-only",
            animation=_assign_animation("title-only"),
        )
    )

    labels_intro = ["Overview", "Key ideas", "Why it matters", "Core mechanics", "Common patterns"]
    labels_pro = ["Executive summary", "Framework", "Implications", "Deep dive", "Evidence & nuance"]

    label_pool = labels_intro if req.tone == "simple" else labels_pro
    layouts_pool = ["title-bullets", "two-column", "steps", "highlight", "title-bullets", "quote"]

    idx = 0
    while len(slides) < n:
        layout = layouts_pool[(len(slides) - 1) % len(layouts_pool)]
        title = (
            chunks[idx][:90] + "…"
            if chunks and idx < len(chunks) and len(chunks[idx]) > 90
            else (chunks[idx] if chunks and idx < len(chunks) else f"{label_pool[(len(slides) - 1) % len(label_pool)]}: {topic}")
        )

        if layout == "title-only":
            bullets: List[str] = []
        elif layout == "highlight":
            line = (
                chunks[idx + 1]
                if chunks and idx + 1 < len(chunks)
                else f"Remember: mastering {topic.lower()} builds strong foundations."
            )
            bullets = [line[:320]]
            idx = min(idx + 2, len(chunks))
        elif layout == "quote":
            q = (
                chunks[idx]
                if chunks and idx < len(chunks)
                else f"“Understanding {topic.lower()} changes how we see the subject.”"
            )
            bullets = [q[:400]]
            idx += 1
        elif layout == "steps":
            base = idx
            bullets = []
            for step in range(3):
                if chunks and base + step < len(chunks):
                    bullets.append(f"Step {step + 1}: {chunks[base + step][:140]}")
                else:
                    bullets.append(f"Step {step + 1}: Explore facet {step + 1} of {topic.lower()}.")
            idx = base + 3
        elif layout == "two-column":
            left = chunks[idx] if chunks and idx < len(chunks) else f"{topic}: foundations"
            right = chunks[idx + 1] if chunks and idx + 1 < len(chunks) else f"{topic}: applications"
            bullets = [left[:200], right[:200]]
            idx += 2
        else:
            bullets = []
            for j in range(3):
                if chunks and idx < len(chunks):
                    bullets.append(chunks[idx][:200])
                    idx += 1
                else:
                    bullets.append(f"Point {j + 1}: Connect this idea to classroom examples for {topic.lower()}.")

        slides.append(
            SlideDeckItem(
                title=str(title),
                content=bullets,
                layout=layout,
                animation=_assign_animation(layout),
            )
        )

    return slides[:n]


async def try_claude_slides(req: GenerateSlidesRequest) -> Optional[List[SlideDeckItem]]:
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        from app.utils.claude_ai import generate_educational_slide_deck_json

        raw_slides = await generate_educational_slide_deck_json(
            topic=req.topic.strip(),
            content=req.content or "",
            audience=req.audience,
            tone=req.tone,
            slide_count=req.slide_count,
        )
        if not raw_slides:
            return None
        out = [_normalize_slide(s) for s in raw_slides]
        # Enforce slide count
        n = max(4, min(req.slide_count, 28))
        return out[:n]
    except Exception as e:
        logger.warning("Claude slide generation failed; using mock. %s", e)
        return None


async def generate_slide_deck(req: GenerateSlidesRequest) -> GenerateSlidesResponse:
    deck = await try_claude_slides(req)
    src: Literal["claude", "mock"] = "claude"
    if not deck:
        deck = build_mock_slides(req)
        src = "mock"

    if req.persist and deck:
        await persist_generation(
            req.topic,
            [s.model_dump() for s in deck],
            req.template_id,
        )

    return GenerateSlidesResponse(slides=deck, source=src)
