"""
AI Performance Analysis
Uses Claude to generate student-level insights: exam readiness, dropout risk,
topics needing reinforcement, and intervention recommendations.
Called nightly by the cron endpoint for at-risk students.
"""
import json
import logging
from datetime import date
from typing import Optional

from anthropic import AsyncAnthropic, APIStatusError
from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncAnthropic] = None


def _get_client() -> Optional[AsyncAnthropic]:
    global _client
    key = (settings.ANTHROPIC_API_KEY or "").strip()
    if not key or len(key) < 20 or "your" in key.lower():
        return None
    if _client is None:
        _client = AsyncAnthropic(api_key=key)
    return _client


async def analyze_student_performance(
    student_id: str,
    student_name: str,
    past_30_days_data: dict,
) -> dict:
    """
    Send 30 days of student metrics to Claude and return structured insights.
    Returns a safe fallback dict if Claude is unavailable.
    """
    client = _get_client()
    if client is None:
        return _fallback_insights(past_30_days_data)

    prompt = f"""You are an educational performance analyst. Analyze the following 30-day performance
data for a student and return a JSON object with these exact keys:

- exam_readiness_score: integer 0-100
- dropout_risk: one of "low", "medium", "high"
- topics_needing_reinforcement: list of strings (topic names, max 5)
- learning_style_patterns: object with keys "preferred_time" (morning/evening/varied),
  "engagement_type" (visual/quiz-driven/discussion), "consistency" (high/medium/low)
- recommended_interventions: list of strings (actionable steps, max 5)
- confidence_score: float 0-1 representing your confidence in these predictions

Student: {student_name}
Data: {json.dumps(past_30_days_data, default=str)}

Respond with ONLY valid JSON, no markdown, no explanation."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except (APIStatusError, json.JSONDecodeError, Exception) as e:
        logger.warning("AI student analysis failed for %s: %s", student_id, e)
        return _fallback_insights(past_30_days_data)


async def analyze_class_performance(class_id: str, class_name: str, data: dict) -> dict:
    """
    Class-level Claude analysis for teacher PD recommendations.
    Returns safe fallback if Claude unavailable.
    """
    client = _get_client()
    if client is None:
        return _fallback_class_insights(data)

    prompt = f"""You are an educational performance analyst. Analyze the class performance data below
and return a JSON object with these exact keys:

- predicted_cvi_next_month: integer 0-100
- at_risk_student_count_prediction: integer
- content_improvement_areas: list of strings (max 3)
- teacher_pd_recommendations: list of strings (max 3)
- class_dynamics: string (1-2 sentence summary)
- confidence_score: float 0-1

Class: {class_name}
Data: {json.dumps(data, default=str)}

Respond with ONLY valid JSON, no markdown, no explanation."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.warning("AI class analysis failed for %s: %s", class_id, e)
        return _fallback_class_insights(data)


async def analyze_school_performance(school_id: str, school_name: str, data: dict) -> dict:
    """School-level Claude analysis for management insights."""
    client = _get_client()
    if client is None:
        return _fallback_school_insights(data)

    prompt = f"""You are an educational performance analyst. Analyze the school performance data below
and return a JSON object with these exact keys:

- predicted_spi_next_month: integer 0-100
- at_risk_students_prediction: integer
- teachers_needing_support_prediction: integer
- top_intervention_priorities: list of strings (max 3)
- growth_outlook: one of "improving", "stable", "declining"
- executive_summary: string (2-3 sentence summary for school principal)
- confidence_score: float 0-1

School: {school_name}
Data: {json.dumps(data, default=str)}

Respond with ONLY valid JSON, no markdown, no explanation."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.warning("AI school analysis failed for %s: %s", school_id, e)
        return _fallback_school_insights(data)


# ---------------------------------------------------------------------------
# Fallback helpers (used when Claude is unavailable or key not configured)
# ---------------------------------------------------------------------------

def _fallback_insights(data: dict) -> dict:
    avg_shs = data.get("avg_shs", 50)
    return {
        "exam_readiness_score": max(0, min(100, int(avg_shs))),
        "dropout_risk": "high" if avg_shs < 40 else ("medium" if avg_shs < 60 else "low"),
        "topics_needing_reinforcement": [],
        "learning_style_patterns": {"preferred_time": "varied", "engagement_type": "visual", "consistency": "medium"},
        "recommended_interventions": ["Review recent quiz performance", "Ensure consistent daily engagement"],
        "confidence_score": 0.3,
        "_source": "fallback",
    }


def _fallback_class_insights(data: dict) -> dict:
    avg_cvi = data.get("avg_cvi", 65)
    return {
        "predicted_cvi_next_month": int(avg_cvi),
        "at_risk_student_count_prediction": data.get("struggling_count", 0),
        "content_improvement_areas": [],
        "teacher_pd_recommendations": [],
        "class_dynamics": "Insufficient data for AI analysis.",
        "confidence_score": 0.3,
        "_source": "fallback",
    }


def _fallback_school_insights(data: dict) -> dict:
    avg_spi = data.get("avg_spi", 65)
    return {
        "predicted_spi_next_month": int(avg_spi),
        "at_risk_students_prediction": data.get("total_at_risk", 0),
        "teachers_needing_support_prediction": data.get("underperforming_teachers", 0),
        "top_intervention_priorities": [],
        "growth_outlook": "stable",
        "executive_summary": "Insufficient data for AI analysis.",
        "confidence_score": 0.3,
        "_source": "fallback",
    }
