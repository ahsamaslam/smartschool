"""
Student Portal Routes
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.claude_ai import answer_student_question
from app.utils.cache import buffer_video_event

router = APIRouter()


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

# Placeholder for remaining endpoints
@router.get("/profile/{student_id}")
async def get_student_profile(student_id: str):
    """Get student profile"""
    query = "SELECT id, email, full_name, profile_picture_url FROM users WHERE id = $1"
    user = await execute_one(query, student_id)
    return dict(user) if user else {}
