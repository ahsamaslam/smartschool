"""
Analytics & Reporting Routes
Calculation endpoints for SHS, CVI, SPI.
Called by cron jobs or admin-triggered actions.
"""
import json
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.score_calculator import (
    calculate_daily_shs,
    calculate_cvi,
    calculate_spi,
    calculate_momentum,
    get_risk_level,
    get_teacher_grade,
    get_school_rating,
    get_date_range,
)
from app.utils.cache import (
    get_cached_ai_insights,
    cache_ai_insights,
    get_cached_class_cvi,
    cache_class_cvi,
    get_cached_school_spi,
    cache_school_spi,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Legacy endpoint (kept for backward compatibility)
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}/performance")
async def get_student_performance(student_id: str):
    """Get student performance analytics (legacy)"""
    rows = await execute_query(
        "SELECT * FROM student_performance WHERE student_id = $1 ORDER BY date DESC LIMIT 30",
        student_id,
    )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Student SHS calculation  (POST /analytics/calculate/student/{id})
# ---------------------------------------------------------------------------

@router.post("/calculate/student/{student_id}")
async def calculate_student_shs(
    student_id: str,
    calc_date: Optional[str] = Query(default=None, alias="date"),
):
    """
    Calculate and persist daily SHS for a student for a given date.
    Pulls from: student_performance, quiz_attempts, video_watch_sessions, attendance.
    Writes to: daily_student_metrics, student_health_scores.
    """
    target_date = date.fromisoformat(calc_date) if calc_date else date.today()

    # Fetch all classes the student is enrolled in
    enrollments = await execute_query(
        "SELECT class_id FROM enrollments WHERE student_id = $1::uuid AND is_active = true",
        student_id,
    )
    if not enrollments:
        raise HTTPException(status_code=404, detail="No active enrollments found")

    results = []
    for row in enrollments:
        class_id = str(row["class_id"])
        result = await _calculate_and_store_student_shs(student_id, class_id, target_date)
        results.append(result)

    return {"date": target_date.isoformat(), "results": results}


async def _calculate_and_store_student_shs(student_id: str, class_id: str, target_date: date) -> dict:
    """Core calculation logic for one student+class on one date."""

    # --- Video engagement ---
    video_row = await execute_one(
        """
        SELECT
            COALESCE(AVG(vws.completion_percentage), 0) AS avg_completion,
            COUNT(DISTINCT vee.id) FILTER (WHERE vee.event_type = 'pause') AS drops
        FROM video_watch_sessions vws
        JOIN published_videos pv ON pv.id = vws.published_video_id
        JOIN class_subjects cs ON cs.id = pv.class_subject_id
        LEFT JOIN video_engagement_events vee ON vee.session_id = vws.id
        WHERE vws.student_id = $1::uuid
          AND cs.class_id = $2::uuid
          AND vws.started_at::date = $3
        """,
        student_id, class_id, target_date,
    )
    video_completion = float(video_row["avg_completion"] or 0)
    video_drops = int(video_row["drops"] or 0)
    # focus_score: penalise drops (each drop reduces focus by 5, floor 0)
    focus_score = max(0, 100 - video_drops * 5)

    # --- Quiz performance ---
    quiz_row = await execute_one(
        """
        SELECT
            COALESCE(AVG(qa.score / NULLIF(qa.total_points, 0) * 100), 0) AS avg_score,
            COALESCE(AVG(
                CASE WHEN qa.attempt_number = 1
                     THEN qa.score / NULLIF(qa.total_points, 0) * 100 END
            ), 0) AS first_attempt_avg,
            COUNT(qa.id) FILTER (WHERE qa.attempt_number > 1) AS retakes
        FROM quiz_attempts qa
        JOIN quiz_instances qi ON qi.id = qa.quiz_instance_id
        JOIN published_videos pv ON pv.id = qi.published_video_id
        JOIN class_subjects cs ON cs.id = pv.class_subject_id
        WHERE qa.student_id = $1::uuid
          AND cs.class_id = $2::uuid
          AND qa.started_at::date = $3
          AND qa.is_completed = true
        """,
        student_id, class_id, target_date,
    )
    quiz_score = float(quiz_row["avg_score"] or 0)
    first_attempt_score = float(quiz_row["first_attempt_avg"] or 0)
    test_retakes = int(quiz_row["retakes"] or 0)

    # --- Q&A questions asked ---
    qa_row = await execute_one(
        """
        SELECT COUNT(sq.id) AS questions_asked
        FROM student_questions sq
        JOIN published_videos pv ON pv.id = sq.published_video_id
        JOIN class_subjects cs ON cs.id = pv.class_subject_id
        WHERE sq.student_id = $1::uuid
          AND cs.class_id = $2::uuid
          AND sq.asked_at::date = $3
        """,
        student_id, class_id, target_date,
    )
    questions_asked = int(qa_row["questions_asked"] or 0)

    # --- Attendance ---
    att_row = await execute_one(
        "SELECT is_present FROM attendance WHERE student_id = $1::uuid AND class_id = $2::uuid AND date = $3",
        student_id, class_id, target_date,
    )
    attendance_present = bool(att_row["is_present"]) if att_row else False

    # --- Study duration (total watch time for the day) ---
    duration_row = await execute_one(
        """
        SELECT COALESCE(SUM(vws.total_watch_time_seconds), 0) / 60 AS study_minutes
        FROM video_watch_sessions vws
        JOIN published_videos pv ON pv.id = vws.published_video_id
        JOIN class_subjects cs ON cs.id = pv.class_subject_id
        WHERE vws.student_id = $1::uuid
          AND cs.class_id = $2::uuid
          AND vws.started_at::date = $3
        """,
        student_id, class_id, target_date,
    )
    study_minutes = int(duration_row["study_minutes"] or 0)

    # --- Homework submission ---
    hw_row = await execute_one(
        """
        SELECT COUNT(hs.id) > 0 AS submitted
        FROM homework_submissions hs
        JOIN homeworks h ON h.id = hs.homework_id
        WHERE hs.student_id = $1::uuid
          AND h.class_id = $2::uuid
          AND hs.submitted_at::date = $3
        """,
        student_id, class_id, target_date,
    )
    homework_submitted = bool(hw_row["submitted"]) if hw_row else False

    # --- Topic revisits (videos watched more than once) ---
    revisit_row = await execute_one(
        """
        SELECT COUNT(DISTINCT vws.published_video_id) AS revisits
        FROM video_watch_sessions vws
        JOIN published_videos pv ON pv.id = vws.published_video_id
        JOIN class_subjects cs ON cs.id = pv.class_subject_id
        WHERE vws.student_id = $1::uuid
          AND cs.class_id = $2::uuid
          AND vws.started_at::date = $3
          AND EXISTS (
              SELECT 1 FROM video_watch_sessions vws2
              WHERE vws2.student_id = vws.student_id
                AND vws2.published_video_id = vws.published_video_id
                AND vws2.started_at::date < $3
          )
        """,
        student_id, class_id, target_date,
    )
    topic_revisits = int(revisit_row["revisits"] or 0)

    # --- Calculate SHS ---
    daily_shs = calculate_daily_shs(
        video_completion_rate=video_completion,
        focus_score=float(focus_score),
        quiz_score=quiz_score,
        first_attempt_score=first_attempt_score,
        questions_asked=questions_asked,
        attendance=attendance_present,
        study_duration_minutes=study_minutes,
        homework_submitted=homework_submitted,
        topic_revisits=topic_revisits,
        test_retakes=test_retakes,
    )

    # --- Persist to daily_student_metrics ---
    await execute_write(
        """
        INSERT INTO daily_student_metrics (
            student_id, class_id, date,
            video_completion_rate, focus_score, video_drops,
            quiz_score, first_attempt_score, questions_asked,
            attendance, study_duration_minutes, homework_submitted,
            topic_revisits, test_retakes, daily_shs
        ) VALUES (
            $1::uuid, $2::uuid, $3,
            $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (student_id, class_id, date) DO UPDATE SET
            video_completion_rate = EXCLUDED.video_completion_rate,
            focus_score = EXCLUDED.focus_score,
            video_drops = EXCLUDED.video_drops,
            quiz_score = EXCLUDED.quiz_score,
            first_attempt_score = EXCLUDED.first_attempt_score,
            questions_asked = EXCLUDED.questions_asked,
            attendance = EXCLUDED.attendance,
            study_duration_minutes = EXCLUDED.study_duration_minutes,
            homework_submitted = EXCLUDED.homework_submitted,
            topic_revisits = EXCLUDED.topic_revisits,
            test_retakes = EXCLUDED.test_retakes,
            daily_shs = EXCLUDED.daily_shs
        """,
        student_id, class_id, target_date,
        video_completion, focus_score, video_drops,
        quiz_score, first_attempt_score, questions_asked,
        attendance_present, study_minutes, homework_submitted,
        topic_revisits, test_retakes, daily_shs,
    )

    # --- Update rolling student_health_scores ---
    today = date.today()
    week_ago = today - timedelta(days=7)
    prev_week_start = today - timedelta(days=14)

    weekly_row = await execute_one(
        "SELECT COALESCE(AVG(daily_shs), 0) AS avg FROM daily_student_metrics WHERE student_id = $1::uuid AND class_id = $2::uuid AND date >= $3",
        student_id, class_id, week_ago,
    )
    monthly_row = await execute_one(
        "SELECT COALESCE(AVG(daily_shs), 0) AS avg FROM daily_student_metrics WHERE student_id = $1::uuid AND class_id = $2::uuid AND date >= $3",
        student_id, class_id, today - timedelta(days=30),
    )
    prev_weekly_row = await execute_one(
        "SELECT COALESCE(AVG(daily_shs), 0) AS avg FROM daily_student_metrics WHERE student_id = $1::uuid AND class_id = $2::uuid AND date BETWEEN $3 AND $4",
        student_id, class_id, prev_week_start, week_ago,
    )

    weekly_shs = float(weekly_row["avg"] or 0)
    monthly_shs = float(monthly_row["avg"] or 0)
    prev_weekly_shs = float(prev_weekly_row["avg"] or 0)
    momentum = calculate_momentum(weekly_shs, prev_weekly_shs)
    risk_level = get_risk_level(daily_shs)

    await execute_write(
        """
        INSERT INTO student_health_scores (student_id, class_id, current_shs, weekly_shs, monthly_shs, momentum, risk_level, last_updated)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (student_id, class_id) DO UPDATE SET
            current_shs = EXCLUDED.current_shs,
            weekly_shs = EXCLUDED.weekly_shs,
            monthly_shs = EXCLUDED.monthly_shs,
            momentum = EXCLUDED.momentum,
            risk_level = EXCLUDED.risk_level,
            last_updated = NOW()
        """,
        student_id, class_id, daily_shs, weekly_shs, monthly_shs, momentum, risk_level,
    )

    # --- Check and create alerts ---
    await _check_student_alerts(student_id, class_id, daily_shs, momentum)

    return {
        "student_id": student_id,
        "class_id": class_id,
        "daily_shs": daily_shs,
        "risk_level": risk_level,
        "momentum": momentum,
    }


async def _check_student_alerts(student_id: str, class_id: str, shs: float, momentum: float):
    """
    Full 3-tier early warning system from schoolanalysis.md.
    Tier 1 — immediate_intervention (critical)
    Tier 2 — schedule_meeting (warning)
    Tier 3 — monitor_closely (info)
    """
    async def _insert_alert(alert_type: str, severity: str, message: str, action: str):
        # Only insert if there is no unresolved alert of the same type for this student+class today
        exists = await execute_one(
            """
            SELECT id FROM performance_alerts
            WHERE student_id = $1::uuid AND class_id = $2::uuid
              AND alert_type = $3 AND is_resolved = false
              AND created_at >= NOW() - INTERVAL '24 hours'
            LIMIT 1
            """,
            student_id, class_id, alert_type,
        )
        if not exists:
            await execute_write(
                """
                INSERT INTO performance_alerts
                    (alert_type, severity, student_id, class_id, message, action_required)
                VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6)
                """,
                alert_type, severity, student_id, class_id, message, action,
            )

    # ── TIER 1: Immediate Intervention ───────────────────────────────────
    # SHS < 30 for 2 consecutive days
    critical_days = await execute_one(
        """
        SELECT COUNT(*) AS cnt FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND daily_shs < 30
          AND date >= CURRENT_DATE - INTERVAL '2 days'
        """,
        student_id, class_id,
    )
    if int(critical_days["cnt"] or 0) >= 2:
        await _insert_alert(
            "immediate_intervention", "critical",
            "SHS below 30 for 2 consecutive days — critical performance failure",
            "Contact parent immediately and schedule emergency support",
        )
        return  # critical already, no need for lower tiers

    # Quiz score < 30 for 3 consecutive quiz attempts
    low_quiz_streak = await execute_one(
        """
        SELECT COUNT(*) AS cnt FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND quiz_score < 30
          AND date >= CURRENT_DATE - INTERVAL '5 days'
        """,
        student_id, class_id,
    )
    if int(low_quiz_streak["cnt"] or 0) >= 3:
        await _insert_alert(
            "immediate_intervention", "critical",
            "Quiz scores below 30 for 3 consecutive days — subject matter not understood",
            "Assign remedial content and notify subject teacher",
        )
        return

    # Video completion < 20% for 5 consecutive days
    video_dropout_streak = await execute_one(
        """
        SELECT COUNT(*) AS cnt FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND video_completion_rate < 20
          AND date >= CURRENT_DATE - INTERVAL '5 days'
        """,
        student_id, class_id,
    )
    if int(video_dropout_streak["cnt"] or 0) >= 5:
        await _insert_alert(
            "immediate_intervention", "critical",
            "Video completion below 20% for 5 consecutive days — complete disengagement",
            "Contact student and parent immediately",
        )
        return

    # ── TIER 2: Schedule Meeting ──────────────────────────────────────────
    # SHS dropped > 20 points in 7 days
    if momentum < -20:
        await _insert_alert(
            "schedule_meeting", "warning",
            f"SHS declined {abs(momentum):.1f}% this week — sudden performance drop",
            "Schedule teacher-student meeting this week",
        )
        return

    # Attendance < 60% in last 2 weeks
    attendance_row = await execute_one(
        """
        SELECT
            COUNT(*) FILTER (WHERE attendance = true) AS present,
            COUNT(*) AS total
        FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND date >= CURRENT_DATE - INTERVAL '14 days'
        """,
        student_id, class_id,
    )
    total_days = int(attendance_row["total"] or 0)
    present_days = int(attendance_row["present"] or 0)
    if total_days > 0 and (present_days / total_days) < 0.60:
        att_pct = round(present_days / total_days * 100, 1)
        await _insert_alert(
            "schedule_meeting", "warning",
            f"Attendance rate {att_pct}% in last 2 weeks — chronic absenteeism",
            "Schedule parent meeting and investigate absences",
        )
        return

    # Zero homework for 7 consecutive days
    hw_streak = await execute_one(
        """
        SELECT COUNT(*) AS cnt FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND homework_submitted = false
          AND date >= CURRENT_DATE - INTERVAL '7 days'
        """,
        student_id, class_id,
    )
    if int(hw_streak["cnt"] or 0) >= 7:
        await _insert_alert(
            "schedule_meeting", "warning",
            "No homework submitted in 7 consecutive days — possible motivational issues",
            "Contact student and parent; check for external challenges",
        )
        return

    # ── TIER 3: Monitor Closely ───────────────────────────────────────────
    # SHS borderline (40-50) for 10 days
    borderline_days = await execute_one(
        """
        SELECT COUNT(*) AS cnt FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid
          AND daily_shs BETWEEN 40 AND 50
          AND date >= CURRENT_DATE - INTERVAL '10 days'
        """,
        student_id, class_id,
    )
    if int(borderline_days["cnt"] or 0) >= 10:
        await _insert_alert(
            "monitor_closely", "info",
            "SHS consistently in borderline range (40-50) for 10 days",
            "Monitor daily and provide additional study resources",
        )
        return

    # Momentum declining (> -10%) but not yet at meeting threshold
    if momentum < -10:
        await _insert_alert(
            "monitor_closely", "info",
            f"SHS declining ({momentum:.1f}% vs last week) — watch for further drop",
            "Check in with student; review recent quiz/video performance",
        )


# ---------------------------------------------------------------------------
# Class CVI calculation  (POST /analytics/calculate/class/{id})
# ---------------------------------------------------------------------------

@router.post("/calculate/class/{class_id}")
async def calculate_class_cvi(
    class_id: str,
    calc_date: Optional[str] = Query(default=None, alias="date"),
):
    """
    Calculate and persist CVI for a class for a given date.
    Aggregates from daily_student_metrics for that class+date.
    """
    target_date = date.fromisoformat(calc_date) if calc_date else date.today()

    # Aggregate student metrics for the class on this date
    agg = await execute_one(
        """
        SELECT
            COUNT(*) AS total_students,
            COALESCE(AVG(daily_shs), 0) AS avg_shs,
            COALESCE(STDDEV(daily_shs), 0) AS shs_stddev,
            COUNT(*) FILTER (WHERE daily_shs < 50) AS struggling_count,
            COUNT(*) FILTER (WHERE daily_shs >= 80) AS excelling_count,
            COALESCE(AVG(quiz_score), 0) AS avg_quiz,
            COALESCE(AVG(video_completion_rate), 0) AS avg_video,
            COUNT(*) FILTER (WHERE first_attempt_score >= 70) AS first_pass_count
        FROM daily_student_metrics
        WHERE class_id = $1::uuid AND date = $2
        """,
        class_id, target_date,
    )

    if not agg or int(agg["total_students"] or 0) == 0:
        raise HTTPException(status_code=404, detail="No student metrics found for this class/date")

    total = int(agg["total_students"])
    avg_shs = float(agg["avg_shs"] or 0)
    engagement_variance = float(agg["shs_stddev"] or 0)

    # Learning velocity: compare avg_shs today vs 7 days ago
    prev_agg = await execute_one(
        "SELECT COALESCE(AVG(daily_shs), 0) AS avg_shs FROM daily_student_metrics WHERE class_id = $1::uuid AND date = $2",
        class_id, target_date - timedelta(days=7),
    )
    prev_avg = float(prev_agg["avg_shs"] or avg_shs)
    # Normalise velocity: +10 point improvement over 7 days = 100
    raw_velocity = avg_shs - prev_avg
    learning_velocity = min(max((raw_velocity + 10) / 20.0 * 100, 0), 100)

    # Content effectiveness: % students who pass first attempt
    first_pass_rate = (int(agg["first_pass_count"] or 0) / total * 100) if total else 0

    cvi_score = calculate_cvi(
        class_avg_shs=avg_shs,
        learning_velocity=learning_velocity,
        engagement_variance=engagement_variance,
        content_effectiveness=first_pass_rate,
    )
    teacher_grade = get_teacher_grade(cvi_score)

    # Build alert message
    alert_message = None
    avg_quiz = float(agg["avg_quiz"] or 0)
    avg_video = float(agg["avg_video"] or 0)
    if avg_quiz < 60 and avg_video > 85:
        alert_message = "High engagement but low comprehension - content may be too complex"
    elif avg_video < 50 and avg_quiz < 60:
        alert_message = "Low engagement AND comprehension - teaching approach needs revision"
    elif engagement_variance > 25:
        alert_message = "Large performance gap - some students being left behind"

    await execute_write(
        """
        INSERT INTO class_vitality_index (
            class_id, date, avg_shs, cvi_score, struggling_count, excelling_count,
            total_students, engagement_variance, learning_velocity, content_effectiveness,
            teacher_grade, alert_message
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (class_id, date) DO UPDATE SET
            avg_shs = EXCLUDED.avg_shs,
            cvi_score = EXCLUDED.cvi_score,
            struggling_count = EXCLUDED.struggling_count,
            excelling_count = EXCLUDED.excelling_count,
            total_students = EXCLUDED.total_students,
            engagement_variance = EXCLUDED.engagement_variance,
            learning_velocity = EXCLUDED.learning_velocity,
            content_effectiveness = EXCLUDED.content_effectiveness,
            teacher_grade = EXCLUDED.teacher_grade,
            alert_message = EXCLUDED.alert_message
        """,
        class_id, target_date, avg_shs, cvi_score,
        int(agg["struggling_count"] or 0), int(agg["excelling_count"] or 0),
        total, engagement_variance, learning_velocity, first_pass_rate,
        teacher_grade, alert_message,
    )

    return {
        "class_id": class_id,
        "date": target_date.isoformat(),
        "cvi_score": cvi_score,
        "avg_shs": avg_shs,
        "teacher_grade": teacher_grade,
        "struggling_count": int(agg["struggling_count"] or 0),
        "excelling_count": int(agg["excelling_count"] or 0),
        "alert_message": alert_message,
    }


# ---------------------------------------------------------------------------
# School SPI calculation  (POST /analytics/calculate/school/{id})
# ---------------------------------------------------------------------------

@router.post("/calculate/school/{school_id}")
async def calculate_school_spi(
    school_id: str,
    week_start: Optional[str] = Query(default=None),
):
    """
    Calculate and persist SPI for a school for a given week.
    Aggregates from class_vitality_index for all classes in the school.
    """
    w_start = date.fromisoformat(week_start) if week_start else date.today() - timedelta(days=date.today().weekday())
    w_end = w_start + timedelta(days=6)

    # Aggregate CVI for all classes in school
    cvi_agg = await execute_one(
        """
        SELECT
            COUNT(DISTINCT cvi.class_id) AS class_count,
            COALESCE(AVG(cvi.cvi_score), 0) AS avg_cvi,
            COALESCE(AVG(cvi.avg_shs), 0) AS avg_shs,
            SUM(cvi.struggling_count) AS total_struggling,
            SUM(cvi.excelling_count) AS total_excelling,
            SUM(cvi.total_students) AS total_students,
            COUNT(DISTINCT cvi.class_id) FILTER (WHERE cvi.teacher_grade = 'Excellent') AS excellent_count,
            COUNT(DISTINCT cvi.class_id) FILTER (WHERE cvi.teacher_grade = 'Needs Improvement') AS underperf_count
        FROM class_vitality_index cvi
        JOIN classes c ON c.id = cvi.class_id
        JOIN branches b ON b.id = c.branch_id
        WHERE b.school_id = $1::uuid
          AND cvi.date BETWEEN $2 AND $3
        """,
        school_id, w_start, w_end,
    )

    if not cvi_agg or int(cvi_agg["class_count"] or 0) == 0:
        raise HTTPException(status_code=404, detail="No CVI data found for this school/week")

    total_students = int(cvi_agg["total_students"] or 1)
    avg_cvi = float(cvi_agg["avg_cvi"] or 0)
    avg_shs = float(cvi_agg["avg_shs"] or 0)
    at_risk_pct = float(int(cvi_agg["total_struggling"] or 0)) / total_students * 100
    top_pct = float(int(cvi_agg["total_excelling"] or 0)) / total_students * 100
    class_count = int(cvi_agg["class_count"] or 1)
    excellent_pct = float(int(cvi_agg["excellent_count"] or 0)) / class_count * 100
    underperf_pct = float(int(cvi_agg["underperf_count"] or 0)) / class_count * 100

    # Attendance & homework rates
    ops_row = await execute_one(
        """
        SELECT
            COALESCE(AVG(CASE WHEN a.is_present THEN 100.0 ELSE 0 END), 0) AS att_rate,
            COALESCE(
                COUNT(hs.id) FILTER (WHERE hs.submission_status IN ('submitted','late','graded'))::decimal
                / NULLIF(COUNT(h.id), 0) * 100, 0
            ) AS hw_rate
        FROM classes c
        JOIN branches b ON b.id = c.branch_id
        LEFT JOIN attendance a ON a.class_id = c.id AND a.date BETWEEN $2 AND $3
        LEFT JOIN homeworks h ON h.class_id = c.id
        LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
        WHERE b.school_id = $1::uuid
        """,
        school_id, w_start, w_end,
    )
    att_rate = float(ops_row["att_rate"] or 0)
    hw_rate = float(ops_row["hw_rate"] or 0)

    # Month-over-month: compare to previous week's SPI
    prev_spi_row = await execute_one(
        "SELECT spi_score FROM school_performance_index WHERE school_id = $1::uuid ORDER BY week_start DESC LIMIT 1",
        school_id,
    )
    prev_spi = float(prev_spi_row["spi_score"] or 0) if prev_spi_row else 0.0

    spi_score = calculate_spi(
        school_avg_shs=avg_shs,
        school_avg_cvi=avg_cvi,
        top_performers_pct=top_pct,
        at_risk_pct=at_risk_pct,
        excellent_teachers_pct=excellent_pct,
        underperforming_teachers_pct=underperf_pct,
        avg_attendance_rate=att_rate,
        homework_submission_rate=hw_rate,
        mom_improvement=(spi_score - prev_spi) if prev_spi else 0,
    )
    rating = get_school_rating(spi_score)

    await execute_write(
        """
        INSERT INTO school_performance_index (
            school_id, week_start, spi_score, avg_shs, avg_cvi,
            at_risk_percentage, top_performers_percentage,
            excellent_teachers_count, underperforming_teachers_count,
            avg_attendance_rate, homework_submission_rate, rating
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (school_id, week_start) DO UPDATE SET
            spi_score = EXCLUDED.spi_score,
            avg_shs = EXCLUDED.avg_shs,
            avg_cvi = EXCLUDED.avg_cvi,
            at_risk_percentage = EXCLUDED.at_risk_percentage,
            top_performers_percentage = EXCLUDED.top_performers_percentage,
            excellent_teachers_count = EXCLUDED.excellent_teachers_count,
            underperforming_teachers_count = EXCLUDED.underperforming_teachers_count,
            avg_attendance_rate = EXCLUDED.avg_attendance_rate,
            homework_submission_rate = EXCLUDED.homework_submission_rate,
            rating = EXCLUDED.rating
        """,
        school_id, w_start, spi_score, avg_shs, avg_cvi,
        at_risk_pct, top_pct,
        int(cvi_agg["excellent_count"] or 0), int(cvi_agg["underperf_count"] or 0),
        att_rate, hw_rate, rating,
    )

    return {
        "school_id": school_id,
        "week_start": w_start.isoformat(),
        "spi_score": spi_score,
        "avg_shs": avg_shs,
        "avg_cvi": avg_cvi,
        "at_risk_percentage": round(at_risk_pct, 2),
        "top_performers_percentage": round(top_pct, 2),
        "rating": rating,
    }


# ===========================================================================
# CRON ENDPOINTS  — triggered nightly by scheduler or admin
# ===========================================================================

import asyncio as _asyncio
from app.utils.ai_analysis import (
    analyze_student_performance,
    analyze_class_performance,
    analyze_school_performance,
)


@router.post("/cron/calculate-daily-scores")
async def cron_calculate_daily_scores(
    calc_date: Optional[str] = Query(default=None, alias="date"),
):
    """
    Nightly batch: calculate SHS for every active student, then CVI for every class.
    Designed to be called by a scheduler or via admin trigger.
    Returns summary counts.
    """
    target_date = date.fromisoformat(calc_date) if calc_date else date.today()

    # --- Step 1: Fetch all active student enrollments ---
    enrollments = await execute_query(
        """
        SELECT DISTINCT e.student_id::text, e.class_id::text
        FROM enrollments e
        WHERE e.is_active = true
        """
    )

    student_ok = 0
    student_err = 0
    for row in enrollments:
        try:
            await _calculate_and_store_student_shs(
                str(row["student_id"]), str(row["class_id"]), target_date
            )
            student_ok += 1
        except Exception:
            student_err += 1

    # --- Step 2: Calculate CVI for every active class ---
    classes = await execute_query(
        "SELECT DISTINCT id::text FROM classes WHERE is_active = true"
    )

    class_ok = 0
    class_err = 0
    for row in classes:
        class_id = str(row["id"])
        try:
            # Aggregate student metrics already written above
            agg = await execute_one(
                """
                SELECT
                    COUNT(*) AS total_students,
                    COALESCE(AVG(daily_shs), 0) AS avg_shs,
                    COALESCE(STDDEV(daily_shs), 0) AS shs_stddev,
                    COUNT(*) FILTER (WHERE daily_shs < 50) AS struggling_count,
                    COUNT(*) FILTER (WHERE daily_shs >= 80) AS excelling_count,
                    COALESCE(AVG(quiz_score), 0) AS avg_quiz,
                    COALESCE(AVG(video_completion_rate), 0) AS avg_video,
                    COUNT(*) FILTER (WHERE first_attempt_score >= 70) AS first_pass_count
                FROM daily_student_metrics
                WHERE class_id = $1::uuid AND date = $2
                """,
                class_id, target_date,
            )
            if not agg or int(agg["total_students"] or 0) == 0:
                continue

            total = int(agg["total_students"])
            avg_shs = float(agg["avg_shs"] or 0)
            variance = float(agg["shs_stddev"] or 0)
            prev_agg = await execute_one(
                "SELECT COALESCE(AVG(daily_shs), 0) AS avg_shs FROM daily_student_metrics WHERE class_id = $1::uuid AND date = $2",
                class_id, target_date - timedelta(days=7),
            )
            raw_velocity = avg_shs - float(prev_agg["avg_shs"] or avg_shs)
            learning_velocity = min(max((raw_velocity + 10) / 20.0 * 100, 0), 100)
            first_pass_rate = (int(agg["first_pass_count"] or 0) / total * 100) if total else 0
            cvi_score = calculate_cvi(avg_shs, learning_velocity, variance, first_pass_rate)
            teacher_grade = get_teacher_grade(cvi_score)

            avg_quiz = float(agg["avg_quiz"] or 0)
            avg_video = float(agg["avg_video"] or 0)
            alert_msg = None
            if avg_quiz < 60 and avg_video > 85:
                alert_msg = "High engagement but low comprehension - content may be too complex"
            elif avg_video < 50 and avg_quiz < 60:
                alert_msg = "Low engagement AND comprehension - teaching approach needs revision"
            elif variance > 25:
                alert_msg = "Large performance gap - some students being left behind"

            await execute_write(
                """
                INSERT INTO class_vitality_index (
                    class_id, date, avg_shs, cvi_score, struggling_count, excelling_count,
                    total_students, engagement_variance, learning_velocity, content_effectiveness,
                    teacher_grade, alert_message
                ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (class_id, date) DO UPDATE SET
                    avg_shs = EXCLUDED.avg_shs, cvi_score = EXCLUDED.cvi_score,
                    struggling_count = EXCLUDED.struggling_count,
                    excelling_count = EXCLUDED.excelling_count,
                    total_students = EXCLUDED.total_students,
                    engagement_variance = EXCLUDED.engagement_variance,
                    learning_velocity = EXCLUDED.learning_velocity,
                    content_effectiveness = EXCLUDED.content_effectiveness,
                    teacher_grade = EXCLUDED.teacher_grade,
                    alert_message = EXCLUDED.alert_message
                """,
                class_id, target_date, avg_shs, cvi_score,
                int(agg["struggling_count"] or 0), int(agg["excelling_count"] or 0),
                total, variance, learning_velocity, first_pass_rate,
                teacher_grade, alert_msg,
            )
            class_ok += 1
        except Exception:
            class_err += 1

    return {
        "date": target_date.isoformat(),
        "students_processed": student_ok,
        "students_failed": student_err,
        "classes_processed": class_ok,
        "classes_failed": class_err,
    }


@router.post("/cron/weekly-ai-analysis")
async def cron_weekly_ai_analysis(
    analysis_date: Optional[str] = Query(default=None, alias="date"),
):
    """
    Weekly batch: run Claude AI analysis for:
    - At-risk students (SHS < 60)
    - All active classes
    - All active schools
    Results cached in ai_performance_insights.
    """
    target_date = date.fromisoformat(analysis_date) if analysis_date else date.today()
    thirty_days_ago = target_date - timedelta(days=30)

    student_ok = student_skip = 0
    class_ok = class_skip = 0
    school_ok = 0

    # ── Students (only at-risk: current_shs < 60) ──────────────────────────
    at_risk_students = await execute_query(
        """
        SELECT DISTINCT shs.student_id::text, u.full_name,
               shs.current_shs, shs.weekly_shs, shs.monthly_shs, shs.momentum, shs.risk_level
        FROM student_health_scores shs
        JOIN users u ON u.id = shs.student_id
        WHERE shs.current_shs < 60
        """
    )

    for s in at_risk_students:
        sid = str(s["student_id"])
        # Build 30-day summary
        metrics = await execute_query(
            """
            SELECT date, daily_shs, quiz_score, video_completion_rate,
                   attendance, homework_submitted, study_duration_minutes,
                   questions_asked, topic_revisits, test_retakes
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND date BETWEEN $2 AND $3
            ORDER BY date
            """,
            sid, thirty_days_ago, target_date,
        )
        summary = {
            "avg_shs": float(s["current_shs"] or 0),
            "weekly_shs": float(s["weekly_shs"] or 0),
            "monthly_shs": float(s["monthly_shs"] or 0),
            "momentum": float(s["momentum"] or 0),
            "risk_level": s["risk_level"],
            "daily_metrics": [dict(m) for m in metrics],
        }

        try:
            insights = await analyze_student_performance(sid, str(s["full_name"]), summary)
            await execute_write(
                """
                INSERT INTO ai_performance_insights
                    (entity_type, entity_id, analysis_date, exam_readiness_score, dropout_risk,
                     topics_needing_reinforcement, learning_style_patterns,
                     recommended_interventions, predictions, confidence_score)
                VALUES ('student', $1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
                ON CONFLICT (entity_type, entity_id, analysis_date) DO UPDATE SET
                    exam_readiness_score = EXCLUDED.exam_readiness_score,
                    dropout_risk = EXCLUDED.dropout_risk,
                    topics_needing_reinforcement = EXCLUDED.topics_needing_reinforcement,
                    learning_style_patterns = EXCLUDED.learning_style_patterns,
                    recommended_interventions = EXCLUDED.recommended_interventions,
                    predictions = EXCLUDED.predictions,
                    confidence_score = EXCLUDED.confidence_score
                """,
                sid, target_date,
                insights.get("exam_readiness_score"),
                insights.get("dropout_risk"),
                json.dumps(insights.get("topics_needing_reinforcement", [])),
                json.dumps(insights.get("learning_style_patterns", {})),
                json.dumps(insights.get("recommended_interventions", [])),
                json.dumps({k: v for k, v in insights.items() if k not in (
                    "exam_readiness_score", "dropout_risk", "topics_needing_reinforcement",
                    "learning_style_patterns", "recommended_interventions", "confidence_score",
                )}),
                insights.get("confidence_score"),
            )
            student_ok += 1
        except Exception:
            student_skip += 1

        # Small delay between API calls to avoid rate limiting
        await _asyncio.sleep(0.3)

    # ── Classes ──────────────────────────────────────────────────────────────
    classes = await execute_query(
        "SELECT id::text, name FROM classes WHERE is_active = true"
    )

    for cls in classes:
        cid = str(cls["id"])
        cvi_data = await execute_one(
            """
            SELECT COALESCE(AVG(cvi_score), 0) AS avg_cvi,
                   COALESCE(AVG(avg_shs), 0) AS avg_shs,
                   COALESCE(SUM(struggling_count), 0) AS struggling_count,
                   COALESCE(SUM(excelling_count), 0) AS excelling_count
            FROM class_vitality_index
            WHERE class_id = $1::uuid AND date BETWEEN $2 AND $3
            """,
            cid, thirty_days_ago, target_date,
        )
        if not cvi_data or float(cvi_data["avg_cvi"] or 0) == 0:
            class_skip += 1
            continue

        summary = {
            "avg_cvi": float(cvi_data["avg_cvi"] or 0),
            "avg_shs": float(cvi_data["avg_shs"] or 0),
            "struggling_count": int(cvi_data["struggling_count"] or 0),
            "excelling_count": int(cvi_data["excelling_count"] or 0),
        }

        try:
            insights = await analyze_class_performance(cid, str(cls["name"]), summary)
            await execute_write(
                """
                INSERT INTO ai_performance_insights
                    (entity_type, entity_id, analysis_date, predictions, confidence_score)
                VALUES ('class', $1::uuid, $2, $3::jsonb, $4)
                ON CONFLICT (entity_type, entity_id, analysis_date) DO UPDATE SET
                    predictions = EXCLUDED.predictions,
                    confidence_score = EXCLUDED.confidence_score
                """,
                cid, target_date, json.dumps(insights), insights.get("confidence_score"),
            )
            class_ok += 1
        except Exception:
            class_skip += 1

        await _asyncio.sleep(0.2)

    # ── Schools ───────────────────────────────────────────────────────────────
    schools = await execute_query(
        "SELECT id::text, name FROM schools WHERE is_active = true"
    )

    for sch in schools:
        sid = str(sch["id"])
        spi_data = await execute_one(
            """
            SELECT COALESCE(AVG(spi_score), 0) AS avg_spi,
                   COALESCE(AVG(avg_shs), 0) AS avg_shs,
                   COALESCE(AVG(at_risk_percentage), 0) AS avg_at_risk,
                   COALESCE(SUM(underperforming_teachers_count), 0) AS underperforming_teachers
            FROM school_performance_index
            WHERE school_id = $1::uuid AND week_start >= $2
            """,
            sid, thirty_days_ago,
        )
        if not spi_data or float(spi_data["avg_spi"] or 0) == 0:
            continue

        summary = {
            "avg_spi": float(spi_data["avg_spi"] or 0),
            "avg_shs": float(spi_data["avg_shs"] or 0),
            "total_at_risk": float(spi_data["avg_at_risk"] or 0),
            "underperforming_teachers": int(spi_data["underperforming_teachers"] or 0),
        }

        try:
            insights = await analyze_school_performance(sid, str(sch["name"]), summary)
            await execute_write(
                """
                INSERT INTO ai_performance_insights
                    (entity_type, entity_id, analysis_date, predictions, confidence_score)
                VALUES ('school', $1::uuid, $2, $3::jsonb, $4)
                ON CONFLICT (entity_type, entity_id, analysis_date) DO UPDATE SET
                    predictions = EXCLUDED.predictions,
                    confidence_score = EXCLUDED.confidence_score
                """,
                sid, target_date, json.dumps(insights), insights.get("confidence_score"),
            )
            school_ok += 1
        except Exception:
            pass

        await _asyncio.sleep(0.2)

    return {
        "date": target_date.isoformat(),
        "students_analyzed": student_ok,
        "students_skipped": student_skip,
        "classes_analyzed": class_ok,
        "classes_skipped": class_skip,
        "schools_analyzed": school_ok,
    }


# ===========================================================================
# AI INSIGHTS READ ENDPOINTS
# ===========================================================================

@router.get("/insights/student/{student_id}")
async def get_student_ai_insights(student_id: str):
    """Fetch latest AI insights for a student (Redis-cached for 30 days)."""
    cached = await get_cached_ai_insights("student", student_id)
    if cached:
        return cached
    row = await execute_one(
        """
        SELECT * FROM ai_performance_insights
        WHERE entity_type = 'student' AND entity_id = $1::uuid
        ORDER BY analysis_date DESC LIMIT 1
        """,
        student_id,
    )
    if not row:
        return {"available": False}
    result = {"available": True, **dict(row)}
    await cache_ai_insights("student", student_id, result)
    return result


@router.get("/insights/class/{class_id}")
async def get_class_ai_insights(class_id: str):
    """Fetch latest AI insights for a class (Redis-cached for 30 days)."""
    cached = await get_cached_ai_insights("class", class_id)
    if cached:
        return cached
    row = await execute_one(
        """
        SELECT * FROM ai_performance_insights
        WHERE entity_type = 'class' AND entity_id = $1::uuid
        ORDER BY analysis_date DESC LIMIT 1
        """,
        class_id,
    )
    if not row:
        return {"available": False}
    result = {"available": True, **dict(row)}
    await cache_ai_insights("class", class_id, result)
    return result


@router.get("/insights/school/{school_id}")
async def get_school_ai_insights(school_id: str):
    """Fetch latest AI insights for a school (Redis-cached for 30 days)."""
    cached = await get_cached_ai_insights("school", school_id)
    if cached:
        return cached
    row = await execute_one(
        """
        SELECT * FROM ai_performance_insights
        WHERE entity_type = 'school' AND entity_id = $1::uuid
        ORDER BY analysis_date DESC LIMIT 1
        """,
        school_id,
    )
    if not row:
        return {"available": False}
    result = {"available": True, **dict(row)}
    await cache_ai_insights("school", school_id, result)
    return result

