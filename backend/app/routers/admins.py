"""
Admin Portal Routes - Full System Access
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import json
import os
from datetime import date
import re

from app.utils.database import execute_query, execute_one, execute_write
from app.config import settings
from app.schemas.slides_ai import GenerateSlidesRequest, GenerateSlidesResponse
from app.utils.ai_slide_deck import generate_slide_deck

router = APIRouter()


# ============================================
# REQUEST MODELS
# ============================================


class TeacherCurriculumAssignmentIn(BaseModel):
    """One row: teacher teaches one subject+book in one class section."""

    school_id: Optional[str] = None
    branch_id: Optional[str] = None
    library_board_id: Optional[str] = None
    class_id: str
    library_subject_id: str
    library_book_id: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str  # student, teacher, manager, admin
    employee_id: Optional[str] = None
    school_id: Optional[str] = None
    branch_id: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[str] = None
    employment_status: Optional[str] = "active"
    subjects: Optional[List[str]] = None
    qualifications: Optional[str] = None
    experience_years: Optional[float] = None
    contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    languages: Optional[str] = None
    assigned_classes: Optional[List[str]] = None
    salary: Optional[str] = None
    teacher_curriculum_assignments: Optional[List[TeacherCurriculumAssignmentIn]] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    employee_id: Optional[str] = None
    school_id: Optional[str] = None
    branch_id: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[str] = None
    employment_status: Optional[str] = None
    subjects: Optional[List[str]] = None
    qualifications: Optional[str] = None
    experience_years: Optional[float] = None
    contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    languages: Optional[str] = None
    assigned_classes: Optional[List[str]] = None
    salary: Optional[str] = None
    teacher_curriculum_assignments: Optional[List[TeacherCurriculumAssignmentIn]] = None


class AssignRoleRequest(BaseModel):
    user_id: str
    new_role: str


class CreateSchoolRequest(BaseModel):
    name: str
    address: str


class CreateBranchRequest(BaseModel):
    school_id: str
    name: str
    city: str
    address: str


class CreateClassRequest(BaseModel):
    branch_id: str
    name: str
    grade_level: Optional[str] = None
    section: Optional[str] = None


class UpdateSchoolRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


class UpdateBranchRequest(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class UpdateClassRequest(BaseModel):
    name: Optional[str] = None
    grade_level: Optional[str] = None
    section: Optional[str] = None
    student_count: Optional[int] = None


class CreateSubjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    grade_level: str


class CreateTopicRequest(BaseModel):
    subject_id: str
    title: str
    description: Optional[str] = None
    order_index: int


class TopicItem(BaseModel):
    title: str
    description: Optional[str] = None


class ChapterItem(BaseModel):
    number: int
    name: str
    topics: List[TopicItem]


class SubjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    chapters: List[ChapterItem]


class SaveParsedCurriculumRequest(BaseModel):
    book_title: str
    grade_level: str
    subjects: List[SubjectItem]


class GenerateVideoRequest(BaseModel):
    topic_id: str
    topic_title: str
    subject_name: str
    chapter_name: str
    grade_level: str
    topic_description: Optional[str] = None


class GenerateAudioRequest(BaseModel):
    template_id: str
    voice: Optional[str] = "en-US-AriaNeural"


class GenerateWhiteboardRequest(BaseModel):
    template_id: str


class GenerateAvatarRequest(BaseModel):
    template_id: str
    voice_id: Optional[str] = "en-US-JennyNeural"
    presenter_url: Optional[str] = None


class CompositeVideoRequest(BaseModel):
    template_id: str


class CreateStudentRequest(BaseModel):
    email: EmailStr
    full_name: str
    school_id: str
    branch_id: str
    class_id: str
    academic_session: str
    section: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    guardian_name: Optional[str] = None
    primary_contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    medical_notes: Optional[str] = None
    profile_picture_url: Optional[str] = None


class StudentLifecycleRequest(BaseModel):
    academic_session: str
    notes: Optional[str] = None


class ChangeSectionRequest(BaseModel):
    target_class_id: str
    academic_session: str
    notes: Optional[str] = None


class SetCurrentEnrollmentRequest(BaseModel):
    class_id: str
    academic_session: str
    notes: Optional[str] = None


# ============================================
# USER MANAGEMENT
# ============================================

async def ensure_teacher_profiles_table():
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS teacher_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            employee_id VARCHAR(100),
            school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
            branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
            designation VARCHAR(255),
            date_of_joining DATE,
            employment_status VARCHAR(50) DEFAULT 'active',
            subjects JSONB DEFAULT '[]'::jsonb,
            qualifications TEXT,
            experience_years NUMERIC(6,2),
            contact VARCHAR(100),
            emergency_contact VARCHAR(100),
            languages TEXT,
            assigned_classes TEXT,
            salary VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """
    )


async def ensure_student_data_structures():
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS student_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
            branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
            date_of_birth DATE,
            gender VARCHAR(20),
            address TEXT,
            guardian_name VARCHAR(255),
            primary_contact VARCHAR(100),
            emergency_contact VARCHAR(100),
            blood_group VARCHAR(20),
            medical_notes TEXT,
            profile_picture_url TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    await execute_write("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS academic_session VARCHAR(20)")
    await execute_write("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active'")
    await execute_write("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS promotion_result VARCHAR(30)")
    await execute_write("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP")
    await execute_write("ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS notes TEXT")


def _none_if_blank(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _assigned_classes_text(value: Optional[List[str]]) -> Optional[str]:
    if value is None:
        return None
    cleaned = [v for v in value if isinstance(v, str) and v.strip()]
    return json.dumps(cleaned)


async def _sync_teacher_class_assignments(
    teacher_user_id: str, class_ids: Optional[List[str]]
) -> None:
    """Mirror teacher form selections into teacher_class_assignments (My Classes)."""
    try:
        from app.routers.homework import ensure_homework_schema

        await ensure_homework_schema()
    except Exception:
        return
    await execute_write(
        "DELETE FROM teacher_class_assignments WHERE teacher_id = $1::uuid",
        teacher_user_id,
    )
    if not class_ids:
        return
    seen = set()
    for cid in class_ids:
        if not cid or not isinstance(cid, str) or cid in seen:
            continue
        seen.add(cid)
        await execute_write(
            """
            INSERT INTO teacher_class_assignments (teacher_id, class_id)
            VALUES ($1::uuid, $2::uuid)
            ON CONFLICT (teacher_id, class_id) DO NOTHING
            """,
            teacher_user_id,
            cid,
        )


def _parse_date_or_none(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return date.fromisoformat(stripped)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_of_joining format. Use YYYY-MM-DD.")
    return None


async def _get_active_enrollment(student_id: str):
    return await execute_one(
        """
        SELECT e.id, e.class_id, e.academic_session, e.status, c.branch_id, c.grade_level, c.section
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        WHERE e.student_id = $1 AND e.is_active = true
        ORDER BY e.enrolled_at DESC
        LIMIT 1
        """,
        student_id,
    )


async def _activate_enrollment(student_id: str, class_id: str, academic_session: str, notes: Optional[str] = None):
    existing = await execute_one(
        """
        SELECT id
        FROM enrollments
        WHERE student_id = $1 AND class_id = $2::uuid
        """,
        student_id,
        class_id,
    )
    if existing:
        await execute_write(
            """
            UPDATE enrollments
            SET academic_session = $1,
                status = 'active',
                is_active = true,
                notes = $2,
                completed_at = NULL
            WHERE id = $3
            """,
            academic_session,
            _none_if_blank(notes),
            existing["id"],
        )
    else:
        await execute_write(
            """
            INSERT INTO enrollments (student_id, class_id, academic_session, status, is_active, notes)
            VALUES ($1, $2::uuid, $3, 'active', true, $4)
            """,
            student_id,
            class_id,
            academic_session,
            _none_if_blank(notes),
        )


def _parse_academic_session(value: str):
    normalized = (value or "").strip().replace("–", "-").replace("—", "-")
    if not re.fullmatch(r"\d{4}-\d{4}", normalized):
        raise HTTPException(status_code=400, detail="Academic session must be in YYYY-YYYY format.")
    y1, y2 = map(int, normalized.split("-"))
    if y2 != y1 + 1:
        raise HTTPException(status_code=400, detail="Academic session must be consecutive years.")
    return y1, y2, normalized


def _extract_grade_number(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None

@router.get("/users")
async def get_all_users(role: Optional[str] = None):
    """Get all system users with optional role filter"""
    await ensure_teacher_profiles_table()
    try:
        from app.routers.homework import ensure_homework_schema

        await ensure_homework_schema()
    except Exception:
        pass

    query = """
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.role,
            u.is_active,
            u.created_at,
            u.profile_picture_url,
            tp.employee_id,
            tp.school_id,
            sc.name AS school_name,
            tp.branch_id,
            br.name AS branch_name,
            tp.designation,
            tp.date_of_joining,
            tp.employment_status,
            COALESCE(tp.subjects, '[]'::jsonb) AS subjects,
            (
                SELECT COALESCE(json_agg(s.name ORDER BY s.name), '[]'::json)
                FROM subjects s
                WHERE s.id::text IN (
                    SELECT jsonb_array_elements_text(COALESCE(tp.subjects, '[]'::jsonb))
                )
            ) AS subject_names,
            tp.qualifications,
            tp.experience_years,
            tp.contact,
            tp.emergency_contact,
            tp.languages,
            tp.assigned_classes,
            tp.salary,
            (
                SELECT COALESCE(
                    json_agg(tca.class_id::text ORDER BY c.grade_level NULLS LAST, c.section NULLS LAST, c.name),
                    '[]'::json
                )
                FROM teacher_class_assignments tca
                JOIN classes c ON c.id = tca.class_id
                WHERE tca.teacher_id = u.id
            ) AS assigned_class_ids,
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'class_id', tcs.class_id,
                            'class_name', c.name,
                            'grade_level', c.grade_level,
                            'section', c.section,
                            'branch_name', bbr.name,
                            'library_board_id', tcs.library_board_id,
                            'board_name', lbo.name,
                            'library_subject_id', tcs.library_subject_id,
                            'subject_name', ls.name,
                            'library_book_id', tcs.library_book_id,
                            'book_title', lb.title,
                            'school_id', tcs.school_id,
                            'branch_id', tcs.branch_id
                        ) ORDER BY c.name, ls.name
                    ),
                    '[]'::json
                )
                FROM teacher_class_subject_assignments tcs
                JOIN classes c ON c.id = tcs.class_id
                JOIN branches bbr ON bbr.id = c.branch_id
                JOIN library_subjects ls ON ls.id = tcs.library_subject_id
                JOIN library_books lb ON lb.id = tcs.library_book_id
                LEFT JOIN library_boards lbo ON lbo.id = tcs.library_board_id
                WHERE tcs.teacher_id = u.id
            ) AS teacher_curriculum_assignments
        FROM users u
        LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
        LEFT JOIN schools sc ON sc.id = tp.school_id
        LEFT JOIN branches br ON br.id = tp.branch_id
        WHERE ($1::text IS NULL OR role = $1::user_role)
        ORDER BY u.role, u.full_name
    """

    users = await execute_query(query, role)
    return [dict(user) for user in users]


@router.post("/users")
async def create_user(user_data: CreateUserRequest):
    """Create new user account"""
    await ensure_teacher_profiles_table()

    query = """
        INSERT INTO users (email, full_name, role)
        VALUES ($1, $2, $3)
        RETURNING id, email, full_name, role
    """
    
    user = await execute_one(
        query,
        user_data.email,
        user_data.full_name,
        user_data.role
    )

    if user_data.role == "teacher":
        school_id = _none_if_blank(user_data.school_id)
        branch_id = _none_if_blank(user_data.branch_id)
        date_of_joining = _parse_date_or_none(user_data.date_of_joining)

        subj_json = json.dumps(user_data.subjects or [])
        assign_txt = _assigned_classes_text(user_data.assigned_classes)
        curriculum_payload = None
        if user_data.teacher_curriculum_assignments is not None:
            curriculum_payload = [
                a.model_dump() for a in user_data.teacher_curriculum_assignments
            ]
            assign_txt = _assigned_classes_text(
                list({str(r["class_id"]) for r in curriculum_payload})
            )
            subj_json = json.dumps(
                list({str(r["library_subject_id"]) for r in curriculum_payload})
            )

        await execute_write(
            """
            INSERT INTO teacher_profiles (
                user_id, employee_id, school_id, branch_id, designation, date_of_joining,
                employment_status, subjects, qualifications, experience_years, contact,
                emergency_contact, languages, assigned_classes, salary, updated_at
            )
            VALUES (
                $1, $2, $3::uuid, $4::uuid, $5, $6::date,
                COALESCE($7, 'active'), COALESCE($8::jsonb, '[]'::jsonb), $9, $10, $11,
                $12, $13, $14, $15, NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                employee_id = EXCLUDED.employee_id,
                school_id = EXCLUDED.school_id,
                branch_id = EXCLUDED.branch_id,
                designation = EXCLUDED.designation,
                date_of_joining = EXCLUDED.date_of_joining,
                employment_status = EXCLUDED.employment_status,
                subjects = EXCLUDED.subjects,
                qualifications = EXCLUDED.qualifications,
                experience_years = EXCLUDED.experience_years,
                contact = EXCLUDED.contact,
                emergency_contact = EXCLUDED.emergency_contact,
                languages = EXCLUDED.languages,
                assigned_classes = EXCLUDED.assigned_classes,
                salary = EXCLUDED.salary,
                updated_at = NOW()
            """,
            user["id"],
            user_data.employee_id,
            school_id,
            branch_id,
            user_data.designation,
            date_of_joining,
            user_data.employment_status,
            subj_json,
            user_data.qualifications,
            user_data.experience_years,
            _none_if_blank(user_data.contact),
            _none_if_blank(user_data.emergency_contact),
            user_data.languages,
            assign_txt,
            user_data.salary,
        )

        from app.routers.homework import sync_teacher_class_subject_assignments

        if curriculum_payload is not None:
            await sync_teacher_class_subject_assignments(str(user["id"]), curriculum_payload)
        class_ids_for_sync = (
            list({str(r["class_id"]) for r in curriculum_payload})
            if curriculum_payload is not None
            else (user_data.assigned_classes or [])
        )
        await _sync_teacher_class_assignments(str(user["id"]), class_ids_for_sync)

    return {
        "message": "User created successfully",
        "user": dict(user)
    }


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UpdateUserRequest):
    """Update user account and teacher profile details."""
    await ensure_teacher_profiles_table()

    current_user = await execute_one("SELECT id, role FROM users WHERE id = $1", user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    user_updates = []
    user_params = []
    p = 1
    if user_data.full_name is not None:
        user_updates.append(f"full_name = ${p}")
        user_params.append(user_data.full_name)
        p += 1
    if user_data.email is not None:
        user_updates.append(f"email = ${p}")
        user_params.append(user_data.email)
        p += 1

    if user_updates:
        user_params.append(user_id)
        await execute_write(
            f"""
            UPDATE users
            SET {', '.join(user_updates)}, updated_at = NOW()
            WHERE id = ${p}
            """,
            *user_params,
        )

    if current_user["role"] == "teacher":
        school_id = _none_if_blank(user_data.school_id)
        branch_id = _none_if_blank(user_data.branch_id)
        date_of_joining = _parse_date_or_none(user_data.date_of_joining)

        subj_param = (
            json.dumps(user_data.subjects) if user_data.subjects is not None else None
        )
        assign_param = _assigned_classes_text(user_data.assigned_classes)
        if user_data.teacher_curriculum_assignments is not None:
            cur_rows = [a.model_dump() for a in user_data.teacher_curriculum_assignments]
            subj_param = json.dumps(
                list({str(r["library_subject_id"]) for r in cur_rows})
            )
            assign_param = _assigned_classes_text(
                list({str(r["class_id"]) for r in cur_rows})
            )

        await execute_write(
            """
            INSERT INTO teacher_profiles (
                user_id, employee_id, school_id, branch_id, designation, date_of_joining,
                employment_status, subjects, qualifications, experience_years, contact,
                emergency_contact, languages, assigned_classes, salary, updated_at
            )
            VALUES (
                $1, $2, $3::uuid, $4::uuid, $5, $6::date,
                COALESCE($7, 'active'), COALESCE($8::jsonb, '[]'::jsonb), $9, $10, $11,
                $12, $13, $14, $15, NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                employee_id = COALESCE(EXCLUDED.employee_id, teacher_profiles.employee_id),
                school_id = COALESCE(EXCLUDED.school_id, teacher_profiles.school_id),
                branch_id = COALESCE(EXCLUDED.branch_id, teacher_profiles.branch_id),
                designation = COALESCE(EXCLUDED.designation, teacher_profiles.designation),
                date_of_joining = COALESCE(EXCLUDED.date_of_joining, teacher_profiles.date_of_joining),
                employment_status = COALESCE(EXCLUDED.employment_status, teacher_profiles.employment_status),
                subjects = CASE
                    WHEN EXCLUDED.subjects IS NULL THEN teacher_profiles.subjects
                    ELSE EXCLUDED.subjects
                END,
                qualifications = COALESCE(EXCLUDED.qualifications, teacher_profiles.qualifications),
                experience_years = COALESCE(EXCLUDED.experience_years, teacher_profiles.experience_years),
                contact = COALESCE(EXCLUDED.contact, teacher_profiles.contact),
                emergency_contact = COALESCE(EXCLUDED.emergency_contact, teacher_profiles.emergency_contact),
                languages = COALESCE(EXCLUDED.languages, teacher_profiles.languages),
                assigned_classes = COALESCE(EXCLUDED.assigned_classes, teacher_profiles.assigned_classes),
                salary = COALESCE(EXCLUDED.salary, teacher_profiles.salary),
                updated_at = NOW()
            """,
            user_id,
            user_data.employee_id,
            school_id,
            branch_id,
            user_data.designation,
            date_of_joining,
            user_data.employment_status,
            subj_param,
            user_data.qualifications,
            user_data.experience_years,
            _none_if_blank(user_data.contact),
            _none_if_blank(user_data.emergency_contact),
            user_data.languages,
            assign_param,
            user_data.salary,
        )

        from app.routers.homework import sync_teacher_class_subject_assignments

        if user_data.teacher_curriculum_assignments is not None:
            rows = [a.model_dump() for a in user_data.teacher_curriculum_assignments]
            await sync_teacher_class_subject_assignments(user_id, rows)
            await _sync_teacher_class_assignments(
                user_id, list({str(r["class_id"]) for r in rows})
            )
        elif user_data.assigned_classes is not None:
            await _sync_teacher_class_assignments(user_id, user_data.assigned_classes)

    updated_user = await execute_one(
        """
        SELECT id, email, full_name, role, is_active
        FROM users
        WHERE id = $1
        """,
        user_id,
    )
    return {"message": "User updated successfully", "user": dict(updated_user)}


@router.put("/users/{user_id}/role")
async def assign_role(user_id: str, role_data: AssignRoleRequest):
    """Assign or change user role"""
    
    query = """
        UPDATE users
        SET role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, full_name, role
    """
    
    user = await execute_one(query, role_data.new_role, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": "Role updated successfully",
        "user": dict(user)
    }


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str):
    """Deactivate user account"""
    
    query = "UPDATE users SET is_active = false WHERE id = $1"
    await execute_write(query, user_id)
    
    return {"message": "User deactivated successfully"}


# ============================================
# STUDENT MANAGEMENT (LEDGER STYLE)
# ============================================

@router.get("/students")
async def get_students():
    await ensure_student_data_structures()
    rows = await execute_query(
        """
        SELECT
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            sp.school_id, sp.branch_id, sp.guardian_name, sp.primary_contact, sp.emergency_contact,
            sc.name AS school_name, b.name AS branch_name,
            e.class_id, e.academic_session, e.status AS enrollment_status,
            c.grade_level, c.section, c.name AS class_name
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN schools sc ON sc.id = sp.school_id
        LEFT JOIN branches b ON b.id = sp.branch_id
        LEFT JOIN LATERAL (
            SELECT id, class_id, academic_session, status
            FROM enrollments
            WHERE student_id = u.id
            ORDER BY enrolled_at DESC
            LIMIT 1
        ) e ON true
        LEFT JOIN classes c ON c.id = e.class_id
        WHERE u.role = 'student'
        ORDER BY u.full_name
        """
    )
    return [dict(r) for r in rows]


@router.post("/students")
async def create_student(student_data: CreateStudentRequest):
    await ensure_student_data_structures()
    if not re.fullmatch(r"\d{4}-\d{4}", student_data.academic_session or ""):
        raise HTTPException(status_code=400, detail="Academic session must be in YYYY-YYYY format.")

    first_year = int(student_data.academic_session.split("-")[0])
    second_year = int(student_data.academic_session.split("-")[1])
    if second_year != first_year + 1:
        raise HTTPException(status_code=400, detail="Academic session must be consecutive years, e.g. 2025-2026.")

    branch = await execute_one(
        "SELECT id, school_id FROM branches WHERE id = $1",
        student_data.branch_id,
    )
    if not branch:
        raise HTTPException(status_code=400, detail="Selected branch not found.")
    if str(branch["school_id"]) != str(student_data.school_id):
        raise HTTPException(status_code=400, detail="Selected branch does not belong to selected school.")

    cls = await execute_one(
        "SELECT id, branch_id FROM classes WHERE id = $1",
        student_data.class_id,
    )
    if not cls:
        raise HTTPException(status_code=400, detail="Selected class not found.")
    if str(cls["branch_id"]) != str(student_data.branch_id):
        raise HTTPException(status_code=400, detail="Selected class does not belong to selected branch.")

    dob = _parse_date_or_none(student_data.date_of_birth) if student_data.date_of_birth else None
    try:
        user = await execute_one(
            """
            INSERT INTO users (email, full_name, role, is_active)
            VALUES ($1, $2, 'student', true)
            RETURNING id, email, full_name, role
            """,
            student_data.email,
            student_data.full_name,
        )
    except Exception as e:
        if "users_email_key" in str(e):
            raise HTTPException(status_code=400, detail="A user with this email already exists.")
        raise
    await execute_write(
        """
        INSERT INTO student_profiles (
            user_id, school_id, branch_id, date_of_birth, gender, address,
            guardian_name, primary_contact, emergency_contact, blood_group, medical_notes, profile_picture_url
        )
        VALUES ($1, $2::uuid, $3::uuid, $4::date, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
            school_id = EXCLUDED.school_id,
            branch_id = EXCLUDED.branch_id,
            date_of_birth = EXCLUDED.date_of_birth,
            gender = EXCLUDED.gender,
            address = EXCLUDED.address,
            guardian_name = EXCLUDED.guardian_name,
            primary_contact = EXCLUDED.primary_contact,
            emergency_contact = EXCLUDED.emergency_contact,
            blood_group = EXCLUDED.blood_group,
            medical_notes = EXCLUDED.medical_notes,
            profile_picture_url = EXCLUDED.profile_picture_url,
            updated_at = NOW()
        """,
        user["id"],
        student_data.school_id,
        student_data.branch_id,
        dob,
        _none_if_blank(student_data.gender),
        _none_if_blank(student_data.address),
        _none_if_blank(student_data.guardian_name),
        _none_if_blank(student_data.primary_contact),
        _none_if_blank(student_data.emergency_contact),
        _none_if_blank(student_data.blood_group),
        _none_if_blank(student_data.medical_notes),
        _none_if_blank(student_data.profile_picture_url),
    )
    await execute_write(
        "UPDATE enrollments SET is_active = false WHERE student_id = $1 AND is_active = true",
        user["id"],
    )
    await _activate_enrollment(user["id"], student_data.class_id, student_data.academic_session)
    return {"message": "Student created successfully", "student": dict(user)}


@router.get("/students/{student_id}")
async def get_student_detail(student_id: str):
    await ensure_student_data_structures()
    profile = await execute_one(
        """
        SELECT
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            sp.school_id, sp.branch_id, sp.date_of_birth, sp.gender, sp.address,
            sp.guardian_name, sp.primary_contact, sp.emergency_contact, sp.blood_group, sp.medical_notes,
            sp.profile_picture_url,
            sc.name AS school_name, b.name AS branch_name
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN schools sc ON sc.id = sp.school_id
        LEFT JOIN branches b ON b.id = sp.branch_id
        WHERE u.id = $1 AND u.role = 'student'
        """,
        student_id,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")

    history = await execute_query(
        """
        SELECT
            e.id, e.class_id, e.academic_session, e.status, e.promotion_result, e.is_active, e.enrolled_at, e.completed_at, e.notes,
            c.grade_level, c.section, c.name AS class_name, b.name AS branch_name, sc.name AS school_name
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        JOIN branches b ON b.id = c.branch_id
        JOIN schools sc ON sc.id = b.school_id
        WHERE e.student_id = $1
        ORDER BY e.enrolled_at DESC
        """,
        student_id,
    )
    return {"profile": dict(profile), "history": [dict(h) for h in history]}


@router.post("/students/{student_id}/promote")
async def promote_student(student_id: str, req: StudentLifecycleRequest):
    await ensure_student_data_structures()
    _, _, normalized_session = _parse_academic_session(req.academic_session)
    active = await _get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")

    current_grade_num = _extract_grade_number(active["grade_level"])
    if current_grade_num is None:
        raise HTTPException(status_code=400, detail="Current class grade is not numeric; set explicit next class mapping.")

    branch_classes = await execute_query(
        """
        SELECT id, grade_level, section
        FROM classes
        WHERE branch_id = $1
        """,
        active["branch_id"],
    )
    next_class = None
    for cls in branch_classes:
        if _extract_grade_number(cls["grade_level"]) == current_grade_num + 1 and (cls.get("section") or "") == (active.get("section") or ""):
            next_class = cls
            break
    if not next_class:
        raise HTTPException(status_code=400, detail="Next class not found in this branch. Create it first.")

    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'completed', promotion_result = 'promoted', completed_at = NOW(), notes = $1 WHERE id = $2",
        _none_if_blank(req.notes),
        active["id"],
    )
    await _activate_enrollment(student_id, str(next_class["id"]), normalized_session, req.notes)
    return {"message": "Student promoted successfully"}


@router.post("/students/{student_id}/repeat")
async def repeat_student(student_id: str, req: StudentLifecycleRequest):
    await ensure_student_data_structures()
    _, _, normalized_session = _parse_academic_session(req.academic_session)
    active = await _get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'completed', promotion_result = 'failed', completed_at = NOW(), notes = $1 WHERE id = $2",
        _none_if_blank(req.notes),
        active["id"],
    )
    await _activate_enrollment(student_id, str(active["class_id"]), normalized_session, req.notes)
    return {"message": "Student marked as repeat for next session"}


@router.post("/students/{student_id}/change-section")
async def change_student_section(student_id: str, req: ChangeSectionRequest):
    await ensure_student_data_structures()
    _, _, normalized_session = _parse_academic_session(req.academic_session)
    active = await _get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    target = await execute_one(
        """
        SELECT id, branch_id, grade_level
        FROM classes
        WHERE id = $1
        """,
        req.target_class_id,
    )
    if not target:
        raise HTTPException(status_code=404, detail="Target class not found")
    if str(target["branch_id"]) != str(active["branch_id"]):
        raise HTTPException(status_code=400, detail="Target section must be in the same branch.")
    if str(target["grade_level"]) != str(active["grade_level"]):
        raise HTTPException(status_code=400, detail="Target section must be in the same class/grade.")
    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'transferred', completed_at = NOW(), notes = $1 WHERE id = $2",
        _none_if_blank(req.notes),
        active["id"],
    )
    await _activate_enrollment(student_id, req.target_class_id, normalized_session, req.notes)
    return {"message": "Section changed successfully"}


@router.get("/students/{student_id}/section-options")
async def get_section_change_options(student_id: str):
    await ensure_student_data_structures()
    active = await _get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    options = await execute_query(
        """
        SELECT id, name, grade_level, section
        FROM classes
        WHERE branch_id = $1
          AND grade_level = $2
          AND id <> $3
        ORDER BY section NULLS LAST, name
        """,
        active["branch_id"],
        active["grade_level"],
        active["class_id"],
    )
    return {"options": [dict(o) for o in options]}


@router.delete("/students/{student_id}")
async def archive_student(student_id: str):
    await ensure_student_data_structures()
    await execute_write("UPDATE users SET is_active = false WHERE id = $1 AND role = 'student'", student_id)
    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'left', completed_at = NOW() WHERE student_id = $1 AND is_active = true",
        student_id,
    )
    return {"message": "Student archived successfully"}


@router.post("/students/{student_id}/set-current-enrollment")
async def set_current_enrollment(student_id: str, req: SetCurrentEnrollmentRequest):
    await ensure_student_data_structures()
    _, _, normalized_session = _parse_academic_session(req.academic_session)

    student = await execute_one("SELECT id FROM users WHERE id = $1 AND role = 'student'", student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    target_class = await execute_one(
        "SELECT id FROM classes WHERE id = $1",
        req.class_id,
    )
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    await execute_write(
        """
        UPDATE enrollments
        SET is_active = false,
            status = CASE WHEN status = 'active' THEN 'completed' ELSE status END,
            completed_at = COALESCE(completed_at, NOW())
        WHERE student_id = $1 AND is_active = true
        """,
        student_id,
    )
    await _activate_enrollment(student_id, req.class_id, normalized_session, req.notes)
    return {"message": "Current enrollment set successfully"}


# ============================================
# SCHOOL & BRANCH MANAGEMENT
# ============================================

@router.get("/schools")
async def get_all_schools():
    """Get all schools with branch and class counts"""
    query = """
        SELECT
            s.id, s.name, s.address, s.created_at,
            COUNT(DISTINCT b.id) AS branch_count,
            COUNT(DISTINCT c.id) AS class_count
        FROM schools s
        LEFT JOIN branches b ON b.school_id = s.id
        LEFT JOIN classes c ON c.branch_id = b.id
        GROUP BY s.id
        ORDER BY s.name
    """
    schools = await execute_query(query)
    return [dict(s) for s in schools]


@router.get("/schools/all-data")
async def get_all_school_data():
    """Get all schools, branches, and classes at once for global search"""
    schools = await execute_query("SELECT id, name, address, created_at FROM schools ORDER BY name")
    branches = await execute_query("SELECT id, school_id, name, city, address, created_at FROM branches ORDER BY name")
    classes = await execute_query("""
        SELECT 
            c.id, c.branch_id, c.name, c.grade_level, c.section, c.teacher_id, 
            COUNT(DISTINCT e.student_id) AS student_count, c.created_at,
            u.full_name AS teacher_name
        FROM classes c
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
        LEFT JOIN users u ON u.id = c.teacher_id
        GROUP BY c.id, u.full_name
        ORDER BY c.grade_level, c.section, c.name
    """)
    
    return {
        "schools": [dict(s) for s in schools],
        "branches": [dict(b) for b in branches],
        "classes": [dict(c) for c in classes]
    }


@router.post("/schools")
async def create_school(school_data: CreateSchoolRequest):
    """Create new school"""
    query = """
        INSERT INTO schools (name, address)
        VALUES ($1, $2)
        RETURNING id, name, address
    """
    school = await execute_one(query, school_data.name, school_data.address)
    return {"message": "School created successfully", "school": dict(school)}


@router.put("/schools/{school_id}")
async def update_school(school_id: str, school_data: UpdateSchoolRequest):
    """Update a school"""
    query = """
        UPDATE schools 
        SET name = COALESCE($1, name), 
            address = COALESCE($2, address)
        WHERE id = $3
        RETURNING id, name, address
    """
    school = await execute_one(query, school_data.name, school_data.address, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return {"message": "School updated successfully", "school": dict(school)}


@router.delete("/schools/{school_id}")
async def delete_school(school_id: str):
    """Delete a school"""
    query = "DELETE FROM schools WHERE id = $1 RETURNING id"
    deleted = await execute_one(query, school_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="School not found")
    return {"message": "School deleted successfully"}


@router.get("/schools/{school_id}/branches")
async def get_school_branches(school_id: str):
    """Get all branches for a school with class and student counts"""
    query = """
        SELECT
            b.id, b.school_id, b.name, b.city, b.address, b.created_at,
            COUNT(DISTINCT c.id) AS class_count,
            COUNT(DISTINCT e.student_id) AS student_count
        FROM branches b
        LEFT JOIN classes c ON c.branch_id = b.id
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
        WHERE b.school_id = $1
        GROUP BY b.id
        ORDER BY b.name
    """
    branches = await execute_query(query, school_id)
    return [dict(b) for b in branches]


@router.post("/branches")
async def create_branch(branch_data: CreateBranchRequest):
    """Create new branch"""
    query = """
        INSERT INTO branches (school_id, name, city, address)
        VALUES ($1, $2, $3, $4)
        RETURNING id, school_id, name, city, address
    """
    branch = await execute_one(
        query,
        branch_data.school_id,
        branch_data.name,
        branch_data.city,
        branch_data.address
    )
    return {"message": "Branch created successfully", "branch": dict(branch)}


@router.put("/branches/{branch_id}")
async def update_branch(branch_id: str, branch_data: UpdateBranchRequest):
    """Update a branch"""
    query = """
        UPDATE branches 
        SET name = COALESCE($1, name), 
            city = COALESCE($2, city),
            address = COALESCE($3, address)
        WHERE id = $4
        RETURNING id, school_id, name, city, address
    """
    branch = await execute_one(query, branch_data.name, branch_data.city, branch_data.address, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch updated successfully", "branch": dict(branch)}


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str):
    """Delete a branch"""
    query = "DELETE FROM branches WHERE id = $1 RETURNING id"
    deleted = await execute_one(query, branch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted successfully"}


@router.get("/classes")
async def get_all_classes():
    """Get all classes across all branches"""
    query = """
        SELECT
            c.id, c.branch_id, c.name, c.grade_level, c.section,
            c.teacher_id, c.created_at,
            COUNT(DISTINCT e.student_id) AS student_count,
            u.full_name AS teacher_name,
            b.name AS branch_name,
            s.name AS school_name
        FROM classes c
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
        LEFT JOIN users u ON u.id = c.teacher_id
        LEFT JOIN branches b ON b.id = c.branch_id
        LEFT JOIN schools s ON s.id = b.school_id
        GROUP BY c.id, u.full_name, b.name, s.name
        ORDER BY c.grade_level, c.section, c.name
    """
    classes = await execute_query(query)
    return {"data": [dict(c) for c in classes]}


@router.get("/branches/{branch_id}/classes")
async def get_branch_classes(branch_id: str):
    """Get all classes for a branch with section and student count"""
    query = """
        SELECT
            c.id, c.branch_id, c.name, c.grade_level, c.section,
            c.teacher_id, c.created_at,
            COUNT(DISTINCT e.student_id) AS student_count,
            u.full_name AS teacher_name
        FROM classes c
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE c.branch_id = $1
        GROUP BY c.id, u.full_name
        ORDER BY c.grade_level, c.section, c.name
    """
    classes = await execute_query(query, branch_id)
    return [dict(c) for c in classes]


@router.post("/classes")
async def create_class(class_data: CreateClassRequest):
    """Create a new class under a branch"""
    query = """
        INSERT INTO classes (branch_id, name, grade_level, section)
        VALUES ($1, $2, $3, $4)
        RETURNING id, branch_id, name, grade_level, section
    """
    cls = await execute_one(
        query,
        class_data.branch_id,
        class_data.name,
        class_data.grade_level,
        class_data.section
    )
    return {"message": "Class created successfully", "class": dict(cls)}


@router.put("/classes/{class_id}")
async def update_class(class_id: str, class_data: UpdateClassRequest):
    """Update a class"""
    query = """
        UPDATE classes 
        SET name = COALESCE($1, name), 
            grade_level = COALESCE($2, grade_level),
            section = COALESCE($3, section),
            manual_student_count = COALESCE($4, manual_student_count)
        WHERE id = $5
        RETURNING id, branch_id, name, grade_level, section, manual_student_count as student_count
    """
    cls = await execute_one(query, class_data.name, class_data.grade_level, class_data.section, class_data.student_count, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class updated successfully", "class": dict(cls)}


@router.delete("/classes/{class_id}")
async def delete_class(class_id: str):
    """Delete a class"""
    query = "DELETE FROM classes WHERE id = $1 RETURNING id"
    deleted = await execute_one(query, class_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted successfully"}


# ============================================
# CURRICULUM MANAGEMENT
# ============================================

@router.get("/subjects")
async def get_all_subjects():
    """Get all subjects"""
    query = """
        SELECT id, name, description, grade_level
        FROM subjects
        ORDER BY grade_level, name
    """
    subjects = await execute_query(query)
    return [dict(s) for s in subjects]


@router.post("/subjects")
async def create_subject(subject_data: CreateSubjectRequest):
    """Create new subject"""
    
    query = """
        INSERT INTO subjects (name, description, grade_level)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, grade_level
    """
    
    subject = await execute_one(
        query,
        subject_data.name,
        subject_data.description,
        subject_data.grade_level
    )
    
    return {
        "message": "Subject created successfully",
        "subject": dict(subject)
    }


@router.post("/topics")
async def create_topic(topic_data: CreateTopicRequest):
    """Create new topic"""
    
    query = """
        INSERT INTO topics (subject_id, title, description, order_index)
        VALUES ($1, $2, $3, $4)
        RETURNING id, subject_id, title, description, order_index
    """
    
    topic = await execute_one(
        query,
        topic_data.subject_id,
        topic_data.title,
        topic_data.description,
        topic_data.order_index
    )
    
    return {
        "message": "Topic created successfully",
        "topic": dict(topic)
    }


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """Delete a subject and all its topics (+ any associated video templates)."""
    subject = await execute_one("SELECT id, name FROM subjects WHERE id = $1", subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Delete in dependency order: video_templates → topics → subject
    await execute_write(
        "DELETE FROM video_templates WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = $1)",
        subject_id,
    )
    await execute_write("DELETE FROM topics WHERE subject_id = $1", subject_id)
    await execute_write("DELETE FROM subjects WHERE id = $1", subject_id)

    return {"message": f"Subject '{subject['name']}' and all its topics deleted"}


@router.get("/subjects/{subject_id}/topics")
async def get_subject_topics(subject_id: str):
    """Get all topics for a subject"""
    query = """
        SELECT id, subject_id, title, description, order_index, chapter_name, chapter_number
        FROM topics
        WHERE subject_id = $1
        ORDER BY COALESCE(chapter_number, 0), order_index, title
    """
    topics = await execute_query(query, subject_id)
    return [dict(t) for t in topics]


@router.get("/topics/{topic_id}/template")
async def get_topic_template(topic_id: str):
    """Get the video template (script + video URLs) for a topic, if it exists."""
    row = await execute_one(
        """
        SELECT
            vt.id, vt.title, vt.transcript, vt.key_points, vt.visual_elements,
            vt.duration_seconds, vt.status,
            vt.audio_url, vt.whiteboard_url, vt.avatar_url,
            vt.final_video_url, vt.video_url,
            t.title as topic_title
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        WHERE vt.topic_id = $1
        ORDER BY vt.created_at DESC
        LIMIT 1
        """,
        topic_id,
    )
    if not row:
        return {"template": None}
    import json as _json
    data = dict(row)
    for field in ("key_points", "visual_elements"):
        if data.get(field) and isinstance(data[field], str):
            try:
                data[field] = _json.loads(data[field])
            except Exception:
                data[field] = []
    return {"template": data}


@router.put("/topics/{topic_id}/template/script")
async def update_topic_script(topic_id: str, body: dict):
    """
    Update the transcript of a topic's video template.
    If regenerate=true in body, also re-runs audio + whiteboard steps.
    """
    transcript = body.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="transcript is required")

    template = await execute_one(
        "SELECT id FROM video_templates WHERE topic_id = $1 ORDER BY created_at DESC LIMIT 1",
        topic_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="No video template for this topic yet")

    template_id = str(template["id"])

    await execute_write(
        "UPDATE video_templates SET transcript = $1, status = 'ai_script', updated_at = NOW() WHERE id = $2",
        transcript,
        template_id,
    )

    if body.get("regenerate"):
        # Re-run audio
        try:
            from app.utils.claude_ai import generate_audio_edge_tts
            audio_url = await generate_audio_edge_tts(transcript, topic_id)
            await execute_write(
                "UPDATE video_templates SET audio_url = $1, video_url = $1, status = 'audio_ready' WHERE id = $2",
                audio_url, template_id,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Audio regeneration failed: {e}")

        # Re-run whiteboard (pass the freshly generated audio to mux in)
        try:
            from app.utils.slide_generator import generate_whiteboard_video
            topic = await execute_one("SELECT title FROM topics WHERE id = $1", topic_id)
            audio_row = await execute_one(
                "SELECT audio_url FROM video_templates WHERE id = $1", template_id
            )
            audio_local = None
            if audio_row and audio_row["audio_url"]:
                candidate = audio_row["audio_url"].lstrip("/")
                if os.path.exists(candidate):
                    audio_local = candidate
            whiteboard_url = await generate_whiteboard_video(
                script=transcript,
                visual_elements=[],
                topic_title=topic["title"] if topic else "",
                topic_id=topic_id,
                audio_path=audio_local,
            )
            await execute_write(
                "UPDATE video_templates SET whiteboard_url = $1, status = 'whiteboard_ready' WHERE id = $2",
                whiteboard_url, template_id,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Whiteboard regeneration failed: {e}")

    updated = await execute_one(
        """
        SELECT id, transcript, status, audio_url, whiteboard_url, avatar_url,
               final_video_url, video_url
        FROM video_templates WHERE id = $1
        """,
        template_id,
    )
    return {"message": "Script updated", "template": dict(updated)}


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    """Get a single topic with its content and slides."""
    topic = await execute_one(
        "SELECT id, subject_id, title, description, content, slides_json, chapter_name, chapter_number, order_index FROM topics WHERE id = $1",
        topic_id,
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    import json as _json
    data = dict(topic)
    if data.get("slides_json"):
        try:
            data["slides"] = _json.loads(data["slides_json"])
        except Exception:
            data["slides"] = None
    else:
        data["slides"] = None
    del data["slides_json"]
    return {"topic": data}


@router.put("/topics/{topic_id}")
async def update_topic_content(topic_id: str, body: dict):
    """Update topic title, description, and/or text content."""
    updates, params = [], []
    for field in ("title", "description", "content"):
        if field in body and body[field] is not None:
            params.append(body[field])
            updates.append(f"{field} = ${len(params)}")
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    params.append(topic_id)
    await execute_write(
        f"UPDATE topics SET {', '.join(updates)}, updated_at = NOW() WHERE id = ${len(params)}",
        *params,
    )
    topic = await execute_one(
        "SELECT id, title, description, content FROM topics WHERE id = $1", topic_id
    )
    return {"topic": dict(topic)}


@router.get("/topics/{topic_id}/slides")
async def get_topic_slides(topic_id: str):
    """Get saved slide deck for a topic."""
    row = await execute_one(
        "SELECT slides_json FROM topics WHERE id = $1", topic_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")
    import json as _json
    slides = None
    if row["slides_json"]:
        try:
            slides = _json.loads(row["slides_json"])
        except Exception:
            pass
    return {"slides": slides}


@router.put("/topics/{topic_id}/slides")
async def save_topic_slides(topic_id: str, body: dict):
    """Save a slide deck (JSON array) to a topic."""
    import json as _json
    slides = body.get("slides")
    if slides is None:
        raise HTTPException(status_code=400, detail="slides field required")
    await execute_write(
        "UPDATE topics SET slides_json = $1, updated_at = NOW() WHERE id = $2",
        _json.dumps(slides),
        topic_id,
    )
    return {"success": True}


@router.post("/generate-slides", response_model=GenerateSlidesResponse)
async def generate_slides_ai(body: GenerateSlidesRequest):
    """
    AI-assisted slide authoring. Payload: topic, content, audience, tone, slide_count.
    Calls Claude JSON mode when configured; otherwise returns a structured mock deck.
    """
    return await generate_slide_deck(body)


@router.post("/topics/{topic_id}/generate-content")
async def generate_topic_content_ai(topic_id: str):
    """Use Claude AI to generate full lesson content for a topic and save it."""
    row = await execute_one(
        """
        SELECT t.id, t.title, t.description, t.chapter_name,
               s.name AS subject_name, s.grade_level
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE t.id = $1
        """,
        topic_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")

    from app.utils.claude_ai import generate_topic_explainer_script

    try:
        result = await generate_topic_explainer_script(
            topic_title=row["title"],
            subject_name=row["subject_name"] or "",
            chapter_name=row["chapter_name"] or "",
            grade_level=row["grade_level"] or "High School",
            topic_description=row["description"] or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    script = result.get("script", "")
    await execute_write(
        "UPDATE topics SET content = $1, updated_at = NOW() WHERE id = $2",
        script,
        topic_id,
    )
    return {
        "content": script,
        "key_points": result.get("key_points", []),
        "title": result.get("title", row["title"]),
    }


# ============================================
# AI CURRICULUM MANAGEMENT
# ============================================

@router.post("/curriculum/parse-metadata")
async def parse_book_metadata(file: UploadFile = File(...)):
    """Extract only title/author/board/grade/subject from a book — fast, no full parse."""
    from app.utils.claude_ai import extract_book_metadata

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    try:
        result = await extract_book_metadata(content, file.filename, file.content_type or "")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metadata extraction failed: {str(e)}")


@router.post("/curriculum/parse-book")
async def parse_curriculum_book(file: UploadFile = File(...)):
    """Upload a curriculum book (PDF or text) and parse it with Claude AI."""
    from app.utils.claude_ai import parse_curriculum_document, _parse_curriculum_heuristic

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    allowed_types = {"application/pdf", "text/plain", "text/markdown", "application/octet-stream"}
    if file.content_type not in allowed_types and not file.filename.lower().endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload PDF or text file.")

    # Local extraction used as fast, reliable fallback path.
    def _local_fallback_payload():
        fallback_text = ""
        if file.filename.lower().endswith(".pdf") or (file.content_type or "") == "application/pdf":
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                pages = []
                for page in reader.pages[:30]:
                    pages.append(page.extract_text() or "")
                fallback_text = "\n".join(pages)
            except Exception:
                fallback_text = ""
        if not fallback_text:
            try:
                fallback_text = content.decode("utf-8", errors="replace")
            except Exception:
                fallback_text = ""
        return _parse_curriculum_heuristic(fallback_text, file.filename)

    try:
        import asyncio
        # Allow enough time for real AI parsing on medium PDFs.
        result = await asyncio.wait_for(
            parse_curriculum_document(content, file.filename, file.content_type or ""),
            timeout=120
        )
        return result
    except Exception:
        return _local_fallback_payload()


@router.post("/curriculum/save-parsed")
async def save_parsed_curriculum(data: SaveParsedCurriculumRequest):
    """Save AI-parsed curriculum structure (subjects + chapters + topics) to the database."""
    created = {"subjects": 0, "topics": 0}

    for subject_item in data.subjects:
        # Upsert subject
        subject = await execute_one(
            """
            INSERT INTO subjects (name, description, grade_level)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            subject_item.name,
            subject_item.description,
            data.grade_level,
        )
        if not subject:
            subject = await execute_one(
                "SELECT id FROM subjects WHERE name = $1 AND grade_level = $2",
                subject_item.name,
                data.grade_level,
            )
        if not subject:
            continue

        subject_id = subject["id"]
        created["subjects"] += 1
        order = 1

        for chapter in subject_item.chapters:
            for topic in chapter.topics:
                await execute_write(
                    """
                    INSERT INTO topics (subject_id, title, description, order_index, chapter_name, chapter_number)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT DO NOTHING
                    """,
                    subject_id,
                    topic.title,
                    topic.description,
                    order,
                    chapter.name,
                    chapter.number,
                )
                order += 1
                created["topics"] += 1

    return {"message": "Curriculum saved successfully", "created": created}


@router.post("/curriculum/generate-video")
async def generate_video_for_topic(data: GenerateVideoRequest):
    """Generate an AI explainer video script for a single topic and store it as a video template."""
    from app.utils.claude_ai import generate_topic_explainer_script
    import json as _json

    # Check topic exists
    topic = await execute_one("SELECT id, subject_id FROM topics WHERE id = $1", data.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    try:
        result = await generate_topic_explainer_script(
            topic_title=data.topic_title,
            subject_name=data.subject_name,
            chapter_name=data.chapter_name,
            grade_level=data.grade_level,
            topic_description=data.topic_description or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

    # Store as video template
    template = await execute_one(
        """
        INSERT INTO video_templates
            (topic_id, title, transcript, duration_seconds, status, key_points, visual_elements)
        VALUES ($1, $2, $3, $4, 'ai_script', $5, $6)
        RETURNING id, topic_id, title, duration_seconds, status
        """,
        data.topic_id,
        result.get("title", data.topic_title),
        result.get("script", ""),
        result.get("duration_estimate", 300),
        _json.dumps(result.get("key_points", [])),
        _json.dumps(result.get("visual_elements", [])),
    )

    return {
        "message": "Video script generated",
        "template": dict(template),
        "script": result.get("script", ""),
        "key_points": result.get("key_points", []),
        "visual_elements": result.get("visual_elements", []),
        "duration_estimate": result.get("duration_estimate", 300),
    }


@router.post("/curriculum/generate-audio")
async def generate_topic_audio(data: GenerateAudioRequest):
    """Generate audio narration for a topic's script using Microsoft Edge TTS (free)."""
    from app.utils.claude_ai import generate_audio_edge_tts

    template = await execute_one(
        "SELECT id, transcript, topic_id FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    try:
        audio_url = await generate_audio_edge_tts(
            template["transcript"],
            str(template["topic_id"]),
            data.voice or "en-US-AriaNeural",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET audio_url = $1, video_url = $1, status = 'audio_ready' WHERE id = $2",
        audio_url,
        data.template_id,
    )

    return {"audio_url": audio_url, "template_id": data.template_id}


@router.post("/curriculum/generate-whiteboard")
async def generate_whiteboard_for_topic(data: GenerateWhiteboardRequest):
    """Render a whiteboard-style animation video from the saved script (Pillow + imageio-ffmpeg)."""
    from app.utils.slide_generator import generate_whiteboard_video
    import json as _json

    template = await execute_one(
        "SELECT id, transcript, topic_id, visual_elements, audio_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    topic = await execute_one("SELECT title FROM topics WHERE id = $1", template["topic_id"])
    topic_title = topic["title"] if topic else "Topic"

    visual_elements = []
    if template["visual_elements"]:
        try:
            visual_elements = _json.loads(template["visual_elements"]) if isinstance(template["visual_elements"], str) else list(template["visual_elements"])
        except Exception:
            pass

    # Resolve audio URL → local path so FFmpeg can mux it in
    audio_local = None
    if template["audio_url"]:
        candidate = template["audio_url"].lstrip("/")   # e.g. static/audio/topic_xxx.mp3
        if os.path.exists(candidate):
            audio_local = candidate

    try:
        whiteboard_url = await generate_whiteboard_video(
            script=template["transcript"],
            visual_elements=visual_elements,
            topic_title=topic_title,
            topic_id=str(template["topic_id"]),
            audio_path=audio_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whiteboard generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET whiteboard_url = $1, status = 'whiteboard_ready' WHERE id = $2",
        whiteboard_url,
        data.template_id,
    )

    return {"whiteboard_url": whiteboard_url, "template_id": data.template_id}


@router.post("/curriculum/generate-avatar")
async def generate_avatar_for_topic(data: GenerateAvatarRequest):
    """Generate a Wav2Lip talking-teacher avatar video for a topic (local GPU, free)."""
    from app.utils.wav2lip_client import generate_wav2lip_avatar

    template = await execute_one(
        "SELECT id, topic_id, audio_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    audio_url = template["audio_url"]
    if not audio_url:
        raise HTTPException(status_code=400, detail="Audio not generated yet. Run generate-script first.")

    # Convert URL path → local filesystem path
    audio_local = audio_url.lstrip("/")  # e.g. "static/audio/topic_123.mp3"

    face_path = data.presenter_url if data.presenter_url and os.path.exists(data.presenter_url) else None

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
        avatar_url,
        data.template_id,
    )

    return {"avatar_url": avatar_url, "template_id": data.template_id}


@router.post("/curriculum/composite-video")
async def composite_topic_video(data: CompositeVideoRequest):
    """Composite whiteboard + D-ID avatar into a final MP4 using bundled FFmpeg."""
    from app.utils.video_compositor import composite_video

    template = await execute_one(
        "SELECT id, topic_id, whiteboard_url, avatar_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    whiteboard_url = template["whiteboard_url"]
    avatar_url = template["avatar_url"]

    if not whiteboard_url:
        raise HTTPException(status_code=400, detail="Whiteboard video not generated yet. Run generate-whiteboard first.")
    if not avatar_url:
        raise HTTPException(status_code=400, detail="Avatar video not generated yet. Run generate-avatar first.")

    # Convert URL paths to local filesystem paths
    whiteboard_local = whiteboard_url.lstrip("/")   # e.g. static/videos/whiteboard_xxx.mp4
    avatar_local     = avatar_url.lstrip("/")

    try:
        final_url = await composite_video(
            whiteboard_local=whiteboard_local,
            avatar_local=avatar_local,
            topic_id=str(template["topic_id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compositing failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET final_video_url = $1, video_url = $1, status = 'video_ready' WHERE id = $2",
        final_url,
        data.template_id,
    )

    return {"final_video_url": final_url, "template_id": data.template_id}


@router.post("/curriculum/composite-teacher-pip")
async def composite_with_teacher_pip(
    template_id: str = Form(...),
    teacher_video: UploadFile = File(...),
):
    """
    Upload a teacher's face-cam recording and composite it as a circular PiP
    over the generated whiteboard animation. Teacher's own audio becomes the
    final soundtrack — no AI/GPU required.
    """
    from app.utils.video_compositor import composite_teacher_pip

    template = await execute_one(
        "SELECT id, topic_id, whiteboard_url FROM video_templates WHERE id = $1",
        template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    whiteboard_url = template["whiteboard_url"]
    if not whiteboard_url:
        raise HTTPException(
            status_code=400,
            detail="Whiteboard animation not generated yet. Run generate-whiteboard first.",
        )

    whiteboard_local = whiteboard_url.lstrip("/")
    if not os.path.exists(whiteboard_local):
        raise HTTPException(status_code=404, detail=f"Whiteboard file missing: {whiteboard_local}")

    # Save uploaded teacher video to a temp file
    os.makedirs("static/tmp", exist_ok=True)
    ext = (teacher_video.filename or "video.mp4").rsplit(".", 1)[-1].lower()
    if ext not in {"mp4", "webm", "mov", "avi", "mkv"}:
        ext = "mp4"
    tmp_path = f"static/tmp/teacher_{template_id}.{ext}"
    try:
        content = await teacher_video.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded video: {e}")

    try:
        final_url = await composite_teacher_pip(
            whiteboard_local=whiteboard_local,
            teacher_video_local=tmp_path,
            topic_id=str(template["topic_id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compositing failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    await execute_write(
        "UPDATE video_templates SET final_video_url = $1, status = 'video_ready' WHERE id = $2",
        final_url,
        template_id,
    )

    return {"final_video_url": final_url, "template_id": template_id}


# ============================================
# VIDEO MANAGEMENT
# ============================================

@router.get("/videos/templates")
async def get_all_video_templates():
    """Get all video templates"""
    
    query = """
        SELECT 
            vt.*,
            t.title as topic_title,
            s.name as subject_name,
            u.full_name as created_by_name
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN users u ON vt.created_by = u.id
        ORDER BY s.name, t.order_index
    """
    
    templates = await execute_query(query)
    return [dict(template) for template in templates]


@router.post("/videos/templates")
async def create_video_template(
    topic_id: str,
    title: str,
    video_url: str,
    duration_seconds: int,
    admin_id: str
):
    """Create new video template (without avatar)"""
    
    query = """
        INSERT INTO video_templates (topic_id, title, video_url, duration_seconds, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, topic_id, title, video_url, duration_seconds
    """
    
    template = await execute_one(
        query,
        topic_id,
        title,
        video_url,
        duration_seconds,
        admin_id
    )
    
    return {
        "message": "Video template created successfully",
        "template": dict(template)
    }


@router.put("/videos/templates/{template_id}")
async def update_video_template(
    template_id: str,
    title: Optional[str] = None,
    video_url: Optional[str] = None,
    duration_seconds: Optional[int] = None
):
    """Update video template"""
    
    updates = []
    params = []
    param_count = 1
    
    if title:
        updates.append(f"title = ${param_count}")
        params.append(title)
        param_count += 1
    
    if video_url:
        updates.append(f"video_url = ${param_count}")
        params.append(video_url)
        param_count += 1
    
    if duration_seconds:
        updates.append(f"duration_seconds = ${param_count}")
        params.append(duration_seconds)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    params.append(template_id)
    
    query = f"""
        UPDATE video_templates
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING id, title, video_url, duration_seconds
    """
    
    template = await execute_one(query, *params)
    
    return {
        "message": "Video template updated successfully",
        "template": dict(template)
    }


@router.delete("/videos/templates/{template_id}")
async def delete_video_template(template_id: str):
    """Delete video template"""
    
    query = "DELETE FROM video_templates WHERE id = $1"
    await execute_write(query, template_id)
    
    return {"message": "Video template deleted successfully"}


# ============================================
# AVATAR MANAGEMENT
# ============================================

@router.get("/avatars")
async def get_all_avatars():
    """Get all avatar profiles"""
    
    query = """
        SELECT 
            ap.*,
            u.full_name as teacher_name,
            u.email as teacher_email
        FROM avatar_profiles ap
        JOIN users u ON ap.teacher_id = u.id
        ORDER BY u.full_name
    """
    
    avatars = await execute_query(query)
    return [dict(avatar) for avatar in avatars]


@router.post("/avatars")
async def create_avatar_profile(
    teacher_id: str,
    avatar_name: str,
    avatar_image_url: str,
    voice_profile: Optional[str] = None
):
    """Create avatar profile for teacher"""
    
    query = """
        INSERT INTO avatar_profiles (teacher_id, avatar_name, avatar_image_url, voice_profile)
        VALUES ($1, $2, $3, $4)
        RETURNING id, teacher_id, avatar_name, avatar_image_url
    """
    
    avatar = await execute_one(
        query,
        teacher_id,
        avatar_name,
        avatar_image_url,
        voice_profile
    )
    
    return {
        "message": "Avatar profile created successfully",
        "avatar": dict(avatar)
    }


# ============================================
# BULK DATA IMPORT
# ============================================

class BulkImportRequest(BaseModel):
    schools: Optional[List[dict]] = None
    branches: Optional[List[dict]] = None
    classes: Optional[List[dict]] = None
    students: Optional[List[dict]] = None
    subjects: Optional[List[dict]] = None
    topics: Optional[List[dict]] = None


@router.post("/import/bulk")
async def bulk_import_data(import_data: BulkImportRequest):
    """
    Bulk import schools, branches, classes, students, subjects, and topics
    """
    
    results = {
        "schools": 0,
        "branches": 0,
        "classes": 0,
        "students": 0,
        "subjects": 0,
        "topics": 0
    }
    
    # Import schools
    if import_data.schools:
        for school in import_data.schools:
            query = """
                INSERT INTO schools (name, address)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            """
            await execute_write(query, school.get("name"), school.get("address"))
            results["schools"] += 1
    
    # Import branches
    if import_data.branches:
        for branch in import_data.branches:
            query = """
                INSERT INTO branches (school_id, name, address)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                branch.get("school_id"),
                branch.get("name"),
                branch.get("address")
            )
            results["branches"] += 1
    
    # Import classes
    if import_data.classes:
        for cls in import_data.classes:
            query = """
                INSERT INTO classes (branch_id, name, grade_level, teacher_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                cls.get("branch_id"),
                cls.get("name"),
                cls.get("grade_level"),
                cls.get("teacher_id")
            )
            results["classes"] += 1
    
    # Import students
    if import_data.students:
        for student in import_data.students:
            query = """
                INSERT INTO users (email, full_name, role)
                VALUES ($1, $2, 'student')
                ON CONFLICT (email) DO NOTHING
            """
            await execute_write(
                query,
                student.get("email"),
                student.get("full_name")
            )
            results["students"] += 1
    
    # Import subjects
    if import_data.subjects:
        for subject in import_data.subjects:
            query = """
                INSERT INTO subjects (name, description, grade_level)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                subject.get("name"),
                subject.get("description"),
                subject.get("grade_level")
            )
            results["subjects"] += 1
    
    # Import topics
    if import_data.topics:
        for topic in import_data.topics:
            query = """
                INSERT INTO topics (subject_id, title, description, order_index)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                topic.get("subject_id"),
                topic.get("title"),
                topic.get("description"),
                topic.get("order_index")
            )
            results["topics"] += 1
    
    return {
        "message": "Bulk import completed",
        "imported_counts": results
    }


# ============================================
# SYSTEM CONFIGURATION
# ============================================

@router.get("/config/models")
async def get_model_configuration():
    """Get AI model configuration"""
    
    return {
        "qa_model": "claude-sonnet-4-20250514",
        "grading_model": "claude-haiku-4-20250514",
        "exam_generation_model": "claude-sonnet-4-20250514",
        "cache_enabled": True,
        "cache_timeout": 86400
    }


@router.get("/stats/system")
async def get_system_stats():
    """Get overall system statistics"""
    
    stats_query = """
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = true) as total_students,
            (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true) as total_teachers,
            (SELECT COUNT(*) FROM users WHERE role = 'manager' AND is_active = true) as total_managers,
            (SELECT COUNT(*) FROM schools) as total_schools,
            (SELECT COUNT(*) FROM branches) as total_branches,
            (SELECT COUNT(*) FROM classes) as total_classes,
            (SELECT COUNT(*) FROM subjects) as total_subjects,
            (SELECT COUNT(*) FROM topics) as total_topics,
            (SELECT COUNT(*) FROM video_templates) as total_video_templates,
            (SELECT COUNT(*) FROM published_videos) as total_published_videos,
            (SELECT COUNT(*) FROM quiz_banks) as total_questions,
            (SELECT COUNT(*) FROM quiz_attempts WHERE is_completed = true) as total_completed_quizzes,
            (SELECT COUNT(*) FROM student_questions) as total_student_questions
    """
    
    stats = await execute_one(stats_query)
    
    return dict(stats) if stats else {}


# ============================================
# AI CONTEXT TRAINING
# ============================================

class TrainModelRequest(BaseModel):
    scope: str = "all"  # all, subjects, topics, videos


@router.post("/ai/train")
async def train_model_context(request: TrainModelRequest):
    """
    Push curriculum data as context to Claude AI.
    This seeds the AI with school-specific knowledge (Option A: context injection).
    Does not fine-tune the underlying model.
    """

    scope = request.scope
    context_parts = []

    if scope in ("all", "subjects"):
        subjects = await execute_query(
            "SELECT name, description, grade_level FROM subjects ORDER BY grade_level, name"
        )
        if subjects:
            lines = "\n".join(
                f"- {s['name']} (Grade {s['grade_level']}): {s['description'] or ''}"
                for s in subjects
            )
            context_parts.append(f"## Subjects\n{lines}")

    if scope in ("all", "topics"):
        topics = await execute_query(
            """
            SELECT t.title, t.description, s.name as subject_name
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            ORDER BY s.name, t.order_index
            """
        )
        if topics:
            lines = "\n".join(
                f"- {t['title']} ({t['subject_name']}): {t['description'] or ''}"
                for t in topics
            )
            context_parts.append(f"## Topics\n{lines}")

    if scope in ("all", "videos"):
        videos = await execute_query(
            """
            SELECT vt.title, t.title as topic_title, s.name as subject_name
            FROM video_templates vt
            JOIN topics t ON vt.topic_id = t.id
            JOIN subjects s ON t.subject_id = s.id
            ORDER BY s.name, t.order_index
            """
        )
        if videos:
            lines = "\n".join(
                f"- {v['title']} | Topic: {v['topic_title']} | Subject: {v['subject_name']}"
                for v in videos
            )
            context_parts.append(f"## Video Lessons\n{lines}")

    if not context_parts:
        return {"message": "No curriculum data found to push.", "items_pushed": 0}

    full_context = "# School Curriculum Context\n\n" + "\n\n".join(context_parts)

    # Store the prepared context in cache so Claude AI functions can reference it
    from app.utils.cache import get_redis
    r = await get_redis()
    if r:
        await r.set("curriculum_context", full_context, ex=86400 * 30)  # 30 days

    return {
        "message": "Curriculum context pushed to AI successfully.",
        "scope": scope,
        "items_pushed": sum(len(p.split("\n")) for p in context_parts),
    }


# ============================================
# DESIGN TEMPLATES MANAGEMENT
# ============================================

class DesignTemplateRequest(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    layout_definitions: list  # Array of layout definitions with styling
    preview_image_url: Optional[str] = None
    is_active: bool = True


@router.post("/templates")
async def create_design_template(
    template_data: DesignTemplateRequest,
    admin_id: str,
):
    """Create new design template with layout definitions (admin only)"""
    import json as _json
    
    query = """
        INSERT INTO design_templates 
            (name, category, description, is_system, created_by, layout_definitions, preview_image_url)
        VALUES ($1, $2, $3, false, $4, $5, $6)
        RETURNING id, name, category, description, layout_definitions, preview_image_url
    """
    
    template = await execute_one(
        query,
        template_data.name,
        template_data.category,
        template_data.description,
        admin_id,
        _json.dumps(template_data.layout_definitions),
        template_data.preview_image_url,
    )
    
    if not template:
        raise HTTPException(status_code=400, detail="Failed to create template")
    
    data = dict(template)
    if data.get("layout_definitions") and isinstance(data["layout_definitions"], str):
        try:
            data["layout_definitions"] = _json.loads(data["layout_definitions"])
        except Exception:
            data["layout_definitions"] = []
    
    return {
        "message": "Design template created successfully",
        "template": data
    }


@router.put("/templates/{template_id}")
async def update_design_template(
    template_id: str,
    template_data: DesignTemplateRequest,
):
    """Update an existing design template"""
    import json as _json
    
    query = """
        UPDATE design_templates
        SET name = $1, category = $2, description = $3, layout_definitions = $4,
            preview_image_url = $5, is_active = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING id, name, category, description, layout_definitions, preview_image_url
    """
    
    template = await execute_one(
        query,
        template_data.name,
        template_data.category,
        template_data.description,
        _json.dumps(template_data.layout_definitions),
        template_data.preview_image_url,
        template_data.is_active,
        template_id,
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    data = dict(template)
    if data.get("layout_definitions") and isinstance(data["layout_definitions"], str):
        try:
            data["layout_definitions"] = _json.loads(data["layout_definitions"])
        except Exception:
            data["layout_definitions"] = []
    
    return {
        "message": "Design template updated successfully",
        "template": data
    }


@router.delete("/templates/{template_id}")
async def delete_design_template(template_id: str):
    """Delete a design template. Only custom templates can be deleted."""
    
    template = await execute_one(
        "SELECT id, is_system FROM design_templates WHERE id = $1",
        template_id,
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template["is_system"]:
        raise HTTPException(status_code=403, detail="Cannot delete built-in system templates")
    
    # Remove associations
    await execute_write(
        "DELETE FROM topic_templates WHERE design_template_id = $1",
        template_id,
    )
    
    # Delete template
    await execute_write(
        "DELETE FROM design_templates WHERE id = $1",
        template_id,
    )
    
    return {"message": "Design template deleted successfully"}


@router.post("/templates/{template_id}/apply")
async def apply_template_to_topic(template_id: str, topic_id: str = None):
    """Apply a design template to a topic - converts existing slides to template design"""
    import json as _json
    
    if not topic_id:
        raise HTTPException(status_code=400, detail="topic_id is required")
    
    # Verify template exists
    template = await execute_one(
        "SELECT id, layout_definitions FROM design_templates WHERE id = $1",
        template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify topic exists and get its slides
    topic = await execute_one(
        "SELECT id, slides_json FROM topics WHERE id = $1",
        topic_id,
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get the slides
    slides = []
    if topic.get("slides_json"):
        try:
            slides = _json.loads(topic["slides_json"]) if isinstance(topic["slides_json"], str) else topic["slides_json"]
        except Exception:
            slides = []
    
    # Get template's layout definitions
    layout_defs = template.get("layout_definitions")
    if isinstance(layout_defs, str):
        try:
            layout_defs = _json.loads(layout_defs)
        except Exception:
            layout_defs = []
    
    # Convert slides to template design
    converted_slides = convert_slides_to_template(slides, layout_defs)
    
    # Save converted slides back
    await execute_write(
        "UPDATE topics SET slides_json = $1, updated_at = NOW() WHERE id = $2",
        _json.dumps(converted_slides),
        topic_id,
    )
    
    # Create/update topic_templates association
    await execute_write(
        """
        INSERT INTO topic_templates (topic_id, design_template_id)
        VALUES ($1, $2)
        ON CONFLICT (topic_id) DO UPDATE SET design_template_id = $2, applied_at = NOW()
        """,
        topic_id,
        template_id,
    )
    
    # Increment usage count
    await execute_write(
        "UPDATE design_templates SET usage_count = usage_count + 1 WHERE id = $1",
        template_id,
    )
    
    return {
        "message": "Template applied and slides converted successfully",
        "converted_slides": converted_slides,
        "slides_count": len(converted_slides),
    }


def convert_slides_to_template(slides: list, layout_definitions: list) -> list:
    """
    Convert existing slides to match template design.
    Applies template styling to slides while preserving content.
    """
    if not slides or not layout_definitions:
        return slides
    
    converted = []
    
    for slide in slides:
        converted_slide = dict(slide)  # Copy original slide
        slide_type = slide.get("type", "content")
        
        # Find matching layout definition for this slide type
        matching_layout = next(
            (l for l in layout_definitions if l.get("id") == slide_type),
            layout_definitions[0]  # Default to first layout if no match
        )
        
        # Apply template styling to the slide
        if matching_layout:
            converted_slide["type"] = matching_layout.get("id")
            converted_slide["template_styling"] = {
                "bg": matching_layout.get("bg"),
                "title_style": matching_layout.get("title_style"),
                "content_style": matching_layout.get("content_style"),
                "accent": matching_layout.get("accent"),
            }
        
        converted.append(converted_slide)
    
    return converted


@router.post("/templates/seed")
async def seed_default_templates():
    """
    Seed the database with beautiful pre-built templates organized by category.
    """
    import json as _json
    
    # Pre-built templates with complete layout definitions
    default_templates = [
        # SCIENCE TEMPLATES
        {
            "name": "Scientific Method",
            "category": "science",
            "description": "Perfect for biology, chemistry, physics lessons with scientific layouts",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0891b2 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#38bdf8"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#38bdf8",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "linear-gradient(to bottom, #ffffff 0%, #f0f9ff 100%)",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#0369a1"},
                    "content_style": {"fontSize": "1rem", "color": "#1e293b"},
                    "accent": "#0891b2",
                },
                {
                    "id": "bullet",
                    "name": "Bullet Points",
                    "bg": "#ffffff",
                    "bullet_icon": "→",
                    "bullet_color": "#0891b2",
                    "accent": "#38bdf8",
                },
            ]
        },
        # COMPUTER SCIENCE TEMPLATES
        {
            "name": "Tech Minimal",
            "category": "computer",
            "description": "Modern, minimal design for IT and programming lessons",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #020617 0%, #1e1b4b 55%, #312e81 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#818cf8"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.7)"},
                    "accent": "#818cf8",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#ffffff",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#312e81"},
                    "content_style": {"fontSize": "0.95rem", "color": "#1e293b", "fontFamily": "monospace"},
                    "accent": "#818cf8",
                },
            ]
        },
        # MATHEMATICS TEMPLATES
        {
            "name": "Math Pro",
            "category": "math",
            "description": "Clean design with equation support for mathematics and statistics",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #1c1917 0%, #9a3412 55%, #ea580c 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#fb923c"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#fb923c",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#fafaf9",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#9a3412"},
                    "content_style": {"fontSize": "1rem", "color": "#1c1917", "fontFamily": "serif"},
                    "accent": "#ea580c",
                },
            ]
        },
        # LANGUAGE TEMPLATES
        {
            "name": "Language Arts",
            "category": "language",
            "description": "Elegant design for literature, languages, and writing",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #4c0519 0%, #be123c 55%, #e11d48 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#fda4af"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#fda4af",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#fff7ed",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#be123c"},
                    "content_style": {"fontSize": "1rem", "color": "#1f2937", "fontFamily": "serif"},
                    "accent": "#e11d48",
                },
            ]
        },
        # SOCIAL STUDIES TEMPLATES
        {
            "name": "Social Studies",
            "category": "social_studies",
            "description": "Engaging design for history, geography, and social sciences",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #052e16 0%, #166534 55%, #15803d 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#4ade80"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#4ade80",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#f0fdf4",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#166534"},
                    "content_style": {"fontSize": "1rem", "color": "#1f2937"},
                    "accent": "#15803d",
                },
            ]
        },
        # ARTS TEMPLATES
        {
            "name": "Creative Arts",
            "category": "arts",
            "description": "Vibrant, creative design for music, visual arts, theater",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #2e1065 0%, #6d28d9 55%, #c026d3 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#e879f9"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#e879f9",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#faf5ff",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#6d28d9"},
                    "content_style": {"fontSize": "1rem", "color": "#1f2937"},
                    "accent": "#c026d3",
                },
            ]
        },
        # GENERAL TEMPLATE
        {
            "name": "General Purpose",
            "category": "general",
            "description": "Versatile, neutral design suitable for any subject",
            "layout_definitions": [
                {
                    "id": "title",
                    "name": "Title Slide",
                    "bg": "linear-gradient(135deg, #1f2937 0%, #374151 55%, #4b5563 100%)",
                    "title_style": {"fontSize": "3.5rem", "fontWeight": "bold", "color": "#ffffff"},
                    "subtitle_style": {"fontSize": "1.5rem", "color": "rgba(255,255,255,0.8)"},
                    "accent": "#60a5fa",
                },
                {
                    "id": "content",
                    "name": "Content Slide",
                    "bg": "#ffffff",
                    "title_style": {"fontSize": "2rem", "fontWeight": "bold", "color": "#1f2937"},
                    "content_style": {"fontSize": "1rem", "color": "#374151"},
                    "accent": "#3b82f6",
                },
            ]
        },
    ]
    
    created = 0
    for tmpl in default_templates:
        existing = await execute_one(
            "SELECT id FROM design_templates WHERE name = $1",
            tmpl["name"],
        )
        if not existing:
            await execute_write(
                """
                INSERT INTO design_templates 
                    (name, category, description, is_system, layout_definitions)
                VALUES ($1, $2, $3, true, $4)
                """,
                tmpl["name"],
                tmpl["category"],
                tmpl["description"],
                _json.dumps(tmpl["layout_definitions"]),
            )
            created += 1
    
    return {
        "message": f"Seeded {created} design templates",
        "templates_created": created,
        "templates_already_exist": len(default_templates) - created,
    }


class TeacherClassAssignmentBody(BaseModel):
    class_id: str


@router.get("/teachers/{teacher_id}/class-assignments")
async def list_teacher_class_assignments(teacher_id: str):
    """Sections/classes assigned to a teacher (in addition to classes.teacher_id)."""
    from app.routers.homework import ensure_homework_schema

    await ensure_homework_schema()
    teacher = await execute_one(
        "SELECT id, role FROM users WHERE id = $1::uuid AND role = 'teacher'",
        teacher_id,
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    rows = await execute_query(
        """
        SELECT c.id, c.name, c.grade_level, c.section, b.name AS branch_name, s.name AS school_name
        FROM teacher_class_assignments tca
        JOIN classes c ON c.id = tca.class_id
        JOIN branches b ON b.id = c.branch_id
        JOIN schools s ON s.id = b.school_id
        WHERE tca.teacher_id = $1::uuid
        ORDER BY c.grade_level NULLS LAST, c.section NULLS LAST, c.name
        """,
        teacher_id,
    )
    primary = await execute_query(
        """
        SELECT c.id, c.name, c.grade_level, c.section, b.name AS branch_name, s.name AS school_name
        FROM classes c
        JOIN branches b ON b.id = c.branch_id
        JOIN schools s ON s.id = b.school_id
        WHERE c.teacher_id = $1::uuid
        ORDER BY c.grade_level NULLS LAST, c.section NULLS LAST, c.name
        """,
        teacher_id,
    )
    return {
        "assigned_via_admin": [dict(r) for r in rows],
        "primary_teacher_of": [dict(r) for r in primary],
    }


@router.post("/teachers/{teacher_id}/class-assignments")
async def add_teacher_class_assignment(
    teacher_id: str, body: TeacherClassAssignmentBody
):
    from app.routers.homework import ensure_homework_schema

    await ensure_homework_schema()
    teacher = await execute_one(
        "SELECT id FROM users WHERE id = $1::uuid AND role = 'teacher'",
        teacher_id,
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    cls = await execute_one("SELECT id FROM classes WHERE id = $1::uuid", body.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    await execute_write(
        """
        INSERT INTO teacher_class_assignments (teacher_id, class_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT (teacher_id, class_id) DO NOTHING
        """,
        teacher_id,
        body.class_id,
    )
    return {"ok": True}


@router.delete("/teachers/{teacher_id}/class-assignments/{class_id}")
async def remove_teacher_class_assignment(teacher_id: str, class_id: str):
    from app.routers.homework import ensure_homework_schema

    await ensure_homework_schema()
    await execute_write(
        """
        DELETE FROM teacher_class_assignments
        WHERE teacher_id = $1::uuid AND class_id = $2::uuid
        """,
        teacher_id,
        class_id,
    )
    return {"ok": True}


# Admin has access to all teacher and manager routes
# The frontend should include those menu items for admin role
