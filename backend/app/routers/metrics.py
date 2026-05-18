"""
Historical Metrics & Analytics Endpoints
Teacher/Manager access to student historical performance data, alerts, and trends.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, date, timedelta
from typing import List, Optional

from app.routers.auth import get_user_from_token
from app.utils.database import execute_query, execute_one

router = APIRouter()


async def require_teacher_or_manager(current_user: dict = Depends(get_user_from_token)) -> dict:
    """Ensure user is teacher or manager"""
    role = current_user.get("role")
    if role not in ("teacher", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Teachers/Managers only")
    return current_user


@router.get("/metrics/student/{student_id}/historical")
async def get_student_historical_metrics(
    student_id: str,
    class_id: str,
    days: int = Query(30, ge=7, le=365),
    current_user: dict = Depends(require_teacher_or_manager)
):
    """Get 7/14/30-day rolling averages and momentum for a student."""
    try:
        # Verify access: teacher teaches this class OR manager in same school
        class_data = await execute_one(
            "SELECT c.id, c.teacher_id, s.id as school_id FROM classes c JOIN schools s ON c.school_id = s.id WHERE c.id = $1::uuid",
            class_id
        )
        if not class_data:
            raise HTTPException(status_code=404, detail="Class not found")

        user_id = current_user.get("user_id")
        role = current_user.get("role")

        if role == "teacher" and str(class_data["teacher_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your class")
        elif role not in ("manager", "admin") and str(class_data["school_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your school")

        # Get health scores (rolling averages)
        health_scores = await execute_one(
            """
            SELECT current_shs, weekly_shs, monthly_shs, momentum, risk_level
            FROM student_health_scores
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            """,
            student_id, class_id
        )

        # Get daily metrics for the past N days
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
                risk_level
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date >= CURRENT_DATE - $3::interval
            ORDER BY date DESC
            """,
            student_id, class_id, f"{days} days"
        )

        return {
            "student_id": student_id,
            "class_id": class_id,
            "current_snapshot": {
                "shs": health_scores["current_shs"] if health_scores else None,
                "weekly_avg": health_scores["weekly_shs"] if health_scores else None,
                "monthly_avg": health_scores["monthly_shs"] if health_scores else None,
                "momentum": health_scores["momentum"] if health_scores else None,
                "risk_level": health_scores["risk_level"] if health_scores else None,
            },
            "daily_history": [
                {
                    "date": d["date"].isoformat(),
                    "shs": d["daily_shs"],
                    "video_rate": d["video_completion_rate"],
                    "homework_rate": d["homework_submission_rate"],
                    "attendance": d["attendance_rate"],
                    "consistency": d["consistency_score"],
                    "behavioral": d["behavioral_score"],
                    "risk_level": d["risk_level"],
                }
                for d in daily_metrics
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/class/{class_id}/alerts")
async def get_class_alerts(
    class_id: str,
    severity: Optional[str] = None,
    unresolved_only: bool = True,
    current_user: dict = Depends(require_teacher_or_manager)
):
    """Get all active alerts for a class (teacher or manager view)."""
    try:
        # Verify class access
        class_data = await execute_one(
            "SELECT teacher_id, school_id FROM classes WHERE id = $1::uuid",
            class_id
        )
        if not class_data:
            raise HTTPException(status_code=404, detail="Class not found")

        user_id = current_user.get("user_id")
        role = current_user.get("role")

        if role == "teacher" and str(class_data["teacher_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your class")

        # Build query
        query = """
            SELECT
                id,
                alert_type,
                severity,
                student_id,
                message,
                action_required,
                created_at,
                is_resolved
            FROM performance_alerts
            WHERE class_id = $1::uuid
        """
        params = [class_id]

        if unresolved_only:
            query += " AND is_resolved = false"

        if severity:
            query += f" AND severity = $2"
            params.append(severity)

        query += " ORDER BY severity DESC, created_at DESC"

        alerts = await execute_query(query, *params)

        # Categorize by severity
        urgent_alerts = [a for a in alerts if a["severity"] == "critical"]
        warning_alerts = [a for a in alerts if a["severity"] == "warning"]
        info_alerts = [a for a in alerts if a["severity"] == "info"]

        return {
            "class_id": class_id,
            "summary": {
                "critical": len(urgent_alerts),
                "warning": len(warning_alerts),
                "info": len(info_alerts),
            },
            "alerts": {
                "critical": [
                    {
                        "id": a["id"],
                        "student_id": a["student_id"],
                        "type": a["alert_type"],
                        "message": a["message"],
                        "action": a["action_required"],
                        "triggered_at": a["created_at"].isoformat(),
                    }
                    for a in urgent_alerts
                ],
                "warning": [
                    {
                        "id": a["id"],
                        "student_id": a["student_id"],
                        "type": a["alert_type"],
                        "message": a["message"],
                        "action": a["action_required"],
                        "triggered_at": a["created_at"].isoformat(),
                    }
                    for a in warning_alerts
                ],
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/class/{class_id}/risk-summary")
async def get_class_risk_summary(
    class_id: str,
    current_user: dict = Depends(require_teacher_or_manager)
):
    """
    Summarize class by risk level:
    - 🔴 Critical: SHS < 40
    - 🟡 At-Risk: 40-59
    - 🟢 Stable: 60-79
    - 🔵 Excelling: >= 80
    """
    try:
        # Verify class access
        class_data = await execute_one(
            "SELECT teacher_id FROM classes WHERE id = $1::uuid",
            class_id
        )
        if not class_data:
            raise HTTPException(status_code=404, detail="Class not found")

        user_id = current_user.get("user_id")
        role = current_user.get("role")

        if role == "teacher" and str(class_data["teacher_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your class")

        # Get today's snapshot for all students in class
        summary_data = await execute_query(
            """
            SELECT
                shs.risk_level,
                COUNT(DISTINCT shs.student_id) as student_count,
                AVG(shs.current_shs) as avg_shs,
                MIN(shs.current_shs) as min_shs,
                MAX(shs.current_shs) as max_shs
            FROM student_health_scores shs
            WHERE shs.class_id = $1::uuid
            GROUP BY shs.risk_level
            ORDER BY CASE
                WHEN shs.risk_level = 'critical' THEN 1
                WHEN shs.risk_level = 'at_risk' THEN 2
                WHEN shs.risk_level = 'stable' THEN 3
                WHEN shs.risk_level = 'excelling' THEN 4
                ELSE 5
            END
            """,
            class_id
        )

        # Format response
        critical = next((s for s in summary_data if s["risk_level"] == "critical"), None)
        at_risk = next((s for s in summary_data if s["risk_level"] == "at_risk"), None)
        stable = next((s for s in summary_data if s["risk_level"] == "stable"), None)
        excelling = next((s for s in summary_data if s["risk_level"] == "excelling"), None)

        return {
            "class_id": class_id,
            "timestamp": datetime.now().isoformat(),
            "risk_distribution": {
                "critical": {
                    "count": critical["student_count"] if critical else 0,
                    "avg_shs": round(float(critical["avg_shs"] or 0), 2) if critical else 0,
                    "range": f"{int(critical['min_shs']) if critical else 0}-{int(critical['max_shs']) if critical else 40}"
                },
                "at_risk": {
                    "count": at_risk["student_count"] if at_risk else 0,
                    "avg_shs": round(float(at_risk["avg_shs"] or 0), 2) if at_risk else 0,
                    "range": f"{int(at_risk['min_shs']) if at_risk else 40}-{int(at_risk['max_shs']) if at_risk else 59}"
                },
                "stable": {
                    "count": stable["student_count"] if stable else 0,
                    "avg_shs": round(float(stable["avg_shs"] or 0), 2) if stable else 0,
                    "range": f"{int(stable['min_shs']) if stable else 60}-{int(stable['max_shs']) if stable else 79}"
                },
                "excelling": {
                    "count": excelling["student_count"] if excelling else 0,
                    "avg_shs": round(float(excelling["avg_shs"] or 0), 2) if excelling else 0,
                    "range": "≥ 80"
                },
            },
            "action_items": [
                {
                    "severity": "critical",
                    "count": critical["student_count"] if critical else 0,
                    "recommendation": "🔴 Immediate interventions needed. Contact parents and consider extra support sessions."
                } if critical and critical["student_count"] > 0 else None,
                {
                    "severity": "at_risk",
                    "count": at_risk["student_count"] if at_risk else 0,
                    "recommendation": "🟡 Monitor closely. Schedule check-ins and provide targeted help."
                } if at_risk and at_risk["student_count"] > 0 else None,
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metrics/alert/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: dict = Depends(require_teacher_or_manager)
):
    """Mark an alert as resolved."""
    try:
        # Get alert and verify access
        alert = await execute_one(
            "SELECT teacher_id, class_id FROM performance_alerts WHERE id = $1::uuid",
            alert_id
        )
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        user_id = current_user.get("user_id")
        role = current_user.get("role")

        if role == "teacher" and str(alert["teacher_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your alert")

        # Mark as resolved
        from app.utils.database import execute_write
        await execute_write(
            "UPDATE performance_alerts SET is_resolved = true, resolved_at = NOW() WHERE id = $1::uuid",
            alert_id
        )

        return {"status": "resolved", "alert_id": alert_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/student/{student_id}/ai-prediction")
async def get_ai_prediction(
    student_id: str,
    class_id: str,
    current_user: dict = Depends(require_teacher_or_manager)
):
    """Get latest AI prediction for a student (exam readiness, dropout risk, interventions)."""
    try:
        # Verify class access
        class_data = await execute_one(
            "SELECT teacher_id FROM classes WHERE id = $1::uuid",
            class_id
        )
        if not class_data:
            raise HTTPException(status_code=404, detail="Class not found")

        user_id = current_user.get("user_id")
        role = current_user.get("role")

        if role == "teacher" and str(class_data["teacher_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your class")

        # Get latest AI prediction
        prediction = await execute_one(
            """
            SELECT
                analysis_date,
                predictions,
                recommendations,
                confidence_score
            FROM ai_performance_insights
            WHERE entity_type = 'student' AND entity_id = $1::uuid
            ORDER BY analysis_date DESC
            LIMIT 1
            """,
            student_id
        )

        if not prediction:
            return {
                "status": "no_prediction",
                "message": "AI analysis not yet available. Will be generated during weekly analysis (Mondays 06:00 UTC)",
                "next_analysis": "Next Monday"
            }

        # Parse JSON fields
        import json
        predictions_data = prediction["predictions"]
        if isinstance(predictions_data, str):
            predictions_data = json.loads(predictions_data)

        recommendations_data = prediction["recommendations"]
        if isinstance(recommendations_data, str):
            recommendations_data = json.loads(recommendations_data)

        return {
            "analysis_date": prediction["analysis_date"].isoformat(),
            "predictions": {
                "exam_readiness": predictions_data.get("exam_readiness"),
                "dropout_risk": predictions_data.get("dropout_risk"),
                "expected_shs": predictions_data.get("expected_shs"),
                "learning_style": predictions_data.get("learning_style")
            },
            "recommendations": {
                "interventions": recommendations_data.get("interventions", []),
                "topics_needing_help": recommendations_data.get("topics_needing_help", [])
            },
            "confidence": float(prediction["confidence_score"] or 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
