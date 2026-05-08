"""
Pydantic models for AI slide deck generation API.
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class SlideDeckItem(BaseModel):
    title: str
    content: List[str] = Field(default_factory=list)
    layout: str = "title-bullets"
    animation: str = "fade"


class GenerateSlidesRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    content: Optional[str] = ""
    audience: Literal["students", "advanced"] = "students"
    tone: Literal["simple", "professional"] = "simple"
    slide_count: int = Field(8, ge=4, le=28)
    persist: bool = Field(False, description="Store generation in Postgres (ai_slide_generations)")
    template_id: Optional[str] = Field(None, description="Optional theme id reference for persistence")


class GenerateSlidesResponse(BaseModel):
    slides: List[SlideDeckItem]
    source: Literal["claude", "mock"]


class AISlideTemplateRow(BaseModel):
    id: Optional[str] = None
    name: str
    config: dict
