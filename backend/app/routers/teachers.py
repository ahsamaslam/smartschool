"""
Teacher Portal Routes
"""
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, date

from app.routers.auth import get_user_from_token
from app.routers.homework import ensure_homework_schema, teacher_can_manage_class
from app.utils.claude_ai import generate_teacher_exam
from app.utils.database import execute_one, execute_query, execute_write

router = APIRouter()


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class CreateClassRequest(BaseModel):
    branch_id: str
    name: str
    grade_level: str


class AddStudentRequest(BaseModel):
    class_id: str
    student_email: EmailStr
    full_name: str


class AttendanceRequest(BaseModel):
    class_id: str
    date: date
    attendance_records: List[Dict[str, bool]]  # [{"student_id": "...", "is_present": true}]


class PublishVideoRequest(BaseModel):
    class_subject_id: str
    video_template_id: str
    avatar_profile_id: Optional[str]
    published_date: date


class ExamGenerationRequest(BaseModel):
    class_id: str
    topic_ids: List[str]
    complexity: str  # easy, medium, hard
    exam_format: Dict[str, int]  # {"mcq": 10, "short": 5, "long": 3}


# ============================================
# CLASS MANAGEMENT
# ============================================

@router.get("/classes/{teacher_id}")
async def get_teacher_classes(teacher_id: str):
    """
    Classes where the user is the primary teacher or is assigned in teacher_class_assignments.
    Returns [] for admin user IDs (teachers should use a teacher account for this list).
    """
    try:
        from app.routers.homework import ensure_homework_schema

        await ensure_homework_schema()
    except Exception:
        pass

    # Check if requester is admin — not a class roster
    user_row = await execute_one("SELECT role FROM users WHERE id = $1", teacher_id)
    is_admin = user_row and user_row["role"] == "admin"

    if is_admin:
        # Admin accounts are not class-assigned; use a teacher login for My Classes.
        return []

    query = """
            SELECT
                c.id,
                c.name,
                c.grade_level,
                c.section,
                b.name as branch_name,
                s.name as school_name,
                COUNT(DISTINCT e.student_id) as student_count,
                COUNT(DISTINCT cs.subject_id) as subject_count,
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'library_subject_id', tsa.library_subject_id,
                            'subject_name', ls.name,
                            'library_book_id', tsa.library_book_id,
                            'book_title', lb.title,
                            'library_board_id', tsa.library_board_id,
                            'board_name', lbo.name
                        ) ORDER BY ls.name
                    )
                    FROM teacher_class_subject_assignments tsa
                    JOIN library_subjects ls ON ls.id = tsa.library_subject_id
                    JOIN library_books lb ON lb.id = tsa.library_book_id
                    LEFT JOIN library_boards lbo ON lbo.id = tsa.library_board_id
                    WHERE tsa.teacher_id = $1::uuid AND tsa.class_id = c.id
                ), '[]'::json) AS section_assignments
            FROM classes c
            JOIN branches b ON c.branch_id = b.id
            JOIN schools s ON b.school_id = s.id
            LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
            LEFT JOIN class_subjects cs ON c.id = cs.class_id
            WHERE c.teacher_id = $1::uuid
               OR EXISTS (
                   SELECT 1 FROM teacher_class_assignments tca
                   WHERE tca.class_id = c.id AND tca.teacher_id = $1::uuid
               )
            GROUP BY c.id, c.name, c.grade_level, c.section, b.name, s.name
            ORDER BY c.name
        """
    classes = await execute_query(query, teacher_id)
    return [dict(cls) for cls in classes]


@router.get("/classes/{class_id}/teaching-assignments")
async def get_class_teaching_assignments(
    class_id: str,
    for_teacher_id: Optional[str] = None,
    user: dict = Depends(get_user_from_token),
):
    """Subject + book (+ board) assigned to the teacher for this section."""
    await ensure_homework_schema()
    role = user.get("role")
    uid = str(user["user_id"])
    if role == "admin":
        tid = for_teacher_id or uid
    else:
        tid = uid
        if for_teacher_id and str(for_teacher_id) != uid:
            raise HTTPException(status_code=403, detail="Forbidden")

    if role != "admin":
        if not await teacher_can_manage_class(uid, class_id):
            raise HTTPException(status_code=403, detail="Forbidden")

    rows = await execute_query(
        """
        SELECT
            t.library_subject_id,
            ls.name AS subject_name,
            t.library_book_id,
            lb.title AS book_title,
            t.library_board_id,
            lbo.name AS board_name
        FROM teacher_class_subject_assignments t
        JOIN library_subjects ls ON ls.id = t.library_subject_id
        JOIN library_books lb ON lb.id = t.library_book_id
        LEFT JOIN library_boards lbo ON lbo.id = t.library_board_id
        WHERE t.teacher_id = $1::uuid AND t.class_id = $2::uuid
        ORDER BY ls.name, lb.title
        """,
        tid,
        class_id,
    )
    return {"assignments": [dict(r) for r in rows]}


@router.post("/classes")
async def create_class(teacher_id: str, class_data: CreateClassRequest):
    """
    Create new class
    """
    
    query = """
        INSERT INTO classes (branch_id, name, grade_level, teacher_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, grade_level
    """
    
    new_class = await execute_one(
        query,
        class_data.branch_id,
        class_data.name,
        class_data.grade_level,
        teacher_id
    )
    
    return {
        "message": "Class created successfully",
        "class": dict(new_class)
    }


@router.post("/classes/{class_id}/students")
async def add_student_to_class(class_id: str, student_data: AddStudentRequest):
    """
    Add student to class
    """
    
    # First, check if student exists
    student_query = "SELECT id FROM users WHERE email = $1"
    existing_student = await execute_one(student_query, student_data.student_email)
    
    if existing_student:
        student_id = existing_student["id"]
    else:
        # Create new student account
        create_query = """
            INSERT INTO users (email, full_name, role)
            VALUES ($1, $2, 'student')
            RETURNING id
        """
        new_student = await execute_one(
            create_query,
            student_data.student_email,
            student_data.full_name
        )
        student_id = new_student["id"]
    
    # Enroll student in class
    enroll_query = """
        INSERT INTO enrollments (student_id, class_id)
        VALUES ($1, $2)
        ON CONFLICT (student_id, class_id) DO NOTHING
        RETURNING id
    """
    
    enrollment = await execute_one(enroll_query, student_id, class_id)
    
    return {
        "message": "Student added successfully",
        "student_id": str(student_id),
        "enrolled": enrollment is not None
    }


@router.get("/classes/{class_id}/students")
async def get_class_students(class_id: str):
    """
    Get all students in a class with performance metrics
    """
    
    query = """
        SELECT 
            u.id,
            u.email,
            u.full_name,
            u.profile_picture_url,
            e.enrolled_at,
            sp.video_completion_rate,
            sp.attendance_rate,
            sp.average_quiz_score,
            sp.highest_quiz_score,
            sp.overall_score,
            sp.ranking,
            hw.homework_avg_pct AS homework_avg
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        LEFT JOIN student_performance sp ON (
            u.id = sp.student_id 
            AND e.class_id = sp.class_id
            AND sp.date = CURRENT_DATE
        )
        LEFT JOIN (
            SELECT
                hs.student_id,
                AVG(
                    CASE
                        WHEN h.total_marks IS NOT NULL AND h.total_marks > 0 AND hs.marks_awarded IS NOT NULL
                        THEN (hs.marks_awarded * 100.0 / h.total_marks)
                        ELSE NULL
                    END
                ) AS homework_avg_pct
            FROM homework_submissions hs
            INNER JOIN homeworks h ON h.id = hs.homework_id AND h.class_id = $1::uuid
            WHERE hs.submission_status IN ('reviewed', 'returned')
            GROUP BY hs.student_id
        ) hw ON hw.student_id = u.id
        WHERE e.class_id = $1 AND e.is_active = true
        ORDER BY sp.ranking NULLS LAST, u.full_name
    """
    
    students = await execute_query(query, class_id)
    return [dict(student) for student in students]


@router.get("/students/{student_id}/performance")
async def get_student_detail(student_id: str, class_id: str):
    """
    Get detailed performance breakdown for a student
    """
    
    # Topic-wise performance
    topic_query = """
        SELECT 
            t.title as topic_name,
            s.name as subject_name,
            vws.completion_percentage as video_completion,
            AVG(qa.score) as average_quiz_score,
            MAX(qa.score) as highest_quiz_score,
            COUNT(qa.id) as quiz_attempts,
            pv.published_date
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN video_templates vt ON t.id = vt.topic_id
        JOIN published_videos pv ON vt.id = pv.video_template_id
        LEFT JOIN video_watch_sessions vws ON (
            pv.id = vws.published_video_id 
            AND vws.student_id = $1
        )
        LEFT JOIN quiz_instances qi ON pv.id = qi.published_video_id
        LEFT JOIN quiz_attempts qa ON (
            qi.id = qa.quiz_instance_id 
            AND qa.student_id = $1
            AND qa.is_completed = true
        )
        JOIN class_subjects cs ON s.id = cs.subject_id
        WHERE cs.class_id = $2
        GROUP BY t.id, t.title, s.name, vws.completion_percentage, pv.published_date
        ORDER BY pv.published_date DESC
    """
    
    topic_performance = await execute_query(topic_query, student_id, class_id)
    
    # Attendance summary
    attendance_query = """
        SELECT 
            COUNT(*) as total_days,
            SUM(CASE WHEN is_present THEN 1 ELSE 0 END) as present_days
        FROM attendance
        WHERE student_id = $1 AND class_id = $2
    """
    
    attendance = await execute_one(attendance_query, student_id, class_id)
    
    return {
        "student_id": student_id,
        "topic_performance": [dict(tp) for tp in topic_performance],
        "attendance": dict(attendance)
    }


@router.post("/students/{student_id}/password-reset")
async def send_password_reset(student_id: str):
    """
    Generate password reset link for student
    """
    
    import uuid
    from datetime import timedelta
    
    # Get student email
    user = await execute_one("SELECT email FROM users WHERE id = $1", student_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(hours=24)
    
    query = """
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING token
    """
    
    token_record = await execute_one(query, student_id, reset_token, expires_at)
    
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    # TODO: Send email in production
    
    return {
        "message": "Password reset link generated",
        "email": user["email"],
        "reset_link": reset_link,
        "token": reset_token  # Remove in production
    }


# ============================================
# ATTENDANCE
# ============================================

@router.post("/attendance")
async def mark_attendance(teacher_id: str, attendance: AttendanceRequest):
    """
    Mark attendance for a class
    """
    
    records_added = 0
    
    for record in attendance.attendance_records:
        query = """
            INSERT INTO attendance (student_id, class_id, date, is_present, marked_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, class_id, date) 
            DO UPDATE SET is_present = EXCLUDED.is_present, marked_by = EXCLUDED.marked_by
        """
        
        await execute_write(
            query,
            record["student_id"],
            attendance.class_id,
            attendance.date,
            record["is_present"],
            teacher_id
        )
        records_added += 1
    
    return {
        "message": "Attendance marked successfully",
        "records_updated": records_added,
        "date": attendance.date.isoformat()
    }


@router.get("/attendance/{class_id}")
async def get_attendance(class_id: str, date_from: date, date_to: date):
    """
    Get attendance records for a class
    """
    
    query = """
        SELECT 
            a.date,
            u.id as student_id,
            u.full_name,
            a.is_present
        FROM attendance a
        JOIN users u ON a.student_id = u.id
        WHERE a.class_id = $1 
            AND a.date BETWEEN $2 AND $3
        ORDER BY a.date DESC, u.full_name
    """
    
    records = await execute_query(query, class_id, date_from, date_to)
    return [dict(record) for record in records]


# ============================================
# VIDEO PUBLISHING
# ============================================

@router.get("/videos/templates")
async def get_video_templates():
    """
    Get all available video templates
    """
    
    query = """
        SELECT 
            vt.id,
            vt.title,
            vt.video_url,
            vt.duration_seconds,
            t.title as topic_title,
            s.name as subject_name
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        ORDER BY s.name, t.order_index
    """
    
    templates = await execute_query(query)
    return [dict(template) for template in templates]


@router.get("/avatars/{teacher_id}")
async def get_teacher_avatars(teacher_id: str):
    """
    Get avatar profiles for teacher
    """
    
    query = """
        SELECT id, avatar_name, avatar_image_url, voice_profile
        FROM avatar_profiles
        WHERE teacher_id = $1
        ORDER BY created_at DESC
    """
    
    avatars = await execute_query(query, teacher_id)
    return [dict(avatar) for avatar in avatars]


@router.post("/videos/publish")
async def publish_video(teacher_id: str, video_data: PublishVideoRequest):
    """
    Publish video for students to view
    """
    
    # For now, final_video_url is same as template (in production, this would be processed)
    template = await execute_one(
        "SELECT video_url FROM video_templates WHERE id = $1",
        video_data.video_template_id
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")
    
    query = """
        INSERT INTO published_videos (
            video_template_id,
            class_subject_id,
            avatar_profile_id,
            final_video_url,
            published_date
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    """
    
    published = await execute_one(
        query,
        video_data.video_template_id,
        video_data.class_subject_id,
        video_data.avatar_profile_id,
        template["video_url"],  # In production: processed video URL
        video_data.published_date
    )
    
    return {
        "message": "Video published successfully",
        "published_video_id": str(published["id"])
    }


# ============================================
# AVATAR PHOTO UPLOAD + VIDEO REGENERATION
# ============================================

@router.post("/videos/{template_id}/regenerate-avatar")
async def regenerate_avatar_with_photo(
    template_id: str,
    teacher_id: str,
    photo: UploadFile = File(...),
):
    """
    Teacher uploads their own photo → Wav2Lip regenerates the avatar video for this topic.
    Falls back to the default face image if no photo is uploaded.
    """
    import os, shutil
    from app.utils.wav2lip_client import generate_wav2lip_avatar

    template = await execute_one(
        "SELECT id, topic_id, audio_url, avatar_url FROM video_templates WHERE id = $1",
        template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    audio_url = template["audio_url"]
    if not audio_url:
        raise HTTPException(
            status_code=400,
            detail="Audio not generated yet. Ask admin to generate the script first."
        )

    # Validate file is an image
    if not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPG/PNG)")

    # Save uploaded photo as teacher-specific face image
    faces_dir = os.path.join("static", "teacher_faces")
    os.makedirs(faces_dir, exist_ok=True)
    ext = os.path.splitext(photo.filename)[1] or ".jpg"
    face_path = os.path.join(faces_dir, f"teacher_{teacher_id}{ext}")
    with open(face_path, "wb") as f:
        shutil.copyfileobj(photo.file, f)

    # Store teacher face URL in DB (users table)
    face_url = f"/static/teacher_faces/teacher_{teacher_id}{ext}"
    await execute_write(
        "UPDATE users SET profile_picture = $1 WHERE id = $2",
        face_url, teacher_id,
    )

    audio_local = audio_url.lstrip("/")

    try:
        avatar_url = await generate_wav2lip_avatar(
            audio_local_path=audio_local,
            topic_id=str(template["topic_id"]),
            face_path=face_path,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Avatar generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET avatar_url = $1, status = 'avatar_ready' WHERE id = $2",
        avatar_url, template_id,
    )

    return {
        "avatar_url": avatar_url,
        "face_url": face_url,
        "template_id": template_id,
        "message": "Avatar video regenerated with your photo",
    }


@router.get("/videos/templates")
async def get_video_templates_for_teacher():
    """Return published video templates with avatar status, for teacher avatar management."""
    templates = await execute_query(
        """
        SELECT vt.id, t.title as topic_title, vt.audio_url,
               vt.whiteboard_url, vt.avatar_url, vt.final_video_url, vt.status,
               s.name as subject_name
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        ORDER BY t.title
        """
    )
    return {"templates": [dict(r) for r in templates]}


# ============================================
# EXAM GENERATION
# ============================================

@router.post("/exams/generate")
async def generate_exam(teacher_id: str, exam_request: ExamGenerationRequest):
    """
    Generate printable exam using Claude AI
    """
    
    # Get topic titles
    topic_query = """
        SELECT t.title, s.name as subject_name
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.id = ANY($1)
    """
    
    topics = await execute_query(topic_query, exam_request.topic_ids)
    
    if not topics:
        raise HTTPException(status_code=404, detail="Topics not found")
    
    topic_titles = [t["title"] for t in topics]
    subject_name = topics[0]["subject_name"]
    
    # Get class name
    class_info = await execute_one(
        "SELECT name FROM classes WHERE id = $1",
        exam_request.class_id
    )
    
    # Generate exam content
    exam_content = await generate_teacher_exam(
        topics=topic_titles,
        subject_name=subject_name,
        difficulty=exam_request.complexity,
        exam_format=exam_request.exam_format,
        class_name=class_info["name"]
    )
    
    # Save to database
    save_query = """
        INSERT INTO teacher_exams (
            teacher_id,
            class_id,
            title,
            topics,
            complexity,
            exam_format,
            generated_content
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    """
    
    import json
    
    exam_record = await execute_one(
        save_query,
        teacher_id,
        exam_request.class_id,
        f"{subject_name} Exam - {datetime.now().strftime('%Y-%m-%d')}",
        exam_request.topic_ids,
        exam_request.complexity,
        json.dumps(exam_request.exam_format),
        exam_content
    )
    
    return {
        "exam_id": str(exam_record["id"]),
        "content": exam_content,
        "message": "Exam generated successfully"
    }


@router.get("/exams/{exam_id}")
async def get_exam(exam_id: str):
    """
    Get generated exam content
    """
    
    query = "SELECT * FROM teacher_exams WHERE id = $1"
    exam = await execute_one(query, exam_id)
    
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    return dict(exam)


# ============================================
# REPORTS
# ============================================

@router.get("/reports/class/{class_id}")
async def get_class_report(
    class_id: str,
    period: str = "weekly"  # daily, weekly, monthly, quarterly, yearly
):
    """
    Get performance reports for a class
    """
    
    # Determine date range based on period
    from datetime import timedelta
    
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365
    }
    
    days = period_days.get(period, 7)
    date_from = datetime.now().date() - timedelta(days=days)
    
    query = """
        SELECT 
            u.id as student_id,
            u.full_name,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score
        FROM student_performance sp
        JOIN users u ON sp.student_id = u.id
        WHERE sp.class_id = $1 AND sp.date >= $2
        GROUP BY u.id, u.full_name
        ORDER BY avg_overall_score DESC NULLS LAST
    """
    
    report = await execute_query(query, class_id, date_from)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": datetime.now().date().isoformat(),
        "students": [dict(r) for r in report]
    }


# ============================================
# Q&A REVIEW
# ============================================

@router.get("/qa/questions/{class_id}")
async def get_student_questions(class_id: str):
    """
    Get all questions asked by students in class videos
    """
    
    query = """
        SELECT 
            sq.id,
            sq.question_text,
            sq.asked_at,
            u.full_name as student_name,
            ba.answer_text,
            t.title as topic_title
        FROM student_questions sq
        JOIN users u ON sq.student_id = u.id
        JOIN published_videos pv ON sq.published_video_id = pv.id
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN class_subjects cs ON pv.class_subject_id = cs.class_id
        LEFT JOIN bot_answers ba ON sq.id = ba.question_id
        WHERE cs.class_id = $1
        ORDER BY sq.asked_at DESC
        LIMIT 100
    """
    
    questions = await execute_query(query, class_id)
    return [dict(q) for q in questions]
