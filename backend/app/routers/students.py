"""
Student Portal Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.utils.database import execute_query, execute_one, execute_write
from app.routers.auth import get_user_from_token
from app.utils.claude_ai import answer_student_question
from app.utils.cache import buffer_video_event

router = APIRouter()


async def _attendance_graph_for_student(student_id: str, courses: List[dict]) -> List[dict]:
    """
    Prefer one bar per curriculum subject on the student's enrolled sections.
    Attendance % is still the section (class) aggregate — each subject row inherits its class %.
    Falls back to one bar per enrolled class when no subject links exist.
    """
    pct_by_class = {str(c["class_id"]): float(c.get("attendance_percent") or 0) for c in courses}

    section_sql = """
        SELECT DISTINCT
            s.id AS subject_id,
            s.name AS subject_name,
            c.id AS class_id,
            c.name AS class_name
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        JOIN section_subjects ss ON ss.class_id = c.id
        JOIN library_subjects s ON s.id = ss.subject_id
        WHERE e.student_id = $1::uuid AND e.is_active = true
        ORDER BY c.name, s.name
    """
    legacy_sql = """
        SELECT DISTINCT
            s.id AS subject_id,
            s.name AS subject_name,
            c.id AS class_id,
            c.name AS class_name
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        JOIN class_subjects cs ON cs.class_id = c.id
        JOIN subjects s ON s.id = cs.subject_id
        WHERE e.student_id = $1::uuid AND e.is_active = true
        ORDER BY c.name, s.name
    """

    subject_rows: List[dict] = []
    try:
        subject_rows = await execute_query(section_sql, student_id)
    except Exception:
        subject_rows = []
    if not subject_rows:
        try:
            subject_rows = await execute_query(legacy_sql, student_id)
        except Exception:
            subject_rows = []

    if not subject_rows:
        return [
            {
                "course": str(c.get("class_name") or "Class"),
                "full_label": str(c.get("class_name") or "Class"),
                "attendance_percent": float(c.get("attendance_percent") or 0),
            }
            for c in courses
        ]

    # Disambiguate duplicate subject names across sections
    name_counts: dict = {}
    for r in subject_rows:
        nm = (r.get("subject_name") or "").strip() or "Subject"
        name_counts[nm] = name_counts.get(nm, 0) + 1

    graph: List[dict] = []
    for r in subject_rows:
        sid = str(r.get("subject_id"))
        c_id = str(r.get("class_id"))
        sname = (r.get("subject_name") or "").strip() or "Subject"
        cname = (r.get("class_name") or "").strip() or "Section"
        pct = pct_by_class.get(c_id, 0.0)
        if name_counts.get(sname, 0) > 1:
            short = f"{sname[:18]}{'…' if len(sname) > 18 else ''} · {cname[:14]}{'…' if len(cname) > 14 else ''}"
            full = f"{sname} — {cname}"
        else:
            short = sname[:22] + ("…" if len(sname) > 22 else "")
            full = f"{sname} ({cname})"
        graph.append(
            {
                "course": short,
                "full_label": full,
                "subject_id": sid,
                "class_id": c_id,
                "attendance_percent": pct,
            }
        )
    return graph


async def ensure_attendance_schema():
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS attendance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID NOT NULL,
            class_id UUID NOT NULL,
            date DATE NOT NULL,
            is_present BOOLEAN NOT NULL DEFAULT false,
            marked_by UUID,
            marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await execute_write(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_uq
        ON attendance(student_id, class_id, date)
        """
    )


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class QuestionRequest(BaseModel):
    student_id: str
    video_id: str
    question_text: str


class VideoEventRequest(BaseModel):
    session_id: str
    event_type: str  # 'play', 'pause', 'seek', 'complete'
    timestamp_in_video: int


# ============================================
# STUDENT DASHBOARD
# ============================================

@router.get("/dashboard/{student_id}")
async def get_student_dashboard(student_id: str):
    """
    Get student dashboard with subjects and performance summary
    """
    
    # Get enrolled classes and subjects
    query = """
        SELECT DISTINCT
            s.id as subject_id,
            s.name as subject_name,
            s.description,
            cs.class_id,
            c.name as class_name
        FROM enrollments e
        JOIN classes c ON e.class_id = c.id
        JOIN class_subjects cs ON c.id = cs.class_id
        JOIN subjects s ON cs.subject_id = s.id
        WHERE e.student_id = $1 AND e.is_active = true
        ORDER BY s.name
    """
    
    subjects = await execute_query(query, student_id)
    
    # Get performance summary for each subject
    result = []
    for subject in subjects:
        # Get latest quiz score and average
        quiz_query = """
            SELECT 
                MAX(qa.score) as highest_score,
                AVG(qa.score) as average_score,
                COUNT(*) as attempt_count
            FROM quiz_attempts qa
            JOIN quiz_instances qi ON qa.quiz_instance_id = qi.id
            JOIN published_videos pv ON qi.published_video_id = pv.id
            JOIN video_templates vt ON pv.video_template_id = vt.id
            JOIN topics t ON vt.topic_id = t.id
            WHERE qa.student_id = $1 
                AND t.subject_id = $2
                AND qa.is_completed = true
        """
        
        quiz_stats = await execute_one(quiz_query, student_id, subject["subject_id"])
        
        result.append({
            "subject_id": str(subject["subject_id"]),
            "subject_name": subject["subject_name"],
            "description": subject["description"],
            "class_name": subject["class_name"],
            "highest_score": float(quiz_stats["highest_score"] or 0),
            "average_score": float(quiz_stats["average_score"] or 0),
            "total_attempts": quiz_stats["attempt_count"] or 0
        })
    
    return {
        "student_id": student_id,
        "subjects": result
    }


@router.get("/attendance/summary/{student_id}")
async def get_student_attendance_summary(
    student_id: str,
    user: dict = Depends(get_user_from_token),
):
    """
    Attendance summary grouped by enrolled class (teacher-facing style stats for student view).
    """
    role = user.get("role")
    uid = str(user.get("user_id"))
    if role not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if role == "student" and str(student_id) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    await ensure_attendance_schema()
    query = """
        SELECT
            c.id AS class_id,
            c.name AS class_name,
            COALESCE(t.full_name, 'Unassigned') AS teacher_name,
            CASE
                WHEN LOWER(c.name) LIKE '%lab%' THEN 'Lab'
                WHEN LOWER(c.name) LIKE '%thesis%' THEN 'Thesis'
                ELSE 'Theory'
            END AS teaching_type,
            COALESCE(att.present_days, 0) AS present_days,
            COALESCE(att.absent_days, 0) AS absent_days,
            COALESCE(att.total_days, 0) AS total_days,
            COALESCE(att.attendance_percent, 0) AS attendance_percent
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        LEFT JOIN users t ON t.id = c.teacher_id
        LEFT JOIN (
            SELECT
                student_id,
                class_id,
                COUNT(*) AS total_days,
                SUM(CASE WHEN is_present THEN 1 ELSE 0 END) AS present_days,
                SUM(CASE WHEN is_present THEN 0 ELSE 1 END) AS absent_days,
                ROUND(
                    100.0 * SUM(CASE WHEN is_present THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
                    2
                ) AS attendance_percent
            FROM attendance
            WHERE student_id = $1::uuid
            GROUP BY student_id, class_id
        ) att ON att.class_id = c.id
        WHERE e.student_id = $1::uuid
          AND e.is_active = true
        ORDER BY c.name
    """

    rows = await execute_query(query, student_id)
    courses = [dict(r) for r in rows]
    graph = await _attendance_graph_for_student(student_id, courses)
    overall_total = sum(int(c["total_days"] or 0) for c in courses)
    overall_present = sum(int(c["present_days"] or 0) for c in courses)
    overall_percent = round((overall_present * 100.0 / overall_total), 2) if overall_total else 0.0

    return {
        "student_id": student_id,
        "courses": courses,
        "graph": graph,
        "overall": {
            "present_days": overall_present,
            "total_days": overall_total,
            "attendance_percent": overall_percent,
        },
    }


# ============================================
# TOPICS & VIDEOS
# ============================================

@router.get("/subjects/{subject_id}/topics")
async def get_subject_topics(subject_id: str, student_id: str):
    """
    Get all topics for a subject with progress
    """
    
    query = """
        SELECT 
            t.id as topic_id,
            t.title,
            t.description,
            t.order_index,
            pv.id as video_id,
            pv.published_date,
            CASE 
                WHEN pv.published_date = CURRENT_DATE THEN true
                ELSE false
            END as is_today_topic,
            vws.completion_percentage
        FROM topics t
        LEFT JOIN video_templates vt ON t.id = vt.topic_id
        LEFT JOIN published_videos pv ON vt.id = pv.video_template_id
        LEFT JOIN video_watch_sessions vws ON (
            pv.id = vws.published_video_id 
            AND vws.student_id = $2
        )
        WHERE t.subject_id = $1
        ORDER BY t.order_index
    """
    
    topics = await execute_query(query, subject_id, student_id)
    
    return [dict(topic) for topic in topics]


@router.get("/videos/{video_id}")
async def get_video_details(video_id: str, student_id: str):
    """
    Get video details for viewing
    """
    
    query = """
        SELECT 
            pv.id as video_id,
            pv.final_video_url,
            vt.title,
            vt.duration_seconds,
            vt.transcript,
            t.title as topic_title,
            s.name as subject_name,
            ap.avatar_name,
            u.full_name as teacher_name
        FROM published_videos pv
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN avatar_profiles ap ON pv.avatar_profile_id = ap.id
        LEFT JOIN users u ON ap.teacher_id = u.id
        WHERE pv.id = $1
    """
    
    video = await execute_one(query, video_id)
    
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Create or get watch session
    session_query = """
        INSERT INTO video_watch_sessions (student_id, published_video_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING id
    """
    
    session = await execute_one(session_query, student_id, video_id)
    
    # Get existing session if not created
    if not session:
        session = await execute_one(
            "SELECT id FROM video_watch_sessions WHERE student_id = $1 AND published_video_id = $2",
            student_id, video_id
        )
    
    return {
        **dict(video),
        "session_id": str(session["id"])
    }


@router.post("/videos/track-event")
async def track_video_event(event: VideoEventRequest):
    """
    Track video engagement events
    """
    
    # Buffer event in Redis for bulk insert
    await buffer_video_event(event.session_id, {
        "event_type": event.event_type,
        "timestamp_in_video": event.timestamp_in_video,
        "created_at": datetime.now().isoformat()
    })
    
    # Update session totals if it's a completion event
    if event.event_type == "complete":
        query = """
            UPDATE video_watch_sessions
            SET is_completed = true,
                completion_percentage = 100,
                ended_at = NOW()
            WHERE id = $1
        """
        await execute_write(query, event.session_id)
    
    return {"status": "tracked"}


# ============================================
# Q&A BOT
# ============================================

@router.post("/qa/ask")
async def ask_question(request: QuestionRequest):
    """
    Ask question and get AI-powered answer
    """
    
    # Get video context
    video_query = """
        SELECT t.title as topic_title, s.name as subject_name, t.id as topic_id
        FROM published_videos pv
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE pv.id = $1
    """
    
    context = await execute_one(video_query, request.video_id)
    
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Get AI answer
    result = await answer_student_question(
        question=request.question_text,
        topic_title=context["topic_title"],
        subject_name=context["subject_name"],
        topic_id=str(context["topic_id"])
    )
    
    # Save question and answer
    question_query = """
        INSERT INTO student_questions (student_id, published_video_id, question_text)
        VALUES ($1, $2, $3)
        RETURNING id
    """
    
    question_id = await execute_one(
        question_query,
        request.student_id,
        request.video_id,
        request.question_text
    )
    
    answer_query = """
        INSERT INTO bot_answers (question_id, answer_text, is_cached)
        VALUES ($1, $2, $3)
    """
    
    await execute_write(
        answer_query,
        question_id["id"],
        result["answer"],
        result.get("from_cache", False)
    )
    
    return {
        "question": request.question_text,
        "answer": result["answer"],
        "from_cache": result.get("from_cache", False)
    }


# ============================================
# QUIZ SYSTEM
# ============================================

@router.get("/quizzes/available/{video_id}")
async def get_available_quiz(video_id: str):
    """
    Get available quiz for a video
    """
    
    query = """
        SELECT 
            qi.id as quiz_id,
            qi.quiz_type,
            qi.total_points,
            qi.time_limit_minutes,
            qi.is_mandatory,
            COUNT(qq.id) as question_count
        FROM quiz_instances qi
        JOIN quiz_questions qq ON qi.id = qq.quiz_instance_id
        WHERE qi.published_video_id = $1
        GROUP BY qi.id
    """
    
    quiz = await execute_one(query, video_id)
    
    if not quiz:
        return {"quiz_available": False}
    
    return {
        "quiz_available": True,
        **dict(quiz)
    }


# TODO: Add quiz submission, results, and other student endpoints

@router.get("/profile/{student_id}")
async def get_student_profile(student_id: str):
    """Get student profile"""
    query = "SELECT id, email, full_name, profile_picture_url FROM users WHERE id = $1"
    user = await execute_one(query, student_id)
    return dict(user) if user else {}


@router.get("/enrollment/{student_id}")
async def get_student_enrollment(student_id: str):
    """Return the student's active enrollment details: school, branch, class, subjects, teachers."""
    enrollment = await execute_one(
        """SELECT e.id, e.created_at as enrolled_at,
                  c.id as class_id, c.name as class_name, c.grade_level, c.section,
                  b.id as branch_id, b.name as branch_name, b.city,
                  s.id as school_id, s.name as school_name, s.address as school_address,
                  teacher.full_name as teacher_name, teacher.email as teacher_email
           FROM enrollments e
           JOIN classes c ON c.id = e.class_id
           JOIN branches b ON b.id = c.branch_id
           JOIN schools s ON s.id = b.school_id
           LEFT JOIN users teacher ON teacher.id = c.teacher_id
           WHERE e.student_id = $1 AND e.is_active = true
           ORDER BY e.created_at DESC
           LIMIT 1""",
        student_id,
    )
    if not enrollment:
        return {"enrolled": False}

    # Subject assignments for the class
    subjects = await execute_query(
        """SELECT ls.id, ls.name as subject_name, lb.title as book_title,
                  u.full_name as teacher_name
           FROM section_subjects ss
           JOIN library_subjects ls ON ls.id = ss.library_subject_id
           LEFT JOIN section_books sb ON sb.class_id = ss.class_id AND sb.library_subject_id = ss.library_subject_id
           LEFT JOIN library_books lb ON lb.id = sb.library_book_id
           LEFT JOIN teacher_class_subject_assignments tsa ON tsa.class_id = ss.class_id AND tsa.library_subject_id = ss.library_subject_id
           LEFT JOIN users u ON u.id = tsa.teacher_id
           WHERE ss.class_id = $1
           ORDER BY ls.name""",
        str(enrollment["class_id"]),
    )

    return {
        "enrolled": True,
        **dict(enrollment),
        "subjects": [dict(s) for s in subjects],
    }
