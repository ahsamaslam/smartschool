"""
Cron Job Endpoints - Daily/Weekly Calculations
These should be called by scheduled tasks (e.g., APScheduler, AWS EventBridge)
"""
from fastapi import APIRouter, HTTPException
from app.utils.database import execute_query, execute_one, execute_write
from app.utils.score_calculator import calculate_spi, get_school_rating

router = APIRouter()


@router.post("/calculate-daily-scores")
async def calculate_daily_scores():
    """Calculate SHS for all students - runs at midnight"""
    try:
        all_students = await execute_query(
            "SELECT DISTINCT student_id FROM enrollments WHERE is_active = true"
        )

        success_count = 0

        for student_row in all_students:
            try:
                student_id = str(student_row["student_id"])

                # Get metrics - ONLY: video, homework grades, attendance
                metrics = await execute_one(
                    """SELECT
                        COALESCE(AVG(lecture_watch_percent), 0) as video_rate,
                        COALESCE((SUM(marks_awarded)::FLOAT / NULLIF(SUM(total_marks), 0)) * 100, 0) as homework_grade,
                        COALESCE((SUM(CASE WHEN is_present THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) * 100, 0) as attendance_rate
                    FROM (
                        SELECT lecture_watch_percent FROM student_topic_progress WHERE student_id = $1::uuid
                    ) v
                    CROSS JOIN (
                        SELECT marks_awarded, total_marks FROM homework_submissions WHERE student_id = $1::uuid
                    ) h
                    CROSS JOIN (
                        SELECT is_present FROM attendance WHERE student_id = $1::uuid
                    ) a""",
                    student_id
                )

                if not metrics:
                    # Insert with 0 scores if no data
                    await execute_write(
                        """INSERT INTO student_health_scores (student_id, current_shs, risk_level, last_updated)
                           VALUES ($1::uuid, 0, 'at_risk', NOW())
                           ON CONFLICT (student_id) DO UPDATE SET
                           current_shs = 0, risk_level = 'at_risk', last_updated = NOW()""",
                        student_id
                    )
                    continue

                # Calculate SHS using simplified formula
                video = float(metrics.get("video_rate") or 0)
                homework = float(metrics.get("homework_grade") or 0)
                attendance = float(metrics.get("attendance_rate") or 0)

                # SHS = (Video × 0.25) + (Homework × 0.40) + (Attendance × 0.20) + (Homework × 0.15)
                shs = (video * 0.25) + (homework * 0.40) + (attendance * 0.20) + (homework * 0.15)
                shs = round(min(max(shs, 0), 100), 2)

                risk_level = "critical" if shs < 40 else "at_risk" if shs < 60 else "stable" if shs < 80 else "excelling"

                await execute_write(
                    """INSERT INTO student_health_scores (student_id, current_shs, risk_level, last_updated)
                       VALUES ($1::uuid, $2, $3, NOW())
                       ON CONFLICT (student_id) DO UPDATE SET
                       current_shs = $2, risk_level = $3, last_updated = NOW()""",
                    student_id, shs, risk_level
                )

                success_count += 1

            except Exception as e:
                continue

        return {"status": "completed", "processed": success_count}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate-school-spi")
async def calculate_school_spi():
    """Calculate SPI for all schools - runs weekly"""
    try:
        schools = await execute_query("SELECT id FROM schools")

        results = []

        for school_row in schools:
            try:
                school_id = str(school_row["id"])

                # Get all students' average SHS in this school
                avg_data = await execute_one(
                    """SELECT
                        COALESCE(AVG(sh.current_shs), 70) as avg_shs,
                        COUNT(CASE WHEN sh.current_shs >= 80 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 1) * 100 as top_pct,
                        COUNT(CASE WHEN sh.current_shs < 50 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 1) * 100 as risk_pct
                    FROM schools s
                    LEFT JOIN branches b ON b.school_id = s.id
                    LEFT JOIN classes c ON c.branch_id = b.id
                    LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
                    LEFT JOIN student_health_scores sh ON sh.student_id = e.student_id
                    WHERE s.id = $1::uuid""",
                    school_id
                )

                # Get class average CVI
                cvi_data = await execute_one(
                    """SELECT AVG(cvi_score) as avg_cvi
                       FROM class_vitality_index cv
                       JOIN classes c ON c.id = cv.class_id
                       JOIN branches b ON b.id = c.branch_id
                       WHERE b.school_id = $1::uuid
                       AND cv.date = CURRENT_DATE""",
                    school_id
                )

                avg_shs = float(avg_data.get("avg_shs", 70)) if avg_data else 70
                avg_cvi = float(cvi_data.get("avg_cvi", 70)) if cvi_data else 70
                top_pct = float(avg_data.get("top_pct", 30)) if avg_data else 30
                risk_pct = float(avg_data.get("risk_pct", 20)) if avg_data else 20

                # Calculate SPI
                spi = calculate_spi(
                    school_avg_shs=avg_shs,
                    school_avg_cvi=avg_cvi,
                    top_performers_pct=top_pct,
                    at_risk_pct=risk_pct,
                    excellent_teachers_pct=40,
                    underperforming_teachers_pct=15,
                    avg_attendance_rate=80,
                    homework_submission_rate=75,
                    mom_improvement=0
                )

                rating = get_school_rating(spi)

                await execute_write(
                    """INSERT INTO school_performance_index (school_id, week_start, spi_score, avg_shs, avg_cvi, rating)
                       VALUES ($1::uuid, CURRENT_DATE, $2, $3, $4, $5)
                       ON CONFLICT (school_id, week_start) DO UPDATE SET
                       spi_score = $2, avg_shs = $3, avg_cvi = $4, rating = $5""",
                    school_id, spi, avg_shs, avg_cvi, rating
                )

                results.append({"school_id": school_id, "spi_score": spi, "rating": rating})

            except Exception as e:
                continue

        return {"status": "completed", "schools_processed": len(results), "results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
