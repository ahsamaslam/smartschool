"""
Teacher Portal Routes
"""
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, date
import uuid
import json as _json
import os

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


class AttendanceRecord(BaseModel):
    student_id: str
    is_present: bool


class AttendanceRequest(BaseModel):
    class_id: str
    date: date
    attendance_records: List[AttendanceRecord]


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
# TEACHER DASHBOARD
# ============================================

@router.get("/dashboard/{teacher_id}")
async def get_teacher_dashboard(teacher_id: str):
    """Aggregated dashboard stats for a teacher."""
    await ensure_homework_schema()

    # Classes + student counts (same logic as get_teacher_classes)
    classes = await execute_query(
        """
        SELECT c.id, c.name, c.grade_level, c.section,
               b.name AS branch_name, sc.name AS school_name,
               COUNT(DISTINCT e.student_id) AS student_count
        FROM classes c
        JOIN branches b ON b.id = c.branch_id
        JOIN schools sc ON sc.id = b.school_id
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
        WHERE c.teacher_id = $1::uuid
           OR EXISTS (
               SELECT 1 FROM teacher_class_assignments tca
               WHERE tca.class_id = c.id AND tca.teacher_id = $1::uuid
           )
           OR EXISTS (
               SELECT 1 FROM teacher_class_subject_assignments tcsa
               WHERE tcsa.class_id = c.id AND tcsa.teacher_id = $1::uuid
           )
        GROUP BY c.id, c.name, c.grade_level, c.section, b.name, sc.name
        ORDER BY c.name
        """,
        teacher_id,
    )

    class_ids = [str(r["id"]) for r in classes]
    total_students = sum(r["student_count"] or 0 for r in classes)

    # Pending homework submissions (submitted, needs review)
    pending_review = 0
    if class_ids:
        row = await execute_one(
            """
            SELECT COUNT(*) AS cnt
            FROM homework_submissions hs
            JOIN homeworks h ON h.id = hs.homework_id
            WHERE h.teacher_id = $1::uuid
              AND hs.submission_status IN ('submitted', 'late')
            """,
            teacher_id,
        )
        pending_review = int(row["cnt"]) if row else 0

    # Published homeworks count
    hw_published = 0
    row2 = await execute_one(
        "SELECT COUNT(*) AS cnt FROM homeworks WHERE teacher_id = $1::uuid AND status = 'published'",
        teacher_id,
    )
    hw_published = int(row2["cnt"]) if row2 else 0

    # Draft homeworks
    hw_draft = 0
    row3 = await execute_one(
        "SELECT COUNT(*) AS cnt FROM homeworks WHERE teacher_id = $1::uuid AND status = 'draft'",
        teacher_id,
    )
    hw_draft = int(row3["cnt"]) if row3 else 0

    # Recent homework submissions (last 5)
    recent_submissions = await execute_query(
        """
        SELECT hs.id, hs.submission_status, hs.submitted_at, hs.is_late,
               u.full_name AS student_name,
               h.title AS homework_title, h.id AS homework_id, h.class_id
        FROM homework_submissions hs
        JOIN homeworks h ON h.id = hs.homework_id
        JOIN users u ON u.id = hs.student_id
        WHERE h.teacher_id = $1::uuid AND hs.submission_status IN ('submitted', 'late')
        ORDER BY hs.submitted_at DESC
        LIMIT 5
        """,
        teacher_id,
    )

    # Attendance taken today
    today = datetime.utcnow().date()
    att_today = await execute_query(
        """
        SELECT DISTINCT class_id FROM attendance
        WHERE marked_by = $1::uuid AND date = $2
        """,
        teacher_id,
        today,
    ) if class_ids else []
    classes_with_attendance_today = {str(r["class_id"]) for r in att_today}

    classes_out = []
    for c in classes:
        d = dict(c)
        d["attendance_taken_today"] = str(c["id"]) in classes_with_attendance_today
        classes_out.append(d)

    return {
        "stats": {
            "total_classes": len(classes_out),
            "total_students": total_students,
            "pending_review": pending_review,
            "hw_published": hw_published,
            "hw_draft": hw_draft,
        },
        "classes": classes_out,
        "recent_submissions": [dict(r) for r in recent_submissions],
    }


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
               OR EXISTS (
                   SELECT 1 FROM teacher_class_subject_assignments tcsa
                   WHERE tcsa.class_id = c.id AND tcsa.teacher_id = $1::uuid
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
    if role in ("admin", "super_admin"):
        tid = for_teacher_id or uid
    else:
        tid = uid
        if for_teacher_id and str(for_teacher_id) != uid:
            raise HTTPException(status_code=403, detail="Forbidden")

    if role not in ("admin", "super_admin"):
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
    Get all students in a class with performance metrics and class info
    """
    await ensure_attendance_schema()
    query = """
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.profile_picture_url,
            c.name AS class_name,
            c.section,
            e.enrolled_at,
            sp.video_completion_rate,
            COALESCE(att.attendance_rate, sp.attendance_rate, 0) AS attendance_rate,
            sp.average_quiz_score,
            sp.highest_quiz_score,
            sp.overall_score,
            sp.ranking,
            hw.homework_avg_pct AS homework_avg
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN classes c ON e.class_id = c.id
        LEFT JOIN student_performance sp ON (
            u.id = sp.student_id
            AND e.class_id = sp.class_id
            AND sp.date = CURRENT_DATE
        )
        LEFT JOIN (
            SELECT
                student_id,
                class_id,
                ROUND(
                    100.0 * SUM(CASE WHEN is_present THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0),
                    2
                ) AS attendance_rate
            FROM attendance
            GROUP BY student_id, class_id
        ) att ON att.student_id = u.id AND att.class_id = e.class_id
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

async def ensure_attendance_schema():
    """Ensure attendance table supports upsert + percentage analytics."""
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
        ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS marked_by UUID
        """
    )
    await execute_write(
        """
        ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        """
    )
    await execute_write(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_uq
        ON attendance(student_id, class_id, date)
        """
    )
    await execute_write(
        """
        CREATE INDEX IF NOT EXISTS attendance_class_date_idx
        ON attendance(class_id, date DESC)
        """
    )


@router.post("/attendance")
async def mark_attendance(
    teacher_id: str,
    attendance: AttendanceRequest,
    allow_edit: bool = False,
):
    """
    Mark attendance for a class
    """
    await ensure_attendance_schema()
    existing_count_row = await execute_one(
        """
        SELECT COUNT(*)::int AS count
        FROM attendance
        WHERE class_id = $1::uuid AND date = $2
        """,
        attendance.class_id,
        attendance.date,
    )
    existing_count = int(existing_count_row["count"] or 0) if existing_count_row else 0

    if existing_count > 0 and not allow_edit:
        raise HTTPException(
            status_code=409,
            detail="Attendance already saved for this date. Click edit to modify it.",
        )

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
            record.student_id,
            attendance.class_id,
            attendance.date,
            record.is_present,
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
    await ensure_attendance_schema()
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


# ============================================
# TEACHER CURRICULUM (My Books + Topics)
# ============================================

@router.get("/my-curriculum")
async def get_my_curriculum(current_user: dict = Depends(get_user_from_token)):
    """
    Returns all classes+subjects+books assigned to this teacher.
    Groups: class → subject → book.
    """
    teacher_id = current_user.get("user_id")

    rows = await execute_query(
        """
        SELECT
            c.id as class_id, c.name as class_name, c.grade_level, c.section,
            ls.id as subject_id, ls.name as subject_name,
            lb.id as book_id, lb.title as book_title, lb.author as book_author,
            lbo.id as board_id, lbo.name as board_name,
            (SELECT COUNT(*) FROM library_chapters lch WHERE lch.book_id = lb.id) as chapter_count,
            (SELECT COUNT(*) FROM library_topics lt2
                JOIN library_chapters lch2 ON lch2.id = lt2.chapter_id
                WHERE lch2.book_id = lb.id) as topic_count
        FROM teacher_class_subject_assignments tsa
        JOIN classes c ON c.id = tsa.class_id
        JOIN library_subjects ls ON ls.id = tsa.library_subject_id
        JOIN library_books lb ON lb.id = tsa.library_book_id
        LEFT JOIN library_boards lbo ON lbo.id = tsa.library_board_id
        WHERE tsa.teacher_id = $1::uuid
        ORDER BY c.name, ls.name, lb.title
        """,
        teacher_id,
    )

    # Build nested structure: class → subject → books list
    classes: dict = {}
    for r in rows:
        cid = r["class_id"]
        sid = r["subject_id"]
        if cid not in classes:
            classes[cid] = {
                "class_id": cid,
                "class_name": r["class_name"],
                "grade_level": r["grade_level"],
                "section": r["section"],
                "subjects": {},
            }
        if sid not in classes[cid]["subjects"]:
            classes[cid]["subjects"][sid] = {
                "subject_id": sid,
                "subject_name": r["subject_name"],
                "board_id": r["board_id"],
                "board_name": r["board_name"],
                "books": [],
            }
        classes[cid]["subjects"][sid]["books"].append({
            "book_id": r["book_id"],
            "book_title": r["book_title"],
            "book_author": r["book_author"],
            "chapter_count": r["chapter_count"],
            "topic_count": r["topic_count"],
        })

    result = []
    for cls in classes.values():
        cls["subjects"] = list(cls["subjects"].values())
        result.append(cls)

    return result


@router.get("/books/{book_id}")
async def get_teacher_book(book_id: str, current_user: dict = Depends(get_user_from_token)):
    """
    Returns a book with chapters+topics for this teacher.
    Validates that the teacher has an assignment for this book.
    """
    teacher_id = current_user.get("user_id")
    role = current_user.get("role")

    if role not in ("admin", "super_admin"):
        assignment = await execute_one(
            "SELECT id FROM teacher_class_subject_assignments WHERE teacher_id = $1::uuid AND library_book_id = $2::uuid LIMIT 1",
            teacher_id, book_id,
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="You are not assigned to this book")

    book = await execute_one(
        "SELECT id, title, author, description FROM library_books WHERE id = $1::uuid",
        book_id,
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    chapters = await execute_query(
        """SELECT id, title, order_index FROM library_chapters WHERE book_id = $1 ORDER BY order_index""",
        book_id,
    )
    chapter_list = []
    for ch in chapters:
        topics = await execute_query(
            """SELECT id, title, order_index,
                      slides_json IS NOT NULL AND slides_json::text != 'null' as has_slides
               FROM library_topics WHERE chapter_id = $1 ORDER BY order_index""",
            ch["id"],
        )
        chapter_list.append({**dict(ch), "topics": [dict(t) for t in topics]})

    return {**dict(book), "chapters": chapter_list}


# ── Slide Generation ──────────────────────────────────────────────────────────

@router.post("/generate-slides")
async def teacher_generate_slides(
    body: dict,
    current_user: dict = Depends(get_user_from_token),
):
    """Generate AI slide deck for teacher (no admin role required)."""
    from app.schemas.slides_ai import GenerateSlidesRequest
    from app.utils.ai_slide_deck import generate_slide_deck
    req = GenerateSlidesRequest(**body)
    return await generate_slide_deck(req)


# ============================================
# TEACHER-SPECIFIC TOPIC CONTENT (slides + lectures)
# Each teacher owns their own copy per library topic.
# ============================================

class TeacherSlideSaveRequest(BaseModel):
    slides: List[Dict]
    slide_theme: Optional[str] = None
    content_body: Optional[str] = None


def _ttc_row_json(row: dict) -> dict:
    """Normalize asyncpg Record → JSON-safe dict for teacher_topic_content."""
    out = dict(row)
    for k, v in list(out.items()):
        if isinstance(v, uuid.UUID):
            out[k] = str(v)
        elif hasattr(v, "isoformat"):
            try:
                out[k] = v.isoformat()
            except Exception:
                out[k] = str(v)
    return out


async def _ensure_teacher_content_table():
    """Ensure teacher_topic_content table exists (delegates to library ensure)."""
    from app.routers.library import ensure_library_tables
    await ensure_library_tables()


@router.get("/topics/{topic_id}/my-content")
async def get_my_topic_content(
    topic_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Get the calling teacher's slides + lecture for a library topic.
    Returns null-field structure if the teacher has never saved anything (empty slate)."""
    await _ensure_teacher_content_table()
    teacher_id = str(current_user["user_id"])
    topic_id = (topic_id or "").strip()

    topic = await execute_one(
        "SELECT id, title, content_body FROM library_topics WHERE id = $1::uuid",
        topic_id,
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    row = await execute_one(
        """
        SELECT * FROM teacher_topic_content
        WHERE teacher_id = $1::uuid AND library_topic_id = $2::uuid
        """,
        teacher_id,
        topic_id,
    )

    if not row:
        return {
            "data": {
                "id": None,
                "teacher_id": teacher_id,
                "library_topic_id": topic_id,
                "topic_title": topic["title"],
                "slides_json": None,
                "slide_theme": None,
                "lecture_video_url": None,
                "lecture_metadata_json": None,
                "lecture_saved_at": None,
                "lecture_duration_seconds": None,
            }
        }

    out = _ttc_row_json(dict(row))
    out["topic_title"] = topic["title"]
    return {"data": out}


@router.put("/topics/{topic_id}/slides")
async def save_my_topic_slides(
    topic_id: str,
    body: TeacherSlideSaveRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Upsert this teacher's slide deck for a library topic."""
    await _ensure_teacher_content_table()
    teacher_id = str(current_user["user_id"])
    topic_id = (topic_id or "").strip()

    topic = await execute_one(
        "SELECT id FROM library_topics WHERE id = $1::uuid", topic_id
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    try:
        slides_str = _json.dumps(body.slides, ensure_ascii=False)
    except Exception:
        slides_str = "[]"
    theme = (body.slide_theme or "")[:160] or None

    row = await execute_one(
        """
        INSERT INTO teacher_topic_content
            (teacher_id, library_topic_id, slides_json, slide_theme, updated_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, NOW())
        ON CONFLICT (teacher_id, library_topic_id) DO UPDATE
            SET slides_json = EXCLUDED.slides_json,
                slide_theme = EXCLUDED.slide_theme,
                updated_at  = NOW()
        RETURNING *
        """,
        teacher_id, topic_id, slides_str, theme,
    )
    return {"data": _ttc_row_json(dict(row))}


@router.post("/topics/{topic_id}/lecture")
async def upload_my_topic_lecture(
    topic_id: str,
    video: UploadFile = File(...),
    quality: str = Form(default="720p"),
    duration_seconds: str = Form(default="0"),
    has_camera: str = Form(default="false"),
    has_microphone: str = Form(default="false"),
    slide_timestamps_json: Optional[str] = Form(default=None),
    transcript: Optional[str] = Form(default=None),
    captions_json: Optional[str] = Form(default=None),
    current_user: dict = Depends(get_user_from_token),
):
    """Upload/replace this teacher's lecture video for a library topic."""
    await _ensure_teacher_content_table()
    teacher_id = str(current_user["user_id"])
    topic_id = (topic_id or "").strip()

    topic = await execute_one(
        "SELECT id FROM library_topics WHERE id = $1::uuid", topic_id
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Teacher must have their own slides saved first
    teacher_row = await execute_one(
        """
        SELECT id, slides_json, lecture_video_url FROM teacher_topic_content
        WHERE teacher_id = $1::uuid AND library_topic_id = $2::uuid
        """,
        teacher_id, topic_id,
    )
    if not teacher_row or not (teacher_row.get("slides_json") or "").strip().replace("[]", ""):
        raise HTTPException(
            status_code=400,
            detail="Cannot save lecture: save your slides for this topic first",
        )

    filename = (video.filename or "").lower()
    if not filename.endswith((".webm", ".mp4", ".mov", ".mkv")):
        raise HTTPException(status_code=400, detail="Unsupported video format")

    content = await video.read()
    if len(content) > 800 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Lecture file too large (max 800 MB)")
    if not content:
        raise HTTPException(status_code=400, detail="Empty video upload")

    lectures_dir = os.path.join("static", "lectures")
    os.makedirs(lectures_dir, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ".webm"
    # Teacher-scoped filename prevents collisions between teachers on same topic
    safe_name = f"teacher_{teacher_id[:8]}_{topic_id[:8]}_{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(lectures_dir, safe_name)
    with open(abs_path, "wb") as f:
        f.write(content)
    video_url = f"/static/lectures/{safe_name}"

    # Parse optional form fields
    def _flt(v, d=0.0):
        try:
            return max(0.0, float(str(v or "").strip()))
        except (TypeError, ValueError):
            return d

    def _fbool(v):
        return str(v or "").strip().lower() in ("1", "true", "yes", "on")

    slide_timestamps = []
    if slide_timestamps_json:
        try:
            p = _json.loads(slide_timestamps_json)
            if isinstance(p, list):
                slide_timestamps = p
        except Exception:
            pass

    captions = []
    if captions_json:
        try:
            p = _json.loads(captions_json)
            if isinstance(p, list):
                captions = p
        except Exception:
            pass

    dur_form = _flt(duration_seconds)
    dur_ts = max((_flt(item.get("time")) for item in slide_timestamps if isinstance(item, dict)), default=0.0)
    stored_dur = max(dur_form, dur_ts)

    lecture_metadata = {
        "lectureId": uuid.uuid4().hex,
        "topicId": topic_id,
        "videoUrl": video_url,
        "duration": stored_dur,
        "quality": str(quality or "720p"),
        "hasCamera": _fbool(has_camera),
        "hasMicrophone": _fbool(has_microphone),
        "slideTimestamps": slide_timestamps,
        "transcript": transcript or "",
        "captions": captions,
        "createdBy": teacher_id,
    }

    # Delete old lecture file if replacing
    if teacher_row and teacher_row.get("lecture_video_url"):
        from app.routers.library import _remove_local_static_file
        _remove_local_static_file(teacher_row["lecture_video_url"])

    dur_col = stored_dur if stored_dur > 0 else None
    row = await execute_one(
        """
        INSERT INTO teacher_topic_content
            (teacher_id, library_topic_id, lecture_video_url, lecture_metadata_json,
             lecture_saved_at, lecture_duration_seconds, updated_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, NOW(), $5, NOW())
        ON CONFLICT (teacher_id, library_topic_id) DO UPDATE
            SET lecture_video_url        = EXCLUDED.lecture_video_url,
                lecture_metadata_json    = EXCLUDED.lecture_metadata_json,
                lecture_saved_at         = NOW(),
                lecture_duration_seconds = EXCLUDED.lecture_duration_seconds,
                updated_at               = NOW()
        RETURNING *
        """,
        teacher_id, topic_id, video_url,
        _json.dumps(lecture_metadata, ensure_ascii=False),
        dur_col,
    )
    return {"data": _ttc_row_json(dict(row))}


@router.delete("/topics/{topic_id}/lecture")
async def delete_my_topic_lecture(
    topic_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Delete this teacher's lecture video for a topic (slides remain intact)."""
    await _ensure_teacher_content_table()
    teacher_id = str(current_user["user_id"])
    topic_id = (topic_id or "").strip()

    row = await execute_one(
        """
        SELECT id, lecture_video_url FROM teacher_topic_content
        WHERE teacher_id = $1::uuid AND library_topic_id = $2::uuid
        """,
        teacher_id, topic_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="No content found for this topic")

    if row.get("lecture_video_url"):
        from app.routers.library import _remove_local_static_file
        _remove_local_static_file(row["lecture_video_url"])

    updated = await execute_one(
        """
        UPDATE teacher_topic_content
        SET lecture_video_url        = NULL,
            lecture_metadata_json    = NULL,
            lecture_saved_at         = NULL,
            lecture_duration_seconds = NULL,
            updated_at               = NOW()
        WHERE teacher_id = $1::uuid AND library_topic_id = $2::uuid
        RETURNING *
        """,
        teacher_id, topic_id,
    )
    return {"data": _ttc_row_json(dict(updated))}


@router.get("/my-lectures")
async def list_my_lectures(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_user_from_token),
):
    """Paginated list of this teacher's recorded lectures with full hierarchy metadata."""
    await _ensure_teacher_content_table()
    teacher_id = str(current_user["user_id"])
    lim = max(1, min(int(limit or 50), 100))
    off = max(0, int(offset or 0))
    search = (q or "").strip() or None

    rows = await execute_query(
        """
        SELECT
            ttc.id              AS content_id,
            ttc.library_topic_id AS topic_id,
            lt.title            AS topic_title,
            ttc.lecture_video_url,
            ttc.lecture_metadata_json,
            ttc.lecture_duration_seconds,
            ttc.lecture_saved_at,
            ch.id               AS chapter_id,
            ch.chapter_number,
            ch.title            AS chapter_title,
            b.id                AS book_id,
            b.title             AS book_title,
            b.board_name        AS book_board_name,
            lc.id               AS library_class_id,
            lc.name             AS library_class_name,
            s.id                AS subject_id,
            s.name              AS subject_name,
            COUNT(*) OVER()     AS total_count
        FROM teacher_topic_content ttc
        JOIN library_topics lt   ON lt.id = ttc.library_topic_id
        LEFT JOIN library_chapters ch ON ch.id = lt.chapter_id
        LEFT JOIN library_books b     ON b.id  = ch.book_id
        LEFT JOIN library_classes lc  ON lc.id = b.class_id
        LEFT JOIN library_subjects s  ON s.id  = b.subject_id
        WHERE ttc.teacher_id = $1::uuid
          AND ttc.lecture_video_url IS NOT NULL
          AND trim(ttc.lecture_video_url) <> ''
          AND ($2::text IS NULL
               OR lt.title   ILIKE ('%' || $2 || '%')
               OR COALESCE(ch.title, '') ILIKE ('%' || $2 || '%')
               OR COALESCE(b.title,  '') ILIKE ('%' || $2 || '%')
               OR COALESCE(s.name,   '') ILIKE ('%' || $2 || '%')
               OR COALESCE(lc.name,  '') ILIKE ('%' || $2 || '%'))
        ORDER BY ttc.lecture_saved_at DESC NULLS LAST
        LIMIT $3 OFFSET $4
        """,
        teacher_id, search, lim, off,
    )

    total = int(rows[0]["total_count"]) if rows else 0
    items = [_ttc_row_json(dict(r)) for r in rows]
    for item in items:
        item.pop("total_count", None)
    return {"data": items, "total": total, "limit": lim, "offset": off}


@router.get("/my-content-status/book/{book_id}")
async def get_my_content_status_for_book(
    book_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Return {topic_id: {has_slides, has_lecture}} for every topic in book, for this user only."""
    await _ensure_teacher_content_table()
    user_id = current_user["user_id"]
    rows = await execute_query(
        """
        SELECT ttc.library_topic_id::text AS topic_id,
               (ttc.slides_json IS NOT NULL) AS has_slides,
               (ttc.lecture_video_url IS NOT NULL) AS has_lecture
        FROM teacher_topic_content ttc
        JOIN library_topics lt ON lt.id = ttc.library_topic_id
        JOIN library_chapters lc ON lc.id = lt.chapter_id
        WHERE lc.book_id = $1::uuid
          AND ttc.teacher_id = $2::uuid
        """,
        book_id, user_id,
    )
    return {r["topic_id"]: {"has_slides": bool(r["has_slides"]), "has_lecture": bool(r["has_lecture"])} for r in rows}


@router.delete("/topics/{topic_id}/slides")
async def delete_my_topic_slides(
    topic_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Clear this user's slides for a topic (lecture stays untouched)."""
    await _ensure_teacher_content_table()
    user_id = current_user["user_id"]
    await execute_write(
        """
        UPDATE teacher_topic_content
        SET slides_json = NULL, slide_theme = NULL, updated_at = NOW()
        WHERE teacher_id = $1::uuid AND library_topic_id = $2::uuid
        """,
        user_id, topic_id,
    )
    return {"ok": True}


# ============================================
# TEACHER ANALYTICS  (SHS / CVI)
# ============================================

from app.utils.score_calculator import get_date_range as _get_date_range


@router.get("/analytics/overview")
async def get_teacher_analytics_overview(
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(get_user_from_token),
):
    """
    Teacher's performance overview: CVI per class, overall grade, active alerts.
    Supports period=last_month|last_year|custom  (+ start/end for custom).
    """
    teacher_id = current_user.get("user_id")
    date_from, date_to = _get_date_range(period, start, end)

    # Classes assigned to teacher
    classes = await execute_query(
        """
        SELECT DISTINCT c.id, c.name, c.grade_level, c.section
        FROM classes c
        WHERE c.teacher_id = $1::uuid
           OR EXISTS (SELECT 1 FROM teacher_class_assignments tca WHERE tca.class_id = c.id AND tca.teacher_id = $1::uuid)
           OR EXISTS (SELECT 1 FROM teacher_class_subject_assignments tcsa WHERE tcsa.class_id = c.id AND tcsa.teacher_id = $1::uuid)
        """,
        teacher_id,
    )

    class_analytics = []
    for cls in classes:
        cid = str(cls["id"])
        cvi_row = await execute_one(
            """
            SELECT
                COALESCE(AVG(cvi_score), 0) AS avg_cvi,
                COALESCE(AVG(avg_shs), 0) AS avg_shs,
                SUM(struggling_count) AS struggling,
                SUM(excelling_count) AS excelling,
                SUM(total_students) AS total,
                MAX(teacher_grade) AS teacher_grade,
                MAX(alert_message) AS alert_message
            FROM class_vitality_index
            WHERE class_id = $1::uuid AND date BETWEEN $2 AND $3
            """,
            cid, date_from, date_to,
        )
        avg_cvi = float(cvi_row["avg_cvi"] or 0)
        class_analytics.append({
            "class_id": cid,
            "class_name": cls["name"],
            "grade_level": cls["grade_level"],
            "section": cls["section"],
            "avg_cvi": avg_cvi,
            "avg_shs": float(cvi_row["avg_shs"] or 0),
            "struggling_count": int(cvi_row["struggling"] or 0),
            "excelling_count": int(cvi_row["excelling"] or 0),
            "total_students": int(cvi_row["total"] or 0),
            "teacher_grade": cvi_row["teacher_grade"] or "No data",
            "alert_message": cvi_row["alert_message"],
        })

    # Overall teacher grade based on average CVI across classes
    overall_cvi = (sum(c["avg_cvi"] for c in class_analytics) / len(class_analytics)) if class_analytics else 0
    from app.utils.score_calculator import get_teacher_grade as _get_teacher_grade
    overall_grade = _get_teacher_grade(overall_cvi)

    # Active alerts for teacher's students
    class_ids = [str(cls["id"]) for cls in classes]
    alert_count = 0
    if class_ids:
        placeholders = ", ".join(f"${i+1}::uuid" for i in range(len(class_ids)))
        alert_row = await execute_one(
            f"SELECT COUNT(*) AS cnt FROM performance_alerts WHERE class_id IN ({placeholders}) AND is_resolved = false",
            *class_ids,
        )
        alert_count = int(alert_row["cnt"] or 0)

    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "overall_cvi": round(overall_cvi, 2),
        "overall_grade": overall_grade,
        "active_alerts": alert_count,
        "classes": class_analytics,
    }


@router.get("/analytics/class/{class_id}")
async def get_teacher_class_analytics(
    class_id: str,
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(get_user_from_token),
):
    """
    Detailed class analytics: CVI trend, per-student SHS, risk distribution.
    """
    date_from, date_to = _get_date_range(period, start, end)

    # CVI summary for period
    cvi_row = await execute_one(
        """
        SELECT
            COALESCE(AVG(cvi_score), 0) AS avg_cvi,
            COALESCE(AVG(avg_shs), 0) AS avg_shs,
            COALESCE(AVG(engagement_variance), 0) AS avg_variance,
            SUM(struggling_count) AS struggling,
            SUM(excelling_count) AS excelling,
            SUM(total_students) AS total,
            MAX(teacher_grade) AS teacher_grade
        FROM class_vitality_index
        WHERE class_id = $1::uuid AND date BETWEEN $2 AND $3
        """,
        class_id, date_from, date_to,
    )

    # CVI daily trend
    cvi_trend = await execute_query(
        "SELECT date, cvi_score, avg_shs, struggling_count, excelling_count FROM class_vitality_index WHERE class_id = $1::uuid AND date BETWEEN $2 AND $3 ORDER BY date",
        class_id, date_from, date_to,
    )

    # Per-student SHS averages over period
    students = await execute_query(
        """
        SELECT
            dsm.student_id,
            u.full_name,
            COALESCE(AVG(dsm.daily_shs), 0) AS avg_shs,
            COALESCE(AVG(dsm.quiz_score), 0) AS avg_quiz,
            COALESCE(AVG(dsm.video_completion_rate), 0) AS avg_video,
            COUNT(dsm.id) FILTER (WHERE dsm.attendance = true) AS present_days,
            COUNT(dsm.id) AS total_days,
            shs.risk_level,
            shs.momentum
        FROM daily_student_metrics dsm
        JOIN users u ON u.id = dsm.student_id
        LEFT JOIN student_health_scores shs ON shs.student_id = dsm.student_id AND shs.class_id = dsm.class_id
        WHERE dsm.class_id = $1::uuid AND dsm.date BETWEEN $2 AND $3
        GROUP BY dsm.student_id, u.full_name, shs.risk_level, shs.momentum
        ORDER BY avg_shs DESC
        """,
        class_id, date_from, date_to,
    )

    # Risk distribution
    total = int(cvi_row["total"] or 0) or 1
    student_list = [dict(s) for s in students]
    risk_dist = {
        "critical": sum(1 for s in student_list if s["risk_level"] == "critical"),
        "at_risk": sum(1 for s in student_list if s["risk_level"] == "at_risk"),
        "stable": sum(1 for s in student_list if s["risk_level"] == "stable"),
        "excelling": sum(1 for s in student_list if s["risk_level"] == "excelling"),
    }

    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "summary": {
            "avg_cvi": round(float(cvi_row["avg_cvi"] or 0), 2),
            "avg_shs": round(float(cvi_row["avg_shs"] or 0), 2),
            "engagement_variance": round(float(cvi_row["avg_variance"] or 0), 2),
            "struggling_count": int(cvi_row["struggling"] or 0),
            "excelling_count": int(cvi_row["excelling"] or 0),
            "teacher_grade": cvi_row["teacher_grade"] or "No data",
        },
        "risk_distribution": risk_dist,
        "cvi_trend": [dict(r) for r in cvi_trend],
        "students": student_list,
    }


@router.get("/analytics/student/{student_id}")
async def get_teacher_student_analytics(
    student_id: str,
    class_id: str,
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(get_user_from_token),
):
    """
    Detailed SHS analytics for a single student in a class.
    """
    date_from, date_to = _get_date_range(period, start, end)

    # Daily SHS trend
    daily = await execute_query(
        """
        SELECT date, daily_shs, quiz_score, video_completion_rate, attendance,
               study_duration_minutes, homework_submitted, questions_asked, topic_revisits
        FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid AND date BETWEEN $3 AND $4
        ORDER BY date
        """,
        student_id, class_id, date_from, date_to,
    )

    # Rolling SHS scores
    shs_row = await execute_one(
        "SELECT current_shs, weekly_shs, monthly_shs, momentum, risk_level, last_updated FROM student_health_scores WHERE student_id = $1::uuid AND class_id = $2::uuid",
        student_id, class_id,
    )

    # Student name
    user_row = await execute_one("SELECT full_name FROM users WHERE id = $1::uuid", student_id)

    # Active alerts for this student
    alerts = await execute_query(
        "SELECT alert_type, severity, message, action_required, created_at FROM performance_alerts WHERE student_id = $1::uuid AND class_id = $2::uuid AND is_resolved = false ORDER BY created_at DESC LIMIT 5",
        student_id, class_id,
    )

    # Period averages
    avg_row = await execute_one(
        """
        SELECT
            COALESCE(AVG(daily_shs), 0) AS avg_shs,
            COALESCE(AVG(quiz_score), 0) AS avg_quiz,
            COALESCE(AVG(video_completion_rate), 0) AS avg_video,
            COUNT(*) FILTER (WHERE attendance = true) AS present_days,
            COUNT(*) AS total_days,
            COUNT(*) FILTER (WHERE homework_submitted = true) AS hw_submitted
        FROM daily_student_metrics
        WHERE student_id = $1::uuid AND class_id = $2::uuid AND date BETWEEN $3 AND $4
        """,
        student_id, class_id, date_from, date_to,
    )

    return {
        "student_id": student_id,
        "student_name": user_row["full_name"] if user_row else "",
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "rolling_scores": dict(shs_row) if shs_row else {},
        "period_averages": {
            "avg_shs": round(float(avg_row["avg_shs"] or 0), 2),
            "avg_quiz": round(float(avg_row["avg_quiz"] or 0), 2),
            "avg_video": round(float(avg_row["avg_video"] or 0), 2),
            "attendance_rate": round(int(avg_row["present_days"] or 0) / max(int(avg_row["total_days"] or 1), 1) * 100, 2),
            "homework_rate": round(int(avg_row["hw_submitted"] or 0) / max(int(avg_row["total_days"] or 1), 1) * 100, 2),
        },
        "daily_trend": [dict(r) for r in daily],
        "active_alerts": [dict(r) for r in alerts],
    }

