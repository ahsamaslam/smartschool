"""
Historical Metrics & Snapshot System
Captures daily SHS snapshots, calculates rolling averages, momentum scores, and alerts.
"""
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Tuple
import logging

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.score_calculator import calculate_live_shs, get_risk_level

logger = logging.getLogger(__name__)


async def capture_daily_student_metrics(student_id: str, class_id: str) -> Dict:
    """
    Capture daily SHS snapshot for a student.
    Called daily at midnight for all active students.
    """
    try:
        # Get video engagement rate
        video_data = await execute_one(
            """
            SELECT
                COALESCE(ROUND(100.0 * COUNT(CASE WHEN stp.lecture_watch_percent >= 75 THEN 1 END)
                / NULLIF(COUNT(stp.topic_id), 0), 2), 0) AS video_rate,
                COUNT(DISTINCT stp.topic_id) AS total_lectures,
                COUNT(CASE WHEN stp.lecture_watch_percent >= 75 THEN 1 END) AS watched_count
            FROM student_topic_progress stp
            JOIN library_topics lt ON lt.id = stp.topic_id
            JOIN library_chapters lc ON lc.id = lt.chapter_id
            JOIN library_books lb ON lb.id = lc.book_id
            JOIN teacher_class_subject_assignments tcsa
                ON tcsa.library_book_id = lb.id AND tcsa.class_id = $2::uuid
            WHERE stp.student_id = $1::uuid AND stp.created_at >= CURRENT_DATE
            """,
            student_id, class_id
        )
        video_rate = float(video_data["video_rate"] or 0)

        # Get homework completion and marks
        hw_data = await execute_one(
            """
            SELECT
                COALESCE(ROUND(100.0 * SUM(CASE WHEN hs.marks_awarded IS NOT NULL THEN hs.marks_awarded ELSE CASE WHEN hs.submission_status IN ('submitted','late','reviewed','returned') THEN (h.total_marks * 0.75) ELSE 0 END END)
                / NULLIF(SUM(h.total_marks), 0), 2), 0) AS homework_rate,
                COUNT(CASE WHEN hs.submission_status IN ('submitted','late','reviewed','returned') THEN 1 END) AS submitted_count,
                COUNT(DISTINCT h.id) AS total_homeworks
            FROM homeworks h
            LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1::uuid
            WHERE h.class_id = $2::uuid AND h.status = 'published'
            """,
            student_id, class_id
        )
        homework_rate = float(hw_data["homework_rate"] or 0)
        homework_submitted = int(hw_data["submitted_count"] or 0)
        total_homeworks = int(hw_data["total_homeworks"] or 0)

        # Get attendance rate (today only)
        att_data = await execute_one(
            """
            SELECT
                COALESCE(is_present, false) AS is_present
            FROM attendance
            WHERE student_id = $1::uuid AND class_id = $2::uuid AND date = CURRENT_DATE
            """,
            student_id, class_id
        )
        attendance_today = 100.0 if att_data and att_data["is_present"] else 0.0

        # Get homework submission rate (overall for class)
        hw_sub_data = await execute_one(
            """
            SELECT
                COALESCE(ROUND(100.0 * COUNT(CASE WHEN hs.submission_status IN ('submitted','late','reviewed','returned') THEN 1 END)
                / NULLIF(COUNT(DISTINCT h.id), 0), 2), 0) AS submission_rate
            FROM homeworks h
            LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1::uuid
            WHERE h.class_id = $2::uuid AND h.status = 'published'
            """,
            student_id, class_id
        )
        homework_submission_rate = float(hw_sub_data["submission_rate"] or 0)

        # Get behavioral metrics (retakes, revisits, study duration)
        behav_data = await execute_one(
            """
            SELECT
                COALESCE(AVG(hs.attempt_number), 0) AS homework_retakes_avg,
                COALESCE(AVG(stp.revisit_count), 0) AS topic_revisits_avg,
                COALESCE(
                    EXTRACT(EPOCH FROM SUM(CASE WHEN ssl.logout_at IS NOT NULL
                        THEN ssl.logout_at - ssl.login_at
                        ELSE NOW() - ssl.login_at END)) / 60.0, 0
                ) AS study_duration_minutes
            FROM student_topic_progress stp
            LEFT JOIN homework_submissions hs ON hs.student_id = $1::uuid
            LEFT JOIN student_session_logs ssl ON ssl.student_id = $1::uuid AND DATE(ssl.login_at) = CURRENT_DATE
            WHERE stp.student_id = $1::uuid
            """,
            student_id, class_id
        )
        homework_retakes_avg = float(behav_data["homework_retakes_avg"] or 0)
        topic_revisits_avg = float(behav_data["topic_revisits_avg"] or 0)
        study_duration_minutes = float(behav_data["study_duration_minutes"] or 0)

        # Calculate SHS using updated formula
        shs, consistency_score, behavioral_score = calculate_live_shs(
            video_rate=video_rate,
            homework_rate=homework_rate,
            attendance_rate=attendance_today,
            homework_submission_rate=homework_submission_rate,
            homework_retakes_avg=homework_retakes_avg,
            topic_revisits_avg=topic_revisits_avg,
            study_duration_minutes=study_duration_minutes
        )

        risk_level = get_risk_level(shs)

        # Insert daily snapshot
        await execute_write(
            """
            INSERT INTO daily_student_metrics
            (student_id, class_id, date, video_completion_rate, homework_submission_rate,
             attendance_rate, homework_retakes_avg, topic_revisits_avg, study_duration_minutes,
             daily_shs, risk_level, consistency_score, behavioral_score)
            VALUES ($1::uuid, $2::uuid, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (student_id, class_id, date) DO UPDATE SET
                video_completion_rate = $3,
                homework_submission_rate = $4,
                attendance_rate = $5,
                homework_retakes_avg = $6,
                topic_revisits_avg = $7,
                study_duration_minutes = $8,
                daily_shs = $9,
                risk_level = $10,
                consistency_score = $11,
                behavioral_score = $12,
                updated_at = NOW()
            """,
            student_id, class_id, video_rate, homework_submission_rate,
            attendance_today, homework_retakes_avg, topic_revisits_avg, study_duration_minutes,
            shs, risk_level, consistency_score, behavioral_score
        )

        return {
            "student_id": student_id,
            "class_id": class_id,
            "date": date.today().isoformat(),
            "shs": shs,
            "risk_level": risk_level,
            "video_rate": video_rate,
            "homework_rate": homework_rate,
            "consistency_score": consistency_score,
            "behavioral_score": behavioral_score
        }
    except Exception as e:
        logger.error(f"Error capturing metrics for student {student_id}: {str(e)}")
        return None


async def calculate_rolling_averages(student_id: str, class_id: str) -> Dict:
    """
    Calculate 7-day and 30-day rolling averages, momentum score.
    """
    try:
        # Get last 7 days of SHS
        weekly_data = await execute_one(
            """
            SELECT
                AVG(daily_shs) AS weekly_avg,
                COUNT(*) AS days_recorded
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date >= CURRENT_DATE - INTERVAL '7 days'
            AND date <= CURRENT_DATE
            """,
            student_id, class_id
        )
        weekly_shs = float(weekly_data["weekly_avg"] or 0) if weekly_data else 0

        # Get previous week (7-14 days ago)
        prev_week_data = await execute_one(
            """
            SELECT AVG(daily_shs) AS prev_avg
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date >= CURRENT_DATE - INTERVAL '14 days'
            AND date < CURRENT_DATE - INTERVAL '7 days'
            """,
            student_id, class_id
        )
        prev_weekly_shs = float(prev_week_data["prev_avg"] or 0) if prev_week_data else weekly_shs

        # Calculate momentum: % change week-over-week
        momentum = 0.0
        if prev_weekly_shs > 0:
            momentum = round(((weekly_shs - prev_weekly_shs) / prev_weekly_shs) * 100, 2)

        # Get 30-day average
        monthly_data = await execute_one(
            """
            SELECT AVG(daily_shs) AS monthly_avg
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            """,
            student_id, class_id
        )
        monthly_shs = float(monthly_data["monthly_avg"] or 0) if monthly_data else 0

        # Get current SHS (today's snapshot)
        current_data = await execute_one(
            """
            SELECT daily_shs, risk_level
            FROM daily_student_metrics
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            AND date = CURRENT_DATE
            """,
            student_id, class_id
        )
        current_shs = float(current_data["daily_shs"] or 0) if current_data else 0
        risk_level = current_data["risk_level"] if current_data else "stable"

        # Update student_health_scores
        await execute_write(
            """
            INSERT INTO student_health_scores
            (student_id, class_id, current_shs, weekly_shs, monthly_shs, momentum, risk_level)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
            ON CONFLICT (student_id, class_id) DO UPDATE SET
                current_shs = $3,
                weekly_shs = $4,
                monthly_shs = $5,
                momentum = $6,
                risk_level = $7,
                last_updated = NOW()
            """,
            student_id, class_id, current_shs, weekly_shs, monthly_shs, momentum, risk_level
        )

        return {
            "student_id": student_id,
            "class_id": class_id,
            "current_shs": current_shs,
            "weekly_shs": weekly_shs,
            "monthly_shs": monthly_shs,
            "momentum": momentum,
            "risk_level": risk_level
        }
    except Exception as e:
        logger.error(f"Error calculating rolling averages for student {student_id}: {str(e)}")
        return None


async def generate_alerts(student_id: str, class_id: str, teacher_id: Optional[str] = None) -> List[Dict]:
    """
    Generate alerts based on:
    1. Momentum < -15% - Rapid decline
    2. SHS < 50 for 3 consecutive days - Consistent underperformance
    3. Video engagement < 20% for 5 days - Video disengagement
    4. Zero homework submission for 7 days - Homework zero
    5. SHS < 30 for 2 days - Critical state
    6. Attendance < 60% in 2 weeks - Chronic absenteeism
    7. Behavioral health declining - External factors
    8. Multiple low quiz scores - Subject comprehension issue
    """
    alerts = []
    try:
        # Check momentum alert
        health_scores = await execute_one(
            """
            SELECT momentum, current_shs, risk_level
            FROM student_health_scores
            WHERE student_id = $1::uuid AND class_id = $2::uuid
            """,
            student_id, class_id
        )

        if health_scores:
            momentum = float(health_scores["momentum"] or 0)
            current_shs = float(health_scores["current_shs"] or 0)

            # 🔴 CRITICAL: Rapid decline in performance
            if momentum < -15:
                alerts.append({
                    "alert_type": "momentum_decline",
                    "severity": "critical",
                    "message": f"🔴 Rapid decline in performance ({momentum:.1f}% drop) - immediate teacher intervention needed",
                    "action_required": "Contact student immediately to discuss challenges"
                })

            # 🔴 CRITICAL: Consistent underperformance (3+ consecutive days below 50)
            underperf_days = await execute_one(
                """
                SELECT COUNT(*) as count
                FROM daily_student_metrics
                WHERE student_id = $1::uuid AND class_id = $2::uuid
                AND daily_shs < 50
                AND date >= CURRENT_DATE - INTERVAL '3 days'
                """,
                student_id, class_id
            )
            if underperf_days and underperf_days["count"] >= 3:
                alerts.append({
                    "alert_type": "consistent_underperformance",
                    "severity": "critical",
                    "message": f"⚠️ Consistent underperformance for 3+ days (current SHS: {current_shs:.1f})",
                    "action_required": "Parent meeting recommended to discuss support strategies"
                })

            # 🔴 CRITICAL: Critical state (SHS < 30 for 2 days)
            critical_days = await execute_one(
                """
                SELECT COUNT(*) as count
                FROM daily_student_metrics
                WHERE student_id = $1::uuid AND class_id = $2::uuid
                AND daily_shs < 30
                AND date >= CURRENT_DATE - INTERVAL '2 days'
                """,
                student_id, class_id
            )
            if critical_days and critical_days["count"] >= 2:
                alerts.append({
                    "alert_type": "critical_state",
                    "severity": "critical",
                    "message": f"🚨 CRITICAL: Student in severe distress (SHS: {current_shs:.1f})",
                    "action_required": "Contact parent immediately. Consider 1-on-1 intervention or counselor referral."
                })

            # 🟡 WARNING: Severe video disengagement
            video_low_days = await execute_one(
                """
                SELECT COUNT(*) as count
                FROM daily_student_metrics
                WHERE student_id = $1::uuid AND class_id = $2::uuid
                AND video_completion_rate < 20
                AND date >= CURRENT_DATE - INTERVAL '5 days'
                """,
                student_id, class_id
            )
            if video_low_days and video_low_days["count"] >= 5:
                alerts.append({
                    "alert_type": "video_disengagement",
                    "severity": "warning",
                    "message": "📹 Complete disengagement from video lectures (< 20% for 5 days)",
                    "action_required": "Encourage student to watch recorded lectures or attend live sessions"
                })

            # 🔴 CRITICAL: Zero homework for a week
            hw_zero_days = await execute_one(
                """
                SELECT COUNT(*) as count
                FROM daily_student_metrics
                WHERE student_id = $1::uuid AND class_id = $2::uuid
                AND homework_submission_rate = 0
                AND date >= CURRENT_DATE - INTERVAL '7 days'
                """,
                student_id, class_id
            )
            if hw_zero_days and hw_zero_days["count"] >= 7:
                alerts.append({
                    "alert_type": "homework_zero",
                    "severity": "critical",
                    "message": "📋 Zero homework submissions for 7+ days",
                    "action_required": "Check for motivational issues or external barriers; consider deadline extensions"
                })

            # 🟡 WARNING: Chronic absenteeism (< 60% in 2 weeks)
            attendance_avg = await execute_one(
                """
                SELECT AVG(attendance_rate) as avg_attendance
                FROM daily_student_metrics
                WHERE student_id = $1::uuid AND class_id = $2::uuid
                AND date >= CURRENT_DATE - INTERVAL '14 days'
                """,
                student_id, class_id
            )
            if attendance_avg and float(attendance_avg["avg_attendance"] or 0) < 60:
                alerts.append({
                    "alert_type": "chronic_absenteeism",
                    "severity": "warning",
                    "message": f"📍 Chronic absenteeism detected ({float(attendance_avg['avg_attendance'] or 0):.0f}% in last 2 weeks)",
                    "action_required": "Contact student/parent about attendance. Check for underlying issues (transport, health, etc.)"
                })

            # 🟡 WARNING: Behavioral health declining
            behavioral_trend = await execute_one(
                """
                SELECT
                    (SELECT behavioral_score FROM daily_student_metrics
                     WHERE student_id = $1::uuid AND class_id = $2::uuid
                     ORDER BY date DESC LIMIT 1) as current,
                    (SELECT AVG(behavioral_score) FROM daily_student_metrics
                     WHERE student_id = $1::uuid AND class_id = $2::uuid
                     AND date BETWEEN CURRENT_DATE - INTERVAL '14 days' AND CURRENT_DATE - INTERVAL '7 days') as prev_week
                """,
                student_id, class_id
            )
            if behavioral_trend:
                current_behav = float(behavioral_trend["current"] or 50)
                prev_behav = float(behavioral_trend["prev_week"] or 50)
                if current_behav < prev_behav - 10:  # Declined 10+ points
                    alerts.append({
                        "alert_type": "behavioral_decline",
                        "severity": "warning",
                        "message": f"📉 Behavioral health declining ({current_behav:.0f} vs {prev_behav:.0f} last week)",
                        "action_required": "Check in with student about external stressors. May need counselor referral or study support."
                    })

        # Insert alerts into database
        for alert in alerts:
            await execute_write(
                """
                INSERT INTO performance_alerts
                (alert_type, severity, student_id, class_id, teacher_id, message, action_required)
                VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7)
                ON CONFLICT DO NOTHING
                """,
                alert["alert_type"], alert["severity"], student_id, class_id, teacher_id,
                alert["message"], alert["action_required"]
            )

        return alerts
    except Exception as e:
        logger.error(f"Error generating alerts for student {student_id}: {str(e)}")
        return []


async def run_daily_metrics_job():
    """
    Cron job: Run at midnight to capture daily metrics for all active students.
    """
    logger.info("🌙 Starting daily metrics calculation job...")
    try:
        # Get all active enrollments
        enrollments = await execute_query(
            """
            SELECT DISTINCT e.student_id, e.class_id, c.teacher_id
            FROM enrollments e
            JOIN classes c ON c.id = e.class_id
            WHERE e.is_active = true
            """
        )

        captured = 0
        for enrollment in enrollments:
            student_id = enrollment["student_id"]
            class_id = enrollment["class_id"]
            teacher_id = enrollment.get("teacher_id")

            # Capture daily metrics
            result = await capture_daily_student_metrics(student_id, str(class_id))
            if result:
                captured += 1

            # Calculate rolling averages
            await calculate_rolling_averages(student_id, str(class_id))

            # Generate alerts
            await generate_alerts(student_id, str(class_id), teacher_id)

        logger.info(f"✅ Daily metrics job complete: {captured} students processed")
    except Exception as e:
        logger.error(f"❌ Daily metrics job failed: {str(e)}")
