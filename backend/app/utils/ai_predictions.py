"""
AI-Powered Predictive Analytics using Claude API
Analyzes 30-day student performance data to predict outcomes and recommend interventions.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import anthropic

from app.utils.database import execute_query, execute_one, execute_write
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


async def get_student_30day_data(student_id: str, class_id: str) -> Dict[str, Any]:
    """
    Fetch 30 days of student performance data for AI analysis.
    """
    try:
        # Get daily metrics
        daily_metrics = await execute_query(
            """
            SELECT
                date,
                daily_shs,
                video_completion_rate,
                homework_submission_rate,
                attendance_rate,
                consistency_score,
                behavioral_score,
                study_duration_minutes
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date
            """,
            student_id, class_id
        )

        # Get student info
        student_info = await execute_one(
            """
            SELECT u.full_name, u.email
            FROM users u
            WHERE u.id = $1::uuid
            """,
            student_id
        )

        # Get current health scores
        health_scores = await execute_one(
            """
            SELECT current_shs, weekly_shs, monthly_shs, momentum, risk_level
            FROM student_health_scores
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            """,
            student_id, class_id
        )

        # Get video focus data
        focus_metrics = await execute_query(
            """
            SELECT
                date,
                pause_count,
                rewind_count,
                focus_score,
                total_watch_seconds
            FROM video_focus_metrics
            WHERE student_id = $1::uuid
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date
            """,
            student_id
        )

        # Get homework details
        homework_data = await execute_query(
            """
            SELECT
                h.id,
                h.title,
                hs.submission_status,
                hs.marks_awarded,
                h.total_marks,
                hs.submitted_at
            FROM homeworks h
            LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = $1::uuid
            WHERE h.class_id = $2::uuid AND h.status = 'published'
            AND h.created_at >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY h.created_at DESC
            """,
            student_id, class_id
        )

        return {
            "student_name": student_info["full_name"] if student_info else "Unknown",
            "student_email": student_info["email"] if student_info else "Unknown",
            "current_shs": float(health_scores["current_shs"] or 0) if health_scores else 0,
            "weekly_avg": float(health_scores["weekly_shs"] or 0) if health_scores else 0,
            "momentum": float(health_scores["momentum"] or 0) if health_scores else 0,
            "risk_level": health_scores["risk_level"] if health_scores else "unknown",
            "daily_metrics": [
                {
                    "date": str(d["date"]),
                    "shs": float(d["daily_shs"]),
                    "video": float(d["video_completion_rate"]),
                    "homework": float(d["homework_submission_rate"]),
                    "attendance": float(d["attendance_rate"]),
                    "study_minutes": int(d["study_duration_minutes"] or 0)
                }
                for d in daily_metrics
            ],
            "video_engagement": [
                {
                    "date": str(f["date"]),
                    "focus_score": float(f["focus_score"] or 0),
                    "pauses": int(f["pause_count"]),
                    "rewinds": int(f["rewind_count"])
                }
                for f in focus_metrics
            ],
            "homework_performance": [
                {
                    "title": h["title"],
                    "status": h["submission_status"],
                    "marks": f"{h['marks_awarded'] or 0:.0f}/{h['total_marks']}"
                }
                for h in homework_data
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching student data: {str(e)}")
        return {}


def analyze_with_claude(student_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use Claude API to analyze student performance and provide predictions.
    Runs synchronously (can be awaited in async context).
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set. Skipping AI analysis.")
        return {}

    try:
        prompt = f"""
You are an expert educational analyst. Analyze this student's 30-day performance data and provide actionable insights.

STUDENT PROFILE:
- Name: {student_data.get('student_name')}
- Current SHS: {student_data.get('current_shs')}/100
- Weekly Average: {student_data.get('weekly_avg')}/100
- Momentum: {student_data.get('momentum')}% (week-over-week change)
- Current Status: {student_data.get('risk_level')}

PERFORMANCE TRENDS (Last 30 days):
{json.dumps(student_data.get('daily_metrics', []), indent=2)}

VIDEO ENGAGEMENT:
{json.dumps(student_data.get('video_engagement', []), indent=2)}

HOMEWORK PERFORMANCE:
{json.dumps(student_data.get('homework_performance', []), indent=2)}

Please analyze and provide a JSON response with EXACTLY this structure:
{{
    "exam_readiness": <0-100 score>,
    "exam_readiness_confidence": <0-100 confidence %>,
    "dropout_risk": "<low|medium|high>",
    "dropout_risk_confidence": <0-100 confidence %>,
    "topics_needing_help": [<list of 2-4 topic names where student struggles>],
    "learning_style": "<visual|auditory|kinesthetic|mixed>",
    "engagement_quality": "<high|moderate|low>",
    "strengths": [<list of 2-3 strengths>],
    "weaknesses": [<list of 2-3 areas needing improvement>],
    "recommended_interventions": [<list of 3-5 specific, actionable recommendations>],
    "expected_next_week_shs": <0-100 predicted SHS>,
    "key_insight": "<one paragraph summary of the most important finding>"
}}

Be specific and data-driven. Focus on actionable insights."""

        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        # Parse response
        response_text = response.content[0].text

        # Extract JSON from response
        try:
            # Try to find JSON in the response
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                analysis = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response: {str(e)}")
            logger.error(f"Response text: {response_text}")
            return {}

        return analysis
    except Exception as e:
        logger.error(f"Claude API analysis failed: {str(e)}")
        return {}


async def run_ai_analysis_for_student(student_id: str, class_id: str) -> Optional[Dict]:
    """
    Run AI analysis for a single student and store results.
    """
    try:
        # Get student data
        student_data = await get_student_30day_data(student_id, class_id)
        if not student_data.get("daily_metrics"):
            logger.info(f"Skipping AI analysis for {student_id}: insufficient data")
            return None

        # Analyze with Claude
        analysis = analyze_with_claude(student_data)
        if not analysis:
            return None

        # Store in database
        await execute_write(
            """
            INSERT INTO ai_performance_insights
            (entity_type, entity_id, analysis_date, predictions, recommendations, confidence_score)
            VALUES ('student', $1::uuid, CURRENT_DATE, $2, $3, $4)
            ON CONFLICT (entity_type, entity_id, analysis_date) DO UPDATE SET
                predictions = EXCLUDED.predictions,
                recommendations = EXCLUDED.recommendations,
                confidence_score = EXCLUDED.confidence_score,
                updated_at = NOW()
            """,
            student_id,
            json.dumps({
                "exam_readiness": analysis.get("exam_readiness"),
                "dropout_risk": analysis.get("dropout_risk"),
                "expected_shs": analysis.get("expected_next_week_shs"),
                "learning_style": analysis.get("learning_style")
            }),
            json.dumps({
                "interventions": analysis.get("recommended_interventions", []),
                "topics_needing_help": analysis.get("topics_needing_help", [])
            }),
            float(analysis.get("exam_readiness_confidence", 0))
        )

        logger.info(f"AI analysis stored for student {student_id}")
        return analysis
    except Exception as e:
        logger.error(f"Error in AI analysis for student {student_id}: {str(e)}")
        return None


async def run_weekly_ai_analysis_job():
    """
    Weekly AI analysis job (runs every Monday at 06:00 UTC).
    Analyzes all at-risk students (SHS < 60) for predictions and interventions.
    """
    logger.info("🤖 Starting weekly AI analysis job...")
    try:
        # Get all at-risk students (SHS < 60)
        at_risk_students = await execute_query(
            """
            SELECT DISTINCT shs.student_id, shs.class_id
            FROM student_health_scores shs
            WHERE shs.current_shs < 60
            """
        )

        analyzed = 0
        for enrollment in at_risk_students:
            result = await run_ai_analysis_for_student(
                enrollment["student_id"],
                enrollment["class_id"]
            )
            if result:
                analyzed += 1

        logger.info(f"✅ Weekly AI analysis complete: {analyzed} at-risk students analyzed")
    except Exception as e:
        logger.error(f"❌ Weekly AI analysis job failed: {str(e)}")
