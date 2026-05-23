"""
Manager Portal Routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid as uuid_lib
import csv
import io
import re

from app.utils.database import execute_query, execute_one, execute_write
from app.routers.auth import get_user_from_token
from app.utils.auth import hash_password
from app.utils.security import generate_secure_token
from app.config import settings
from app.utils.bulk_imports import (
    STUDENT_IMPORT_HEADERS,
    TEACHER_IMPORT_HEADERS,
    build_template_bytes,
    normalize_phone,
    normalize_text,
    parse_upload_rows,
)

router = APIRouter()


# ============================================
# REQUEST MODELS
# ============================================

class CreateTeacherRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    branch_id: Optional[str] = None
    designation: Optional[str] = None
    contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    employment_status: Optional[str] = None
    date_of_joining: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[int] = None
    languages: Optional[str] = None


class UpdateTeacherRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    branch_id: Optional[str] = None
    designation: Optional[str] = None
    contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    employment_status: Optional[str] = None
    date_of_joining: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[int] = None
    languages: Optional[str] = None


class AssignTeacherClassRequest(BaseModel):
    class_id: str


class TeacherCurriculumRow(BaseModel):
    branch_id: Optional[str] = None
    class_id: str
    library_board_id: Optional[str] = None
    library_subject_id: Optional[str] = None
    library_book_id: Optional[str] = None
    school_id: Optional[str] = None


class SaveTeacherAssignmentsRequest(BaseModel):
    teacher_curriculum_assignments: Optional[List[TeacherCurriculumRow]] = None
    assigned_classes: Optional[List[str]] = None


class BulkDeleteTeachersRequest(BaseModel):
    teacher_ids: list[str]


class CreateClassRequest(BaseModel):
    branch_id: str
    name: str
    grade_level: Optional[str] = None
    section: Optional[str] = None


class ManagerCreateUserRequest(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    role: str
    school_id: Optional[str] = None
    branch_id: Optional[str] = None


def require_manager(current_user: dict = Depends(get_user_from_token)):
    if current_user.get("role") not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user


def _assert_school_access(user: dict, school_id: str):
    """Managers are limited to own school; admins are limited to own tenant."""
    if user.get("role") == "manager":
        if str(user.get("school_id", "")) != str(school_id):
            raise HTTPException(status_code=403, detail="Access denied to this school")


async def _assert_tenant_access(user: dict, target_tenant_id: Optional[str]):
    if user.get("role") == "admin":
        current_tenant = str(user.get("tenant_id") or "")
        if not current_tenant or str(target_tenant_id or "") != current_tenant:
            raise HTTPException(status_code=403, detail="Access denied to this tenant")


async def _assert_user_access(user: dict, target_user_id: str):
    target = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid",
        target_user_id,
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "manager":
        if str(user.get("school_id") or "") != str(target.get("school_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this user")
    await _assert_tenant_access(user, target.get("tenant_id"))
    return target


def _default_import_password() -> str:
    password = (settings.IMPORT_DEFAULT_PASSWORD or "").strip()
    if not password:
        raise HTTPException(
            status_code=500,
            detail="IMPORT_DEFAULT_PASSWORD is not configured.",
        )
    return password


def _generate_temporary_password() -> str:
    return f"Tmp-{generate_secure_token(8)}-A1!"


def _parse_import_date(value: object) -> Optional[date]:
    text = normalize_text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except Exception:
            continue
    try:
        return date.fromisoformat(text)
    except Exception:
        return None


def _parse_academic_session(value: str):
    normalized = (value or "").strip().replace("–", "-").replace("—", "-")
    if not normalized or not re.fullmatch(r"\d{4}-\d{4}", normalized):
        raise HTTPException(status_code=400, detail="Academic session must be in YYYY-YYYY format")
    y1, y2 = map(int, normalized.split("-"))
    if y2 != y1 + 1:
        raise HTTPException(status_code=400, detail="Academic session must use consecutive years")
    return normalized


def _mgr_none_if_blank(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _mgr_extract_grade_number(value) -> Optional[int]:
    if not value:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def _mgr_parse_date(value) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value).strip())
    except Exception:
        return None


async def _mgr_get_active_enrollment(student_id: str):
    return await execute_one(
        """SELECT e.id, e.class_id, e.academic_session, e.status, c.branch_id, c.grade_level, c.section
           FROM enrollments e
           JOIN classes c ON c.id = e.class_id
           WHERE e.student_id = $1 AND e.is_active = true
           ORDER BY e.enrolled_at DESC LIMIT 1""",
        student_id,
    )


async def _mgr_activate_enrollment(student_id: str, class_id: str, academic_session: str, notes=None):
    existing = await execute_one(
        "SELECT id FROM enrollments WHERE student_id = $1 AND class_id = $2::uuid",
        student_id, class_id,
    )
    if existing:
        await execute_write(
            """UPDATE enrollments SET academic_session = $1, status = 'active', is_active = true,
               notes = $2, completed_at = NULL WHERE id = $3""",
            academic_session, _mgr_none_if_blank(notes), existing["id"],
        )
    else:
        await execute_write(
            """INSERT INTO enrollments (student_id, class_id, academic_session, status, is_active, notes)
               VALUES ($1, $2::uuid, $3, 'active', true, $4)""",
            student_id, class_id, academic_session, _mgr_none_if_blank(notes),
        )


async def _mgr_check_student_access(current_user: dict, student_id: str):
    student = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'student'",
        student_id,
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.get("role") == "manager":
        if str(current_user.get("school_id") or "") != str(student.get("school_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")
    else:
        if str(current_user.get("tenant_id") or "") != str(student.get("tenant_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")
    return student


@router.post("/users")
async def create_scoped_user(
    body: ManagerCreateUserRequest,
    current_user: dict = Depends(require_manager),
):
    """Create a user scoped to manager/admin accessible school and tenant."""
    role = normalize_text(body.role).lower()
    allowed_roles = {"teacher", "student", "manager"}
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Role must be teacher, student, or manager")

    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant context missing")

    school_id = None
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
        if not school_id:
            raise HTTPException(status_code=403, detail="Manager school context missing")
        if body.school_id and str(body.school_id) != school_id:
            raise HTTPException(status_code=403, detail="Access denied to this school")
    else:
        school_id = normalize_text(body.school_id)
        if not school_id:
            raise HTTPException(status_code=400, detail="school_id is required")

    school = await execute_one(
        "SELECT id, tenant_id FROM schools WHERE id = $1::uuid",
        school_id,
    )
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    await _assert_tenant_access(current_user, school.get("tenant_id"))

    branch_id = normalize_text(body.branch_id)
    if branch_id:
        branch = await execute_one(
            "SELECT id, school_id, tenant_id FROM branches WHERE id = $1::uuid",
            branch_id,
        )
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
        if str(branch.get("school_id")) != str(school_id):
            raise HTTPException(status_code=400, detail="Branch does not belong to selected school")
    else:
        branch_id = None

    full_name = normalize_text(body.full_name)
    if not full_name:
        raise HTTPException(status_code=400, detail="full_name is required")

    email = normalize_text(body.email)
    if not email:
        slug = full_name.lower().replace(" ", "_")
        domain = "student.school" if role == "student" else "staff.school"
        email = f"{slug}@{domain}"

    existing = await execute_one("SELECT id FROM users WHERE email = $1", email)
    if existing:
        raise HTTPException(status_code=400, detail=f"Email {email} is already registered")

    temporary_password = _generate_temporary_password()
    user = await execute_one(
        """
        INSERT INTO users (email, full_name, role, tenant_id, school_id, branch_id, password_hash, must_change_password, is_active)
        VALUES ($1, $2, $3::user_role, $4::uuid, $5::uuid, $6::uuid, $7, true, true)
        RETURNING id, email, full_name, role, tenant_id, school_id, branch_id, must_change_password
        """,
        email,
        full_name,
        role,
        tenant_id,
        school_id,
        branch_id,
        hash_password(temporary_password),
    )

    return {
        "message": "User created successfully",
        "user": dict(user),
        "temporary_password": temporary_password,
        "must_change_password": True,
    }


@router.get("/users")
async def get_scoped_users(
    role: Optional[str] = None,
    school_id: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """List users in manager/admin scope for settings user table."""
    where_clauses: list[str] = ["u.role::text <> 'super_admin'"]
    params: list = []

    if current_user.get("role") == "manager":
        manager_school_id = str(current_user.get("school_id") or "")
        if not manager_school_id:
            return []
        if school_id and str(school_id) != manager_school_id:
            raise HTTPException(status_code=403, detail="Access denied to this school")
        params.append(manager_school_id)
        where_clauses.append(f"u.school_id = ${len(params)}::uuid")
    else:
        tenant_id = str(current_user.get("tenant_id") or "")
        if not tenant_id:
            return []
        params.append(tenant_id)
        where_clauses.append(f"u.tenant_id = ${len(params)}::uuid")
        if school_id:
            params.append(str(school_id))
            where_clauses.append(f"u.school_id = ${len(params)}::uuid")

    if role:
        params.append(str(role).strip().lower())
        where_clauses.append(f"u.role::text = ${len(params)}")

    query = f"""
        SELECT
            u.id,
            u.full_name,
            u.email,
            u.role,
            u.is_active,
            u.school_id,
            s.name AS school_name,
            u.branch_id,
            b.name AS branch_name,
            u.created_at
        FROM users u
        LEFT JOIN schools s ON s.id = u.school_id
        LEFT JOIN branches b ON b.id = u.branch_id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY u.created_at DESC, u.full_name
    """
    rows = await execute_query(query, *params)
    return [dict(r) for r in rows]


@router.delete("/users/{user_id}")
async def deactivate_scoped_user(
    user_id: str,
    current_user: dict = Depends(require_manager),
):
    if str(current_user.get("user_id") or "") == str(user_id):
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    await _assert_user_access(current_user, user_id)
    await execute_write(
        "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1::uuid",
        user_id,
    )
    return {"message": "User deactivated successfully"}


@router.post("/users/{user_id}/activate")
async def activate_scoped_user(
    user_id: str,
    current_user: dict = Depends(require_manager),
):
    await _assert_user_access(current_user, user_id)
    await execute_write(
        "UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1::uuid",
        user_id,
    )
    return {"message": "User activated successfully"}


@router.post("/users/{user_id}/temporary-password")
async def set_scoped_temporary_password(
    user_id: str,
    current_user: dict = Depends(require_manager),
):
    await _assert_user_access(current_user, user_id)

    user = await execute_one(
        "SELECT id, email, full_name FROM users WHERE id = $1::uuid",
        user_id,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temporary_password = _generate_temporary_password()
    await execute_write(
        """
        UPDATE users
        SET password_hash = $1,
            must_change_password = true,
            is_active = true,
            updated_at = NOW()
        WHERE id = $2::uuid
        """,
        hash_password(temporary_password),
        user_id,
    )

    return {
        "message": "Temporary password assigned successfully",
        "user": {
            "id": str(user["id"]),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
        },
        "temporary_password": temporary_password,
        "must_change_password": True,
    }


# ============================================
# SCHOOL & BRANCH MANAGEMENT
# ============================================

@router.get("/schools")
async def get_all_schools(current_user: dict = Depends(require_manager)):
    """Get schools accessible to this manager (admins see all, managers see their own)."""
    if current_user.get("role") == "admin":
        where = "WHERE s.tenant_id = $1::uuid"
        params: list = [current_user.get("tenant_id")]
    else:
        school_id = current_user.get("school_id")
        if not school_id:
            return []
        where = "WHERE s.id = $1"
        params = [school_id]

    query = f"""
        SELECT
            s.id, s.name, s.address,
            COUNT(DISTINCT b.id) as branch_count,
            COUNT(DISTINCT c.id) as class_count,
            mgr.full_name as manager_name, mgr.email as manager_email
        FROM schools s
        LEFT JOIN branches b ON s.id = b.school_id
        LEFT JOIN classes c ON b.id = c.branch_id
        LEFT JOIN users mgr ON mgr.school_id = s.id AND mgr.role = 'manager'
        {where}
        GROUP BY s.id, s.name, s.address, mgr.full_name, mgr.email
        ORDER BY s.name
    """
    schools = await execute_query(query, *params)
    return [dict(s) for s in schools]


@router.get("/schools/{school_id}/branches")
async def get_school_branches(school_id: str, current_user: dict = Depends(require_manager)):
    """Get all branches for a school (scoped to manager's school)."""
    _assert_school_access(current_user, school_id)
    school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    await _assert_tenant_access(current_user, school.get("tenant_id"))

    query = """
        SELECT
            b.id, b.name, b.address,
            COUNT(DISTINCT c.id) as class_count,
            COUNT(DISTINCT e.student_id) as student_count
        FROM branches b
        LEFT JOIN classes c ON b.id = c.branch_id
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        WHERE b.school_id = $1
        GROUP BY b.id, b.name, b.address
        ORDER BY b.name
    """
    branches = await execute_query(query, school_id)
    return [dict(b) for b in branches]


# ============================================
# TEACHER MANAGEMENT
# ============================================

@router.get("/teachers")
async def get_school_teachers(current_user: dict = Depends(require_manager)):
    """List all teachers in manager's school."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None

    if school_id:
        teachers = await execute_query(
            """SELECT u.id, u.full_name, u.email, u.is_active, u.branch_id,
                      COALESCE(u.designation, tp.designation) as designation,
                      COALESCE(u.contact, tp.contact) as contact,
                      COALESCE(u.emergency_contact, tp.emergency_contact) as emergency_contact,
                      COALESCE(u.employment_status, tp.employment_status) as employment_status,
                      COALESCE(u.date_of_joining, tp.date_of_joining) as date_of_joining,
                      COALESCE(u.qualifications, tp.qualifications) as qualifications,
                      COALESCE(u.experience_years, tp.experience_years) as experience_years,
                      COALESCE(u.languages, tp.languages) as languages,
                      s.name as school_name, b.name as branch_name,
                      COUNT(DISTINCT c.id) as class_count
               FROM users u
               LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
               LEFT JOIN schools s ON s.id = u.school_id
               LEFT JOIN branches b ON b.id = u.branch_id
               LEFT JOIN classes c ON c.teacher_id = u.id OR c.id IN (
                   SELECT class_id FROM teacher_class_assignments WHERE teacher_id = u.id
               ) OR c.id IN (
                   SELECT class_id FROM teacher_class_subject_assignments WHERE teacher_id = u.id
               )
               WHERE u.role = 'teacher' AND u.school_id = $1
               GROUP BY u.id, u.full_name, u.email, u.is_active, u.branch_id,
                        u.designation, tp.designation, u.contact, tp.contact,
                        u.emergency_contact, tp.emergency_contact, u.employment_status, tp.employment_status,
                        u.date_of_joining, tp.date_of_joining, u.qualifications, tp.qualifications,
                        u.experience_years, tp.experience_years, u.languages, tp.languages,
                        s.name, b.name
               ORDER BY u.full_name""",
            school_id,
        )
    else:
        teachers = await execute_query(
            """SELECT u.id, u.full_name, u.email, u.is_active, u.branch_id,
                      COALESCE(u.designation, tp.designation) as designation,
                      COALESCE(u.contact, tp.contact) as contact,
                      COALESCE(u.emergency_contact, tp.emergency_contact) as emergency_contact,
                      COALESCE(u.employment_status, tp.employment_status) as employment_status,
                      COALESCE(u.date_of_joining, tp.date_of_joining) as date_of_joining,
                      COALESCE(u.qualifications, tp.qualifications) as qualifications,
                      COALESCE(u.experience_years, tp.experience_years) as experience_years,
                      COALESCE(u.languages, tp.languages) as languages,
                      s.name as school_name, b.name as branch_name,
                      COUNT(DISTINCT c.id) as class_count
               FROM users u
               LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
               LEFT JOIN schools s ON s.id = u.school_id
               LEFT JOIN branches b ON b.id = u.branch_id
               LEFT JOIN classes c ON c.teacher_id = u.id OR c.id IN (
                   SELECT class_id FROM teacher_class_assignments WHERE teacher_id = u.id
               ) OR c.id IN (
                   SELECT class_id FROM teacher_class_subject_assignments WHERE teacher_id = u.id
               )
               WHERE u.role = 'teacher' AND u.tenant_id = $1::uuid
               GROUP BY u.id, u.full_name, u.email, u.is_active, u.branch_id,
                        u.designation, tp.designation, u.contact, tp.contact,
                        u.emergency_contact, tp.emergency_contact, u.employment_status, tp.employment_status,
                        u.date_of_joining, tp.date_of_joining, u.qualifications, tp.qualifications,
                        u.experience_years, tp.experience_years, u.languages, tp.languages,
                        s.name, b.name
               ORDER BY u.full_name""",
            current_user.get("tenant_id"),
        )
    return [dict(t) for t in teachers]


@router.post("/teachers")
async def create_school_teacher(body: CreateTeacherRequest, current_user: dict = Depends(require_manager)):
    """Create a teacher account in the manager's school."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")

    existing = await execute_one("SELECT id FROM users WHERE email = $1", body.email)
    if existing:
        raise HTTPException(status_code=400, detail=f"Email {body.email} is already registered")

    branch = None
    if body.branch_id:
        branch = await execute_one("SELECT school_id, tenant_id FROM branches WHERE id = $1::uuid", body.branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
        if school_id and str(branch["school_id"]) != str(school_id):
            raise HTTPException(status_code=403, detail="Branch does not belong to your school")
        if current_user.get("role") == "admin":
            school_id = str(branch["school_id"])

    if current_user.get("role") == "admin" and not school_id:
        raise HTTPException(status_code=400, detail="Admin must provide branch_id to derive school context")

    teacher = await execute_one(
          """INSERT INTO users (id, email, full_name, password_hash, role, tenant_id, school_id, branch_id, is_active,
                             designation, contact, emergency_contact, employment_status, date_of_joining,
                             qualifications, experience_years, languages)
              VALUES ($1, $2, $3, $4, 'teacher', $5::uuid, $6, $7, true, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id, email, full_name, role, school_id, branch_id""",
        str(uuid_lib.uuid4()), body.email, body.full_name, hash_password(body.password),
          tenant_id, school_id, body.branch_id or None, body.designation, body.contact, body.emergency_contact,
        body.employment_status, body.date_of_joining, body.qualifications, body.experience_years, body.languages,
    )
    return {**dict(teacher), "plain_password": body.password}


@router.get("/teachers/import-template")
async def download_manager_teacher_template(current_user: dict = Depends(require_manager)):
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")

    if school_id:
        school_rows = await execute_query("SELECT name FROM schools WHERE id = $1::uuid", school_id)
        branch_rows = await execute_query(
            "SELECT name FROM branches WHERE school_id = $1::uuid ORDER BY name",
            school_id,
        )
    else:
        school_rows = await execute_query(
            "SELECT name FROM schools WHERE tenant_id = $1::uuid ORDER BY name",
            tenant_id,
        )
        branch_rows = await execute_query(
            """
            SELECT b.name
            FROM branches b
            JOIN schools s ON s.id = b.school_id
            WHERE s.tenant_id = $1::uuid
            ORDER BY b.name
            """,
            tenant_id,
        )

    allowed_values = {
        "school_name": [str(r["name"]) for r in school_rows],
        "branch_name": [str(r["name"]) for r in branch_rows],
        "designation": [
            "pre_school_teacher",
            "junior_school_teacher",
            "middle_school_teacher",
            "senior_school_teacher",
            "o_level_faculty",
            "a_level_faculty",
            "coordinator",
            "academic_head",
        ],
        "employment_status": ["active", "on_leave", "resigned"],
    }
    sample_rows = [["", "John Doe", "john.teacher@school.com", "TCH-1001", "Main Branch", "senior_school_teacher", "2025-01-15", "active", "B.Ed", "4", "+921234567890", "+921234567891", "English, Urdu", ""]]
    payload = build_template_bytes(TEACHER_IMPORT_HEADERS, allowed_values, sample_rows)
    return StreamingResponse(
        iter([payload]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=teacher_import_template.xlsx"},
    )


@router.post("/import-teachers")
async def import_teachers_from_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_manager),
):
    """Import teachers from CSV/Excel file using default env password."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")
    rows, headers = await parse_upload_rows(file)
    required = ["full_name", "school_name"] if current_user.get("role") == "admin" else ["full_name"]
    missing = [h for h in required if h not in headers]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    default_password_hash = hash_password(_default_import_password())
    success_count = 0
    errors: List[str] = []

    for idx, row in enumerate(rows, start=2):
        try:
            full_name = normalize_text(row.get("full_name"))
            if not full_name:
                raise HTTPException(status_code=400, detail="full_name is required")

            target_school_id = school_id
            if current_user.get("role") == "admin":
                school_name = normalize_text(row.get("school_name"))
                school = await execute_one(
                    """
                    SELECT id, tenant_id
                    FROM schools
                      WHERE LOWER(TRIM(REGEXP_REPLACE(REPLACE(name, CHR(160), ' '), '\s+', ' ', 'g')))
                          = LOWER(TRIM(REGEXP_REPLACE(REPLACE($1, CHR(160), ' '), '\s+', ' ', 'g')))
                      AND tenant_id = $2::uuid
                    """,
                    school_name,
                    tenant_id,
                )
                if not school:
                    raise HTTPException(status_code=400, detail=f"School not found: {school_name}")
                target_school_id = str(school["id"])

            if not target_school_id:
                raise HTTPException(status_code=400, detail="Unable to resolve school for row")

            email = normalize_text(row.get("email"))
            employee_id = normalize_text(row.get("employee_id"))
            if not email:
                seed = employee_id or full_name.lower().replace(" ", "_")
                email = f"{seed.lower()}@staff.school"

            existing = await execute_one("SELECT id FROM users WHERE email = $1", email)
            if existing:
                raise HTTPException(status_code=400, detail=f"Email already exists: {email}")

            branch_id = None
            branch_name = normalize_text(row.get("branch_name"))
            if branch_name:
                branch = await execute_one(
                    """
                    SELECT id
                    FROM branches
                      WHERE LOWER(TRIM(REGEXP_REPLACE(REPLACE(name, CHR(160), ' '), '\s+', ' ', 'g')))
                          = LOWER(TRIM(REGEXP_REPLACE(REPLACE($1, CHR(160), ' '), '\s+', ' ', 'g')))
                      AND school_id = $2::uuid
                    """,
                    branch_name,
                    target_school_id,
                )
                if not branch:
                    raise HTTPException(status_code=400, detail=f"Branch not found in school: {branch_name}")
                branch_id = str(branch["id"])

            teacher_id = str(uuid_lib.uuid4())
            await execute_write(
                """
                INSERT INTO users (
                    id, email, full_name, password_hash, role, tenant_id, school_id, branch_id,
                    is_active, must_change_password, designation, contact, emergency_contact,
                    employment_status, date_of_joining, qualifications, experience_years, languages
                )
                VALUES (
                    $1::uuid, $2, $3, $4, 'teacher', $5::uuid, $6::uuid, $7::uuid,
                    true, true, $8, $9, $10, $11, $12::date, $13, $14, $15
                )
                """,
                teacher_id,
                email,
                full_name,
                default_password_hash,
                tenant_id,
                target_school_id,
                branch_id,
                normalize_text(row.get("designation")) or None,
                normalize_phone(row.get("contact")) or None,
                normalize_phone(row.get("emergency_contact")) or None,
                normalize_text(row.get("employment_status")) or None,
                _parse_import_date(row.get("date_of_joining")),
                normalize_text(row.get("qualifications")) or None,
                int(normalize_text(row.get("experience_years"))) if normalize_text(row.get("experience_years")) else None,
                normalize_text(row.get("languages")) or None,
            )

            success_count += 1
        except Exception as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            errors.append(f"Row {idx}: {message}")

    return {
        "success_count": success_count,
        "error_count": len(errors),
        "errors": errors[:50],
        "default_password": "Configured via IMPORT_DEFAULT_PASSWORD",
    }


@router.get("/students/import-template")
async def download_manager_student_template(current_user: dict = Depends(require_manager)):
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")

    if school_id:
        school_rows = await execute_query("SELECT name FROM schools WHERE id = $1::uuid", school_id)
        branch_rows = await execute_query(
            "SELECT name FROM branches WHERE school_id = $1::uuid ORDER BY name",
            school_id,
        )
        class_rows = await execute_query(
            """
            SELECT c.name
            FROM classes c
            JOIN branches b ON b.id = c.branch_id
            WHERE b.school_id = $1::uuid
            ORDER BY c.name
            """,
            school_id,
        )
    else:
        school_rows = await execute_query(
            "SELECT name FROM schools WHERE tenant_id = $1::uuid ORDER BY name",
            tenant_id,
        )
        branch_rows = await execute_query(
            """
            SELECT b.name
            FROM branches b
            JOIN schools s ON s.id = b.school_id
            WHERE s.tenant_id = $1::uuid
            ORDER BY b.name
            """,
            tenant_id,
        )
        class_rows = await execute_query(
            """
            SELECT c.name
            FROM classes c
            JOIN branches b ON b.id = c.branch_id
            JOIN schools s ON s.id = b.school_id
            WHERE s.tenant_id = $1::uuid
            ORDER BY c.name
            """,
            tenant_id,
        )

    allowed_values = {
        "school_name": [str(r["name"]) for r in school_rows],
        "branch_name": [str(r["name"]) for r in branch_rows],
        "class_name": [str(r["name"]) for r in class_rows],
        "gender": ["male", "female", "other"],
    }
    sample_rows = [["", "Sara Khan", "", "STD-2201", "Main Branch", "Class 5 - A", "2025-2026", "A", "2014-02-20", "female", "", "Ali Khan", "+923001112233", "+923001112244", "", ""]]
    payload = build_template_bytes(STUDENT_IMPORT_HEADERS, allowed_values, sample_rows)
    return StreamingResponse(
        iter([payload]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_import_template.xlsx"},
    )


@router.post("/import-students")
async def import_students_from_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_manager),
):
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")
    rows, headers = await parse_upload_rows(file)
    required = ["full_name", "branch_name", "class_name", "academic_session"]
    if current_user.get("role") == "admin":
        required.append("school_name")
    missing = [h for h in required if h not in headers]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    default_password_hash = hash_password(_default_import_password())
    success_count = 0
    errors: List[str] = []

    for idx, row in enumerate(rows, start=2):
        try:
            full_name = normalize_text(row.get("full_name"))
            if not full_name:
                raise HTTPException(status_code=400, detail="full_name is required")

            target_school_id = school_id
            if current_user.get("role") == "admin":
                school_name = normalize_text(row.get("school_name"))
                school = await execute_one(
                    """
                    SELECT id
                    FROM schools
                      WHERE LOWER(TRIM(REGEXP_REPLACE(REPLACE(name, CHR(160), ' '), '\s+', ' ', 'g')))
                          = LOWER(TRIM(REGEXP_REPLACE(REPLACE($1, CHR(160), ' '), '\s+', ' ', 'g')))
                      AND tenant_id = $2::uuid
                    """,
                    school_name,
                    tenant_id,
                )
                if not school:
                    raise HTTPException(status_code=400, detail=f"School not found: {school_name}")
                target_school_id = str(school["id"])

            if not target_school_id:
                raise HTTPException(status_code=400, detail="Unable to resolve school for row")

            branch_name = normalize_text(row.get("branch_name"))
            branch = await execute_one(
                """
                SELECT id
                FROM branches
                    WHERE LOWER(TRIM(REGEXP_REPLACE(REPLACE(name, CHR(160), ' '), '\s+', ' ', 'g')))
                        = LOWER(TRIM(REGEXP_REPLACE(REPLACE($1, CHR(160), ' '), '\s+', ' ', 'g')))
                  AND school_id = $2::uuid
                """,
                branch_name,
                target_school_id,
            )
            if not branch:
                raise HTTPException(status_code=400, detail=f"Branch not found: {branch_name}")

            class_name = normalize_text(row.get("class_name"))
            cls = await execute_one(
                """
                SELECT id
                FROM classes
                    WHERE LOWER(TRIM(REGEXP_REPLACE(REPLACE(name, CHR(160), ' '), '\s+', ' ', 'g')))
                        = LOWER(TRIM(REGEXP_REPLACE(REPLACE($1, CHR(160), ' '), '\s+', ' ', 'g')))
                  AND branch_id = $2::uuid
                LIMIT 1
                """,
                class_name,
                branch["id"],
            )
            if not cls:
                raise HTTPException(status_code=400, detail=f"Class not found: {class_name}")

            academic_session = _parse_academic_session(normalize_text(row.get("academic_session")))
            student_roll_no = normalize_text(row.get("student_roll_no"))
            email = normalize_text(row.get("email"))
            if not email:
                seed = student_roll_no or full_name.lower().replace(" ", "_")
                email = f"{seed.lower()}@student.school"

            existing = await execute_one("SELECT id FROM users WHERE email = $1", email)
            if existing:
                raise HTTPException(status_code=400, detail=f"Email already exists: {email}")

            student_id = str(uuid_lib.uuid4())
            await execute_write(
                """
                INSERT INTO users (id, email, full_name, password_hash, role, tenant_id, school_id, is_active, must_change_password)
                VALUES ($1::uuid, $2, $3, $4, 'student', $5::uuid, $6::uuid, true, true)
                """,
                student_id,
                email,
                full_name,
                default_password_hash,
                tenant_id,
                target_school_id,
            )

            await execute_write(
                """
                INSERT INTO student_profiles (
                    user_id, school_id, branch_id, student_roll_no, date_of_birth, gender, address,
                    guardian_name, primary_contact, emergency_contact, blood_group, medical_notes
                )
                VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::date, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (user_id) DO UPDATE SET
                    school_id = EXCLUDED.school_id,
                    branch_id = EXCLUDED.branch_id,
                    student_roll_no = EXCLUDED.student_roll_no,
                    date_of_birth = EXCLUDED.date_of_birth,
                    gender = EXCLUDED.gender,
                    address = EXCLUDED.address,
                    guardian_name = EXCLUDED.guardian_name,
                    primary_contact = EXCLUDED.primary_contact,
                    emergency_contact = EXCLUDED.emergency_contact,
                    blood_group = EXCLUDED.blood_group,
                    medical_notes = EXCLUDED.medical_notes,
                    updated_at = NOW()
                """,
                student_id,
                target_school_id,
                branch["id"],
                student_roll_no or None,
                _parse_import_date(row.get("date_of_birth")),
                normalize_text(row.get("gender")) or None,
                normalize_text(row.get("address")) or None,
                normalize_text(row.get("guardian_name")) or None,
                normalize_phone(row.get("primary_contact")) or None,
                normalize_phone(row.get("emergency_contact")) or None,
                normalize_text(row.get("blood_group")) or None,
                normalize_text(row.get("medical_notes")) or None,
            )

            await execute_write(
                "INSERT INTO enrollments (student_id, class_id, academic_session, status, is_active) VALUES ($1::uuid, $2::uuid, $3, 'active', true)",
                student_id,
                cls["id"],
                academic_session,
            )
            success_count += 1
        except Exception as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            errors.append(f"Row {idx}: {message}")

    return {
        "success_count": success_count,
        "error_count": len(errors),
        "errors": errors[:50],
        "default_password": "Configured via IMPORT_DEFAULT_PASSWORD",
    }


@router.put("/teachers/{teacher_id}")
async def update_school_teacher(
    teacher_id: str,
    body: UpdateTeacherRequest,
    current_user: dict = Depends(require_manager),
):
    """Update a teacher's information."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None

    teacher = await execute_one("SELECT id, school_id, tenant_id FROM users WHERE id = $1 AND role = 'teacher'", teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    await _assert_tenant_access(current_user, teacher.get("tenant_id"))

    if school_id and str(teacher["school_id"]) != str(school_id):
        raise HTTPException(status_code=403, detail="Access denied to this teacher")

    if body.email:
        existing = await execute_one("SELECT id FROM users WHERE email = $1 AND id != $2", body.email, teacher_id)
        if existing:
            raise HTTPException(status_code=400, detail=f"Email {body.email} is already registered")

    if body.branch_id:
        branch = await execute_one("SELECT school_id, tenant_id FROM branches WHERE id = $1::uuid", body.branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
        if school_id and str(branch["school_id"]) != str(school_id):
            raise HTTPException(status_code=403, detail="Branch does not belong to your school")

    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.email is not None:
        updates["email"] = body.email
    if body.password is not None:
        updates["password_hash"] = hash_password(body.password)
    if body.branch_id is not None:
        updates["branch_id"] = body.branch_id
    if body.designation is not None:
        updates["designation"] = body.designation
    if body.contact is not None:
        updates["contact"] = body.contact
    if body.emergency_contact is not None:
        updates["emergency_contact"] = body.emergency_contact
    if body.employment_status is not None:
        updates["employment_status"] = body.employment_status
    if body.date_of_joining is not None:
        try:
            from datetime import date as _date
            updates["date_of_joining"] = _date.fromisoformat(body.date_of_joining) if isinstance(body.date_of_joining, str) else body.date_of_joining
        except (ValueError, TypeError):
            updates["date_of_joining"] = None
    if body.qualifications is not None:
        updates["qualifications"] = body.qualifications
    if body.experience_years is not None:
        updates["experience_years"] = body.experience_years
    if body.languages is not None:
        updates["languages"] = body.languages

    if not updates:
        return dict(teacher)

    uuid_fields = {"branch_id"}
    clauses = []
    for i, k in enumerate(updates.keys()):
        n = i + 2
        if k in uuid_fields:
            clauses.append(f"{k} = ${n}::uuid")
        else:
            clauses.append(f"{k} = ${n}")
    set_clause = ", ".join(clauses)
    values = [teacher_id] + list(updates.values())
    query = f"UPDATE users SET {set_clause} WHERE id = $1::uuid RETURNING id, email, full_name, role, school_id, branch_id"

    updated = await execute_one(query, *values)
    return dict(updated)


@router.post("/teachers/{teacher_id}/remove")
async def remove_teacher(teacher_id: str, current_user: dict = Depends(require_manager)):
    """Remove a teacher from the school."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None

    # Check teacher exists and belongs to manager's school
    teacher = await execute_one(
        "SELECT school_id, tenant_id FROM users WHERE id = $1 AND role = 'teacher'",
        teacher_id
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if school_id and str(teacher["school_id"]) != str(school_id):
        raise HTTPException(status_code=403, detail="Cannot delete teacher from another school")
    await _assert_tenant_access(current_user, teacher.get("tenant_id"))

    # Clean up associations
    await execute_write("DELETE FROM teacher_class_assignments WHERE teacher_id = $1", teacher_id)
    await execute_write("DELETE FROM teacher_class_subject_assignments WHERE teacher_id = $1", teacher_id)
    await execute_write("UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1", teacher_id)

    # Delete the teacher
    await execute_write("DELETE FROM users WHERE id = $1", teacher_id)

    return {"success": True, "message": "Teacher removed successfully"}


@router.post("/teachers/bulk-remove")
async def bulk_remove_teachers(body: BulkDeleteTeachersRequest, current_user: dict = Depends(require_manager)):
    """Remove multiple teachers from the school."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    deleted_count = 0
    errors = []

    for teacher_id in body.teacher_ids:
        try:
            # Check teacher exists and belongs to manager's school
            teacher = await execute_one(
                "SELECT school_id, tenant_id FROM users WHERE id = $1 AND role = 'teacher'",
                teacher_id
            )
            if not teacher:
                errors.append(f"Teacher {teacher_id} not found")
                continue

            if school_id and str(teacher["school_id"]) != str(school_id):
                errors.append(f"Cannot delete teacher {teacher_id} from another school")
                continue

            try:
                await _assert_tenant_access(current_user, teacher.get("tenant_id"))
            except HTTPException:
                errors.append(f"Cannot delete teacher {teacher_id} from another tenant")
                continue

            # Clean up associations
            await execute_write("DELETE FROM teacher_class_assignments WHERE teacher_id = $1", teacher_id)
            await execute_write("DELETE FROM teacher_class_subject_assignments WHERE teacher_id = $1", teacher_id)
            await execute_write("UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1", teacher_id)

            # Delete the teacher
            await execute_write("DELETE FROM users WHERE id = $1", teacher_id)
            deleted_count += 1
        except Exception as e:
            errors.append(f"Error deleting teacher {teacher_id}: {str(e)}")

    return {
        "success": True,
        "deleted_count": deleted_count,
        "errors": errors,
        "message": f"Deleted {deleted_count} teacher(s)"
    }


@router.post("/teachers/{teacher_id}/assign-class")
async def assign_teacher_to_class(
    teacher_id: str,
    body: AssignTeacherClassRequest,
    current_user: dict = Depends(require_manager),
):
    """Assign a teacher to a class (validates school ownership)."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None

    teacher = await execute_one("SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'teacher'", teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await _assert_tenant_access(current_user, teacher.get("tenant_id"))

    cls_with_scope = await execute_one(
        """
        SELECT c.id, b.school_id, b.tenant_id
        FROM classes c
        JOIN branches b ON b.id = c.branch_id
        WHERE c.id = $1::uuid
        """,
        body.class_id,
    )
    if not cls_with_scope:
        raise HTTPException(status_code=404, detail="Class not found")
    await _assert_tenant_access(current_user, cls_with_scope.get("tenant_id"))

    if school_id:
        if str(cls_with_scope["school_id"]) != str(school_id):
            raise HTTPException(status_code=403, detail="Class does not belong to your school")

    await execute_write(
        "UPDATE classes SET teacher_id = $1 WHERE id = $2",
        teacher_id, body.class_id,
    )
    return {"message": "Teacher assigned to class successfully"}


@router.get("/teachers/{teacher_id}/assignments")
async def get_teacher_assignments(teacher_id: str, current_user: dict = Depends(require_manager)):
    """Get current class+curriculum assignments for a teacher."""
    teacher = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'teacher'",
        teacher_id,
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await _assert_tenant_access(current_user, teacher.get("tenant_id"))

    curriculum_rows = await execute_query(
        """SELECT tcsa.class_id, tcsa.branch_id, tcsa.school_id,
                  tcsa.library_board_id, tcsa.library_subject_id, tcsa.library_book_id,
                  c.name as class_name, c.grade_level, c.section,
                  b.name as branch_name,
                  lb.name as board_name, ls.name as subject_name, lbk.title as book_title
           FROM teacher_class_subject_assignments tcsa
           LEFT JOIN classes c ON c.id = tcsa.class_id
           LEFT JOIN branches b ON b.id = tcsa.branch_id
           LEFT JOIN library_boards lb ON lb.id = tcsa.library_board_id
           LEFT JOIN library_subjects ls ON ls.id = tcsa.library_subject_id
           LEFT JOIN library_books lbk ON lbk.id = tcsa.library_book_id
           WHERE tcsa.teacher_id = $1::uuid""",
        teacher_id,
    )

    class_rows = await execute_query(
        """SELECT c.id as class_id, c.name, c.grade_level, c.section, c.branch_id,
                  b.name as branch_name
           FROM teacher_class_assignments tca
           JOIN classes c ON c.id = tca.class_id
           LEFT JOIN branches b ON b.id = c.branch_id
           WHERE tca.teacher_id = $1::uuid""",
        teacher_id,
    )

    return {
        "curriculum_assignments": [dict(r) for r in curriculum_rows],
        "class_assignments": [dict(r) for r in class_rows],
    }


@router.post("/teachers/{teacher_id}/save-assignments")
async def save_teacher_assignments(
    teacher_id: str,
    body: SaveTeacherAssignmentsRequest,
    current_user: dict = Depends(require_manager),
):
    """Save (replace) all class + curriculum assignments for a teacher."""
    from app.routers.homework import sync_teacher_class_subject_assignments

    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None

    teacher = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'teacher'",
        teacher_id,
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await _assert_tenant_access(current_user, teacher.get("tenant_id"))
    if school_id and str(teacher["school_id"]) != str(school_id):
        raise HTTPException(status_code=403, detail="Access denied to this teacher")

    curriculum_rows = []
    if body.teacher_curriculum_assignments:
        for row in body.teacher_curriculum_assignments:
            if not row.class_id:
                continue
            curriculum_rows.append({
                "class_id": row.class_id,
                "branch_id": row.branch_id,
                "school_id": row.school_id or str(teacher["school_id"]),
                "library_board_id": row.library_board_id,
                "library_subject_id": row.library_subject_id,
                "library_book_id": row.library_book_id,
            })

    await sync_teacher_class_subject_assignments(teacher_id, curriculum_rows or None)

    curriculum_class_ids = {r["class_id"] for r in curriculum_rows if r.get("class_id")}
    extra_class_ids = set(body.assigned_classes or []) - curriculum_class_ids

    await execute_write(
        "DELETE FROM teacher_class_assignments WHERE teacher_id = $1::uuid", teacher_id
    )
    for cid in (curriculum_class_ids | extra_class_ids):
        await execute_write(
            """INSERT INTO teacher_class_assignments (teacher_id, class_id)
               VALUES ($1::uuid, $2::uuid)
               ON CONFLICT DO NOTHING""",
            teacher_id, cid,
        )

    return {"message": "Assignments saved successfully"}


# ============================================
# STUDENT MANAGEMENT
# ============================================

@router.get("/students")
async def get_school_students(
    branch_id: Optional[str] = None,
    class_id: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """List all students in the manager's school (including unenrolled)."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    where = ["u.role = 'student'"]
    params: list = []
    n = 1

    if school_id:
        where.append(f"u.school_id = ${n}::uuid")
        params.append(school_id)
        n += 1
    elif tenant_id:
        where.append(f"u.tenant_id = ${n}::uuid")
        params.append(tenant_id)
        n += 1
    if class_id:
        where.append(f"e.class_id = ${n}")
        params.append(class_id)
        n += 1
    elif branch_id:
        where.append(f"u.branch_id = ${n}::uuid")
        params.append(branch_id)
        n += 1

    students = await execute_query(
        f"""SELECT u.id, u.full_name, u.email, u.is_active,
                   c.name as class_name, c.grade_level, c.section,
                   COALESCE(b.name, ub.name) as branch_name,
                   e.academic_session,
                   sp.student_roll_no, sp.guardian_name,
                   sp.date_of_birth, sp.gender
            FROM users u
            LEFT JOIN enrollments e ON e.student_id = u.id AND e.is_active = true
            LEFT JOIN classes c ON c.id = e.class_id
            LEFT JOIN branches b ON b.id = c.branch_id
            LEFT JOIN branches ub ON ub.id = u.branch_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id
            WHERE {' AND '.join(where)}
            ORDER BY u.full_name""",
        *params,
    )
    return [dict(s) for s in students]


class CreateStudentRequest(BaseModel):
    full_name: str
    email: Optional[str] = None
    branch_id: Optional[str] = None
    class_id: Optional[str] = None
    student_roll_no: Optional[str] = None
    guardian_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None


@router.post("/students")
async def create_student(
    body: CreateStudentRequest,
    current_user: dict = Depends(require_manager),
):
    """Create a student and optionally enroll them in a class."""
    tenant_id = current_user.get("tenant_id")
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant context missing")

    full_name = normalize_text(body.full_name)
    if not full_name:
        raise HTTPException(status_code=400, detail="full_name is required")

    email = normalize_text(body.email or "")
    if not email:
        slug = full_name.lower().replace(" ", "_")
        email = f"{slug}@student.school"

    existing = await execute_one("SELECT id FROM users WHERE email = $1", email)
    if existing:
        raise HTTPException(status_code=409, detail=f"Email already in use: {email}")

    # Validate branch belongs to this school/tenant
    eff_branch_id = normalize_text(body.branch_id or "")
    if eff_branch_id:
        branch = await execute_one(
            "SELECT id, school_id, tenant_id FROM branches WHERE id = $1::uuid",
            eff_branch_id,
        )
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        if str(branch.get("tenant_id")) != str(tenant_id):
            raise HTTPException(status_code=403, detail="Branch not in your tenant")
        if school_id and str(branch.get("school_id")) != str(school_id):
            raise HTTPException(status_code=403, detail="Branch not in your school")
        branch_school_id = branch.get("school_id")
    else:
        eff_branch_id = None
        branch_school_id = school_id

    # Validate class
    eff_class_id = normalize_text(body.class_id or "")
    if eff_class_id:
        cls = await execute_one(
            "SELECT id, branch_id FROM classes WHERE id = $1::uuid", eff_class_id
        )
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found")
        if eff_branch_id and str(cls.get("branch_id")) != str(eff_branch_id):
            raise HTTPException(status_code=400, detail="Class does not belong to selected branch")
    else:
        eff_class_id = None

    user_id = str(uuid_lib.uuid4())
    hashed_pw = hash_password(settings.IMPORT_DEFAULT_PASSWORD)

    dob = None
    if body.date_of_birth:
        try:
            dob = date.fromisoformat(str(body.date_of_birth).strip())
        except Exception:
            dob = None

    await execute_write(
        """INSERT INTO users (
               id, full_name, email, password_hash, role,
               tenant_id, school_id, branch_id,
               is_active, must_change_password, created_at
           ) VALUES (
               $1::uuid, $2, $3, $4, 'student',
               $5::uuid, $6::uuid, $7::uuid,
               true, true, NOW()
           )""",
        user_id, full_name, email, hashed_pw,
        tenant_id, branch_school_id, eff_branch_id or None,
    )

    # Create student_profiles row so profile fields are visible
    await execute_write(
        """INSERT INTO student_profiles (
               user_id, school_id, branch_id,
               student_roll_no, guardian_name, date_of_birth, gender
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id) DO UPDATE SET
               student_roll_no = EXCLUDED.student_roll_no,
               guardian_name   = EXCLUDED.guardian_name,
               date_of_birth   = EXCLUDED.date_of_birth,
               gender          = EXCLUDED.gender,
               updated_at      = NOW()""",
        user_id,
        branch_school_id,
        eff_branch_id or None,
        normalize_text(body.student_roll_no or "") or None,
        normalize_text(body.guardian_name or "") or None,
        dob,
        normalize_text(body.gender or "") or None,
    )

    if eff_class_id:
        enrollment_id = str(uuid_lib.uuid4())
        await execute_write(
            """INSERT INTO enrollments (id, student_id, class_id, is_active, created_at)
               VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW())
               ON CONFLICT DO NOTHING""",
            enrollment_id, user_id, eff_class_id,
        )

    return {"id": user_id, "full_name": full_name, "email": email, "message": "Student created successfully"}


class UpdateStudentRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    student_roll_no: Optional[str] = None
    guardian_name: Optional[str] = None
    primary_contact: Optional[str] = None
    emergency_contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    medical_notes: Optional[str] = None


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


class SetStudentPasswordRequest(BaseModel):
    password: str


@router.patch("/students/{student_id}")
async def update_student(
    student_id: str,
    body: UpdateStudentRequest,
    current_user: dict = Depends(require_manager),
):
    """Update basic student info (name, email, profile fields)."""
    # Access check
    student = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'student'",
        student_id,
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.get("role") == "manager":
        if str(current_user.get("school_id") or "") != str(student.get("school_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")
    else:
        if str(current_user.get("tenant_id") or "") != str(student.get("tenant_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")

    update_fields = []
    update_vals: list = []
    if body.full_name is not None:
        update_fields.append(f"full_name = ${len(update_vals) + 1}")
        update_vals.append(body.full_name.strip())
    if body.email is not None and body.email.strip():
        update_fields.append(f"email = ${len(update_vals) + 1}")
        update_vals.append(body.email.strip())
    if update_fields:
        update_vals.append(student_id)
        await execute_write(
            f"UPDATE users SET {', '.join(update_fields)}, updated_at = NOW() WHERE id = ${len(update_vals)}::uuid",
            *update_vals,
        )

    dob = None
    if body.date_of_birth:
        try:
            dob = date.fromisoformat(str(body.date_of_birth).strip())
        except Exception:
            dob = None

    # Derive school_id for the UPSERT
    sp_school_id = str(student.get("school_id") or "")

    await execute_write(
        """INSERT INTO student_profiles (user_id, school_id, student_roll_no, guardian_name,
               primary_contact, emergency_contact, date_of_birth, gender, address, blood_group, medical_notes)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (user_id) DO UPDATE SET
               student_roll_no   = COALESCE($3, student_profiles.student_roll_no),
               guardian_name     = COALESCE($4, student_profiles.guardian_name),
               primary_contact   = COALESCE($5, student_profiles.primary_contact),
               emergency_contact = COALESCE($6, student_profiles.emergency_contact),
               date_of_birth     = COALESCE($7, student_profiles.date_of_birth),
               gender            = COALESCE($8, student_profiles.gender),
               address           = COALESCE($9, student_profiles.address),
               blood_group       = COALESCE($10, student_profiles.blood_group),
               medical_notes     = COALESCE($11, student_profiles.medical_notes),
               updated_at        = NOW()""",
        student_id,
        sp_school_id or None,
        body.student_roll_no.strip() if body.student_roll_no else None,
        body.guardian_name.strip() if body.guardian_name else None,
        body.primary_contact.strip() if body.primary_contact else None,
        body.emergency_contact.strip() if body.emergency_contact else None,
        dob,
        body.gender.strip() if body.gender else None,
        body.address.strip() if body.address else None,
        body.blood_group.strip() if body.blood_group else None,
        body.medical_notes.strip() if body.medical_notes else None,
    )
    return {"message": "Student updated successfully"}


@router.delete("/students/{student_id}")
async def delete_student(
    student_id: str,
    current_user: dict = Depends(require_manager),
):
    """Archive a student (sets is_active = false, deactivates enrollments)."""
    student = await execute_one(
        "SELECT id, school_id, tenant_id FROM users WHERE id = $1::uuid AND role = 'student'",
        student_id,
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.get("role") == "manager":
        if str(current_user.get("school_id") or "") != str(student.get("school_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")
    else:
        if str(current_user.get("tenant_id") or "") != str(student.get("tenant_id") or ""):
            raise HTTPException(status_code=403, detail="Access denied to this student")

    await execute_write(
        "UPDATE users SET is_active = false WHERE id = $1::uuid AND role = 'student'",
        student_id,
    )
    await execute_write(
        "UPDATE enrollments SET is_active = false WHERE student_id = $1::uuid AND is_active = true",
        student_id,
    )
    return {"message": "Student archived successfully"}


@router.get("/students/{student_id}")
async def get_student_detail(
    student_id: str,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    profile = await execute_one(
        """SELECT u.id, u.email, u.full_name, u.is_active, u.created_at,
                  sp.school_id, sp.branch_id, sp.student_roll_no, sp.date_of_birth, sp.gender, sp.address,
                  sp.guardian_name, sp.primary_contact, sp.emergency_contact, sp.blood_group, sp.medical_notes,
                  sc.name AS school_name, b.name AS branch_name
           FROM users u
           LEFT JOIN student_profiles sp ON sp.user_id = u.id
           LEFT JOIN schools sc ON sc.id = sp.school_id
           LEFT JOIN branches b ON b.id = sp.branch_id
           WHERE u.id = $1 AND u.role = 'student'""",
        student_id,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")
    history = await execute_query(
        """SELECT e.id, e.class_id, e.academic_session, e.status, e.promotion_result,
                  e.is_active, e.enrolled_at, e.completed_at, e.notes,
                  c.grade_level, c.section, c.name AS class_name,
                  b.name AS branch_name, sc.name AS school_name
           FROM enrollments e
           JOIN classes c ON c.id = e.class_id
           JOIN branches b ON b.id = c.branch_id
           JOIN schools sc ON sc.id = b.school_id
           WHERE e.student_id = $1
           ORDER BY e.enrolled_at DESC""",
        student_id,
    )
    return {"profile": dict(profile), "history": [dict(h) for h in history]}


@router.post("/students/{student_id}/promote")
async def promote_student(
    student_id: str,
    req: StudentLifecycleRequest,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    normalized_session = _parse_academic_session(req.academic_session)
    active = await _mgr_get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    current_grade_num = _mgr_extract_grade_number(active["grade_level"])
    if current_grade_num is None:
        raise HTTPException(status_code=400, detail="Current class grade is not numeric")
    branch_classes = await execute_query(
        "SELECT id, grade_level, section FROM classes WHERE branch_id = $1",
        active["branch_id"],
    )
    next_class = None
    for cls in branch_classes:
        if _mgr_extract_grade_number(cls["grade_level"]) == current_grade_num + 1 and \
                (cls.get("section") or "") == (active.get("section") or ""):
            next_class = cls
            break
    if not next_class:
        raise HTTPException(status_code=400, detail="Next class not found in this branch. Create it first.")
    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'completed', promotion_result = 'promoted', completed_at = NOW(), notes = $1 WHERE id = $2",
        _mgr_none_if_blank(req.notes), active["id"],
    )
    await _mgr_activate_enrollment(student_id, str(next_class["id"]), normalized_session, req.notes)
    return {"message": "Student promoted successfully"}


@router.post("/students/{student_id}/repeat")
async def repeat_student(
    student_id: str,
    req: StudentLifecycleRequest,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    normalized_session = _parse_academic_session(req.academic_session)
    active = await _mgr_get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    await execute_write(
        "UPDATE enrollments SET is_active = false, status = 'completed', promotion_result = 'failed', completed_at = NOW(), notes = $1 WHERE id = $2",
        _mgr_none_if_blank(req.notes), active["id"],
    )
    await _mgr_activate_enrollment(student_id, str(active["class_id"]), normalized_session, req.notes)
    return {"message": "Student marked as repeat for next session"}


@router.post("/students/{student_id}/change-section")
async def change_student_section(
    student_id: str,
    req: ChangeSectionRequest,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    normalized_session = _parse_academic_session(req.academic_session)
    active = await _mgr_get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    target = await execute_one(
        "SELECT id, branch_id, grade_level FROM classes WHERE id = $1",
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
        _mgr_none_if_blank(req.notes), active["id"],
    )
    await _mgr_activate_enrollment(student_id, req.target_class_id, normalized_session, req.notes)
    return {"message": "Section changed successfully"}


@router.get("/students/{student_id}/section-options")
async def get_section_change_options(
    student_id: str,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    active = await _mgr_get_active_enrollment(student_id)
    if not active:
        raise HTTPException(status_code=400, detail="No active enrollment found")
    options = await execute_query(
        """SELECT id, name, grade_level, section FROM classes
           WHERE branch_id = $1 AND grade_level = $2 AND id <> $3
           ORDER BY section NULLS LAST, name""",
        active["branch_id"], active["grade_level"], active["class_id"],
    )
    return {"options": [dict(o) for o in options]}


@router.post("/students/{student_id}/set-current-enrollment")
async def set_current_enrollment(
    student_id: str,
    req: SetCurrentEnrollmentRequest,
    current_user: dict = Depends(require_manager),
):
    await _mgr_check_student_access(current_user, student_id)
    normalized_session = _parse_academic_session(req.academic_session)
    student_profile = await execute_one(
        "SELECT school_id FROM student_profiles WHERE user_id = $1::uuid",
        student_id,
    )
    if not student_profile or not student_profile.get("school_id"):
        raise HTTPException(status_code=400, detail="Student school profile not found")
    target_class = await execute_one(
        "SELECT c.id, b.school_id FROM classes c JOIN branches b ON b.id = c.branch_id WHERE c.id = $1::uuid",
        req.class_id,
    )
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    if str(target_class["school_id"]) != str(student_profile["school_id"]):
        raise HTTPException(status_code=400, detail="Student and class must belong to the same school")
    await execute_write(
        """UPDATE enrollments SET is_active = false,
           status = CASE WHEN status = 'active' THEN 'completed' ELSE status END,
           completed_at = COALESCE(completed_at, NOW())
           WHERE student_id = $1 AND is_active = true""",
        student_id,
    )
    await _mgr_activate_enrollment(student_id, req.class_id, normalized_session, req.notes)
    return {"message": "Current enrollment set successfully"}


@router.post("/users/{user_id}/set-password")
async def set_user_password(
    user_id: str,
    body: SetStudentPasswordRequest,
    current_user: dict = Depends(require_manager),
):
    await _assert_user_access(current_user, user_id)
    if not body.password or len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    await execute_write(
        "UPDATE users SET password_hash = $1, must_change_password = false, is_active = true, updated_at = NOW() WHERE id = $2::uuid",
        hash_password(body.password), user_id,
    )
    return {"message": "Password updated successfully"}


# ============================================
# CLASS MANAGEMENT
# ============================================

@router.get("/classes")
async def get_school_classes(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """List all classes in manager's school."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    where = []
    params: list = []
    n = 1

    if school_id:
        where.append(f"b.school_id = ${n}")
        params.append(school_id)
        n += 1
    elif tenant_id:
        where.append(f"b.tenant_id = ${n}::uuid")
        params.append(tenant_id)
        n += 1
    if branch_id:
        where.append(f"c.branch_id = ${n}")
        params.append(branch_id)
        n += 1

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    classes = await execute_query(
        f"""SELECT DISTINCT c.id, c.name, c.grade_level, c.section,
                   b.name as branch_name, b.id as branch_id,
                   COALESCE(u.full_name,
                       (SELECT full_name FROM users WHERE id IN (
                           SELECT teacher_id FROM teacher_class_assignments WHERE class_id = c.id LIMIT 1
                       )),
                       (SELECT full_name FROM users WHERE id IN (
                           SELECT teacher_id FROM teacher_class_subject_assignments WHERE class_id = c.id LIMIT 1
                       ))
                   ) as teacher_name,
                   COUNT(DISTINCT e.student_id) as student_count
            FROM classes c
            JOIN branches b ON b.id = c.branch_id
            LEFT JOIN users u ON u.id = c.teacher_id
            LEFT JOIN enrollments e ON e.class_id = c.id AND e.is_active = true
            LEFT JOIN teacher_class_assignments tca ON c.id = tca.class_id
            LEFT JOIN teacher_class_subject_assignments tcsa ON c.id = tcsa.class_id
            {where_sql}
            GROUP BY c.id, c.name, c.grade_level, c.section, b.name, b.id, u.full_name
            ORDER BY b.name, c.grade_level, c.section, c.name""",
        *params,
    )
    return [dict(c) for c in classes]


@router.post("/classes")
async def create_school_class(body: CreateClassRequest, current_user: dict = Depends(require_manager)):
    """Create a class in a branch (branch must belong to manager's school)."""
    school_id = current_user.get("school_id") if current_user.get("role") == "manager" else None
    tenant_id = current_user.get("tenant_id")

    branch = await execute_one("SELECT school_id, tenant_id FROM branches WHERE id = $1::uuid", body.branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    await _assert_tenant_access(current_user, branch.get("tenant_id"))

    if school_id:
        if str(branch["school_id"]) != str(school_id):
            raise HTTPException(status_code=403, detail="Branch does not belong to your school")

    cls = await execute_one(
        """INSERT INTO classes (tenant_id, branch_id, name, grade_level, section)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)
           RETURNING id, branch_id, name, grade_level, section""",
        tenant_id, body.branch_id, body.name, body.grade_level or None, body.section or None,
    )
    return dict(cls)


@router.delete("/classes/{class_id}")
async def delete_school_class(class_id: str, current_user: dict = Depends(require_manager)):
    """Delete a class (branch must belong to manager's school)."""
    cls = await execute_one("SELECT branch_id FROM classes WHERE id = $1::uuid", class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    branch = await execute_one("SELECT school_id, tenant_id FROM branches WHERE id = $1::uuid", cls["branch_id"])
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    _assert_school_access(current_user, str(branch["school_id"]))
    await _assert_tenant_access(current_user, branch.get("tenant_id"))

    await execute_write("DELETE FROM classes WHERE id = $1::uuid", class_id)
    return {"ok": True}


@router.get("/branches/{branch_id}/overview")
async def get_branch_overview(branch_id: str, current_user: dict = Depends(require_manager)):  # noqa: ARG001
    """
    Get comprehensive overview of a branch
    """
    
    branch = await execute_one("SELECT id, school_id, tenant_id FROM branches WHERE id = $1::uuid", branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    _assert_school_access(current_user, str(branch["school_id"]))
    await _assert_tenant_access(current_user, branch.get("tenant_id"))

    # Basic stats
    stats_query = """
        SELECT 
            COUNT(DISTINCT c.id) as total_classes,
            COUNT(DISTINCT e.student_id) as total_students,
            COUNT(DISTINCT c.teacher_id) as total_teachers,
            COUNT(DISTINCT cs.subject_id) as total_subjects
        FROM classes c
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        LEFT JOIN class_subjects cs ON c.id = cs.class_id
        WHERE c.branch_id = $1
    """
    
    stats = await execute_one(stats_query, branch_id)
    
    # Classes with details
    classes_query = """
        SELECT 
            c.id,
            c.name,
            c.grade_level,
            u.full_name as teacher_name,
            COUNT(DISTINCT e.student_id) as student_count
        FROM classes c
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        WHERE c.branch_id = $1
        GROUP BY c.id, c.name, c.grade_level, u.full_name
        ORDER BY c.grade_level, c.name
    """
    
    classes = await execute_query(classes_query, branch_id)
    
    return {
        "branch_id": branch_id,
        "statistics": dict(stats),
        "classes": [dict(c) for c in classes]
    }


# ============================================
# STUDENT REPORTS
# ============================================

@router.get("/reports/students")
async def get_student_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    class_id: Optional[str] = None,
    period: str = "monthly",
    current_user: dict = Depends(require_manager),
):
    """Get student-wise performance reports (scoped to manager's school)."""
    # Managers can only query their own school
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    if tenant_id and school_id:
        school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        await _assert_tenant_access(current_user, school.get("tenant_id"))
    if tenant_id and branch_id:
        branch = await execute_one("SELECT tenant_id FROM branches WHERE id = $1::uuid", branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
    if tenant_id and class_id:
        cls = await execute_one(
            """
            SELECT b.tenant_id
            FROM classes c
            JOIN branches b ON b.id = c.branch_id
            WHERE c.id = $1::uuid
            """,
            class_id,
        )
        if not cls:
            raise HTTPException(status_code=404, detail="Class not found")
        await _assert_tenant_access(current_user, cls.get("tenant_id"))

    period_days = {"daily": 1, "weekly": 7, "monthly": 30, "quarterly": 90, "yearly": 365, "all": 36500}
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)

    where_clauses = ["sp.date >= $1"]
    params: list = [date_from]
    param_count = 2

    if class_id:
        where_clauses.append(f"sp.class_id = ${param_count}")
        params.append(class_id)
        param_count += 1
    elif branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    if tenant_id:
        where_clauses.append(f"s.tenant_id = ${param_count}::uuid")
        params.append(tenant_id)
        param_count += 1
    
    query = f"""
        SELECT 
            u.id as student_id,
            u.full_name,
            u.email,
            c.name as class_name,
            b.name as branch_name,
            s.name as school_name,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score,
            MAX(sp.ranking) as best_ranking
        FROM student_performance sp
        JOIN users u ON sp.student_id = u.id
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, u.email, c.name, b.name, s.name
        ORDER BY avg_overall_score DESC NULLS LAST
    """
    
    students = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "filters": {
            "school_id": school_id,
            "branch_id": branch_id,
            "class_id": class_id
        },
        "students": [dict(s) for s in students]
    }


# ============================================
# CLASS REPORTS
# ============================================

@router.get("/reports/classes")
async def get_class_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    period: str = "monthly",
    current_user: dict = Depends(require_manager),
):
    """Get class-wise performance reports (scoped to manager's school)."""
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    if tenant_id and school_id:
        school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        await _assert_tenant_access(current_user, school.get("tenant_id"))
    if tenant_id and branch_id:
        branch = await execute_one("SELECT tenant_id FROM branches WHERE id = $1::uuid", branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
    
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "all": 36500
    }
    
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    if tenant_id:
        where_clauses.append(f"s.tenant_id = ${param_count}::uuid")
        params.append(tenant_id)
        param_count += 1
    
    query = f"""
        SELECT 
            c.id as class_id,
            c.name as class_name,
            c.grade_level,
            b.name as branch_name,
            s.name as school_name,
            u.full_name as teacher_name,
            COUNT(DISTINCT sp.student_id) as student_count,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY c.id, c.name, c.grade_level, b.name, s.name, u.full_name
        ORDER BY avg_overall_score DESC NULLS LAST
    """
    
    classes = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "classes": [dict(cls) for cls in classes]
    }


# ============================================
# TEACHER REPORTS
# ============================================

@router.get("/reports/teachers")
async def get_teacher_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    period: str = "monthly",
    current_user: dict = Depends(require_manager),
):
    """Get teacher-wise performance reports (scoped to manager's school)."""
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    if tenant_id and school_id:
        school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        await _assert_tenant_access(current_user, school.get("tenant_id"))
    if tenant_id and branch_id:
        branch = await execute_one("SELECT tenant_id FROM branches WHERE id = $1::uuid", branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
    
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "all": 36500
    }
    
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1", "u.role = 'teacher'"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    if tenant_id:
        where_clauses.append(f"s.tenant_id = ${param_count}::uuid")
        params.append(tenant_id)
        param_count += 1
    
    query = f"""
        SELECT 
            u.id as teacher_id,
            u.full_name as teacher_name,
            u.email,
            COUNT(DISTINCT c.id) as class_count,
            COUNT(DISTINCT sp.student_id) as student_count,
            AVG(sp.video_completion_rate) as avg_student_video_completion,
            AVG(sp.attendance_rate) as avg_student_attendance,
            AVG(sp.average_quiz_score) as avg_student_quiz_score,
            AVG(sp.overall_score) as avg_student_overall_score
        FROM users u
        JOIN classes c ON u.id = c.teacher_id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN student_performance sp ON c.id = sp.class_id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY avg_student_overall_score DESC NULLS LAST
    """
    
    teachers = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "teachers": [dict(t) for t in teachers]
    }


# ============================================
# MANAGER ANALYTICS  (SPI / CVI / SHS)
# ============================================

import statistics as _mgr_stats
from app.utils.score_calculator import (
    get_date_range as _get_date_range,
    get_school_rating as _get_school_rating,
    calculate_cvi as _mgr_calc_cvi,
    calculate_spi as _mgr_calc_spi,
    get_teacher_grade as _mgr_teacher_grade,
    get_risk_level as _mgr_risk_level,
)

# Reusable live SHS SQL for manager scope — $1=class_id
# Formula: video*0.25 + homework*0.40 + attendance*0.20 + behavioral*0.15
# behavioral = topic_revisit_score*0.50 + homework_retake_score*0.50
_MGR_SHS_SQL = """
WITH class_topics AS (
    SELECT DISTINCT lt.id AS topic_id
    FROM teacher_topic_content ttc
    JOIN library_topics lt ON lt.id = ttc.library_topic_id
    JOIN library_chapters ch ON ch.id = lt.chapter_id
    JOIN library_books b ON b.id = ch.book_id
    JOIN teacher_class_subject_assignments tcsa
        ON tcsa.teacher_id = ttc.teacher_id
        AND tcsa.library_book_id = b.id
        AND tcsa.class_id = $1::uuid
    WHERE ttc.lecture_video_url IS NOT NULL AND trim(ttc.lecture_video_url) != ''
),
base AS (
    SELECT
        u.id AS student_id,
        u.full_name,
        COALESCE((
            SELECT CASE WHEN COUNT(tt.topic_id) = 0 THEN 0 ELSE
                ROUND(100.0 * COUNT(CASE WHEN COALESCE(stp.lecture_watch_percent,0) >= 75 THEN 1 END)
                / COUNT(tt.topic_id), 2) END
            FROM class_topics tt
            LEFT JOIN student_topic_progress stp ON stp.topic_id = tt.topic_id AND stp.student_id = u.id
        ), 0) AS video_rate,
        COALESCE(att.attendance_rate, 0) AS attendance_rate,
        COALESCE(hw.homework_rate, 0) AS homework_rate,
        LEAST(COALESCE((
            SELECT COUNT(DISTINCT stp2.topic_id) / 5.0 * 100
            FROM student_topic_progress stp2
            JOIN class_topics ct ON ct.topic_id = stp2.topic_id
            WHERE stp2.student_id = u.id
              AND stp2.lecture_watch_percent > 0
        ), 0), 100) AS topic_revisit_score,
        LEAST(COALESCE((
            SELECT COUNT(*) / 3.0 * 100
            FROM (
                SELECT hs2.homework_id
                FROM homework_submissions hs2
                JOIN homeworks h2 ON h2.id = hs2.homework_id
                WHERE hs2.student_id = u.id AND h2.class_id = $1::uuid
                GROUP BY hs2.homework_id
                HAVING COUNT(*) > 1
            ) retakes_q
        ), 0), 100) AS hw_retake_score
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    LEFT JOIN (
        SELECT student_id, class_id,
            ROUND(100.0 * SUM(CASE WHEN is_present THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS attendance_rate
        FROM attendance GROUP BY student_id, class_id
    ) att ON att.student_id = u.id AND att.class_id = e.class_id
    LEFT JOIN (
        SELECT e2.student_id,
            ROUND(COALESCE(AVG(CASE
                WHEN best.marks_awarded IS NOT NULL AND h.total_marks > 0
                    THEN (best.marks_awarded / h.total_marks * 100)
                WHEN best.submission_status IN ('submitted','late','in_progress')
                    THEN 75
                ELSE 0
            END), 0), 2) AS homework_rate
        FROM enrollments e2
        JOIN homeworks h ON h.class_id = e2.class_id AND h.status = 'published'
        LEFT JOIN (
            SELECT DISTINCT ON (homework_id, student_id)
                homework_id, student_id, marks_awarded, submission_status
            FROM homework_submissions
            ORDER BY homework_id, student_id,
                     marks_awarded DESC NULLS LAST, submitted_at DESC
        ) best ON best.homework_id = h.id AND best.student_id = e2.student_id
        WHERE e2.class_id = $1::uuid AND e2.is_active = true
        GROUP BY e2.student_id
    ) hw ON hw.student_id = u.id
    WHERE e.class_id = $1 AND e.is_active = true
)
SELECT *,
    ROUND((topic_revisit_score * 0.50 + hw_retake_score * 0.50), 2) AS behavioral_rate,
    ROUND((
        video_rate * 0.25
        + homework_rate * 0.40
        + attendance_rate * 0.20
        + (topic_revisit_score * 0.50 + hw_retake_score * 0.50) * 0.15
    ), 2) AS shs_score,
    -- Flag students with absolutely no activity (excluded from school averages)
    (video_rate = 0 AND attendance_rate = 0 AND homework_rate = 0) AS is_inactive
FROM base
"""


@router.get("/analytics/overview")
async def get_manager_analytics_overview(
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """Manager SPI overview — fully live from source tables."""
    school_id = str(current_user.get("school_id") or "")
    date_from, date_to = _get_date_range(period, start, end)

    # All classes in this school
    classes = await execute_query(
        """SELECT c.id, c.name, c.grade_level, c.section, b.name AS branch_name,
                  COALESCE(c.teacher_id, tcsa_t.teacher_id) AS teacher_id,
                  u.full_name AS teacher_name
           FROM classes c
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN (
               SELECT DISTINCT ON (class_id) class_id, teacher_id
               FROM teacher_class_subject_assignments
               ORDER BY class_id
           ) tcsa_t ON tcsa_t.class_id = c.id
           LEFT JOIN users u ON u.id = COALESCE(c.teacher_id, tcsa_t.teacher_id)
           WHERE b.school_id = $1::uuid ORDER BY c.name""",
        school_id,
    )

    # Per-class live SHS + CVI
    all_shs_vals, all_hw_vals, all_att_vals, class_analytics = [], [], [], []
    teacher_cvi_map: dict = {}  # teacher_id → list of CVI scores
    total_enrolled_all = 0
    total_inactive_all = 0

    for cls in classes:
        cid = str(cls["id"])
        rows = await execute_query(_MGR_SHS_SQL, cid)

        # Split active (have any data) vs inactive (zero on all metrics)
        active_rows = [r for r in rows if not r["is_inactive"]]
        inactive_count = len(rows) - len(active_rows)
        total_enrolled_all += len(rows)
        total_inactive_all += inactive_count

        shs_vals = [float(r["shs_score"] or 0) for r in active_rows]
        hw_vals = [float(r["homework_rate"] or 0) for r in active_rows]
        att_vals = [float(r["attendance_rate"] or 0) for r in active_rows]
        vid_vals = [float(r["video_rate"] or 0) for r in active_rows]

        all_shs_vals.extend(shs_vals)
        all_hw_vals.extend(hw_vals)
        all_att_vals.extend(att_vals)

        if shs_vals:
            avg_shs = _mgr_stats.mean(shs_vals)
            variance = _mgr_stats.stdev(shs_vals) if len(shs_vals) > 1 else 0.0
            hw_eff = _mgr_stats.mean(hw_vals) if hw_vals else 0.0
            avg_video = _mgr_stats.mean(vid_vals) if vid_vals else 0.0

            # Real learning velocity from student_health_scores (weekly vs monthly avg)
            vel_row = await execute_one(
                "SELECT AVG(weekly_shs) AS avg_weekly, AVG(monthly_shs) AS avg_monthly FROM student_health_scores WHERE class_id = $1::uuid",
                cid,
            )
            avg_monthly = float(vel_row["avg_monthly"] or 0) if vel_row else 0.0
            if avg_monthly > 0:
                raw_vel = float(vel_row["avg_weekly"] or 0) - avg_monthly
                learning_velocity = min(max((raw_vel + 10) / 20.0 * 100, 0), 100)
            else:
                learning_velocity = 50.0

            cvi = _mgr_calc_cvi(avg_shs, learning_velocity, variance, hw_eff)
            grade = _mgr_teacher_grade(cvi)
            struggling = sum(1 for v in shs_vals if v < 50)
            excelling = sum(1 for v in shs_vals if v >= 80)

            # CVI teacher alerts (per schoolanalysis.md spec)
            cvi_alert = None
            if avg_video > 85 and hw_eff < 60:
                cvi_alert = "High engagement but low comprehension — content may be too complex"
            elif avg_video < 50 and hw_eff < 60:
                cvi_alert = "Low engagement AND comprehension — teaching approach needs revision"
            elif variance > 25:
                cvi_alert = "Large performance gap — some students being left behind"
        else:
            avg_shs = cvi = variance = hw_eff = avg_video = learning_velocity = 0.0
            grade = "No data"; struggling = excelling = 0; cvi_alert = None

        tid = str(cls["teacher_id"]) if cls["teacher_id"] else None
        if tid:
            teacher_cvi_map.setdefault(tid, []).append(cvi)

        class_analytics.append({
            "class_id": cid,
            "class_name": cls["name"],
            "branch_name": cls["branch_name"],
            "teacher_name": cls["teacher_name"],
            "avg_shs": round(avg_shs, 2),
            "avg_cvi": round(cvi, 2),
            "total_students": len(shs_vals),
            "inactive_students": inactive_count,
            "struggling_count": struggling,
            "excelling_count": excelling,
            "teacher_grade": grade,
            "variance": round(variance, 2),
            "avg_video": round(avg_video, 2),
            "learning_velocity": round(learning_velocity, 2),
            "cvi_alert": cvi_alert,
        })

    # School-level aggregates
    total_students = len(all_shs_vals)
    avg_shs = _mgr_stats.mean(all_shs_vals) if all_shs_vals else 0.0
    avg_att = _mgr_stats.mean(all_att_vals) if all_att_vals else 0.0
    avg_hw = _mgr_stats.mean(all_hw_vals) if all_hw_vals else 0.0
    top_pct = sum(1 for v in all_shs_vals if v >= 80) / max(total_students, 1) * 100
    at_risk_pct = sum(1 for v in all_shs_vals if v < 50) / max(total_students, 1) * 100

    # Risk distribution
    risk_dist = {
        "critical": sum(1 for v in all_shs_vals if v < 40),
        "at_risk": sum(1 for v in all_shs_vals if 40 <= v < 60),
        "stable": sum(1 for v in all_shs_vals if 60 <= v < 80),
        "excelling": sum(1 for v in all_shs_vals if v >= 80),
    }

    # Teacher quality
    all_cvi_scores = [_mgr_stats.mean(scores) for scores in teacher_cvi_map.values()]
    avg_cvi = _mgr_stats.mean(all_cvi_scores) if all_cvi_scores else 0.0
    excellent_teachers = sum(1 for c in all_cvi_scores if c >= 85)
    underperforming_teachers = sum(1 for c in all_cvi_scores if c < 60)
    total_teachers = len(all_cvi_scores)
    excellent_pct = excellent_teachers / max(total_teachers, 1) * 100
    underperforming_pct = underperforming_teachers / max(total_teachers, 1) * 100
    teacher_variance = _mgr_stats.stdev(all_cvi_scores) if len(all_cvi_scores) > 1 else 0.0

    # Real month-over-month SPI: fetch last stored SPI from school_performance_index
    prev_spi_row = await execute_one(
        "SELECT spi_score FROM school_performance_index WHERE school_id = $1::uuid ORDER BY week_start DESC LIMIT 1",
        school_id,
    )
    prev_spi = float(prev_spi_row["spi_score"] or 0) if prev_spi_row else 0.0

    # Compute SPI once with 0 mom to get baseline, then recompute with real growth
    _spi_kwargs = dict(
        school_avg_shs=avg_shs,
        school_avg_cvi=avg_cvi,
        top_performers_pct=top_pct,
        at_risk_pct=at_risk_pct,
        excellent_teachers_pct=excellent_pct,
        underperforming_teachers_pct=underperforming_pct,
        avg_attendance_rate=avg_att,
        homework_submission_rate=avg_hw,
    )
    spi_base = _mgr_calc_spi(**_spi_kwargs, mom_improvement=0)
    mom_improvement = round((spi_base - prev_spi) / prev_spi * 100, 2) if prev_spi > 0 else 0.0
    spi = _mgr_calc_spi(**_spi_kwargs, mom_improvement=mom_improvement)
    rating = _get_school_rating(spi)

    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "spi": {
            "spi_score": round(spi, 2),
            "avg_shs": round(avg_shs, 2),
            "avg_cvi": round(avg_cvi, 2),
            "at_risk_percentage": round(at_risk_pct, 2),
            "top_performers_percentage": round(top_pct, 2),
            "rating": rating,
            "total_active_students": total_students,
            "total_enrolled": total_enrolled_all,
            "inactive_students": total_inactive_all,
        },
        "components": {
            "academic_excellence": {
                "score": round(avg_shs * 0.5 + top_pct * 0.3 + (100 - at_risk_pct) * 0.2, 2),
                "avg_shs": round(avg_shs, 2),
                "top_performers_pct": round(top_pct, 2),
                "at_risk_pct": round(at_risk_pct, 2),
                "total_students": total_students,
            },
            "teacher_quality": {
                "score": round(avg_cvi * 0.5 + excellent_pct * 0.3 + (100 - underperforming_pct) * 0.2, 2),
                "avg_cvi": round(avg_cvi, 2),
                "total_teachers": total_teachers,
                "excellent_count": excellent_teachers,
                "underperforming_count": underperforming_teachers,
                "teacher_variance": round(teacher_variance, 2),
            },
            "operational_efficiency": {
                "score": round(avg_att * 0.6 + avg_hw * 0.4, 2),
                "avg_attendance": round(avg_att, 2),
                "avg_homework": round(avg_hw, 2),
            },
            "growth_trajectory": {
                "score": round(min(max((mom_improvement + 20) / 40.0 * 100, 0), 100), 2),
                "mom_improvement": mom_improvement,
                "prev_spi": round(prev_spi, 2),
                "note": "Month-over-month SPI change" if prev_spi > 0 else "No prior SPI stored yet",
            },
        },
        "risk_distribution": risk_dist,
        "classes": sorted(class_analytics, key=lambda x: x["avg_cvi"], reverse=True),
    }


@router.get("/analytics/teachers")
async def get_manager_teacher_analytics(
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """Teacher CVI ranking — live computation from student data."""
    school_id = str(current_user.get("school_id") or "")

    # Teachers with classes in this school (via TCSA assignments)
    teacher_rows = await execute_query(
        """
        SELECT DISTINCT u.id AS teacher_id, u.full_name AS teacher_name, u.email
        FROM users u
        JOIN teacher_class_subject_assignments tcsa ON tcsa.teacher_id = u.id
        JOIN classes c ON c.id = tcsa.class_id
        JOIN branches b ON b.id = c.branch_id
        WHERE b.school_id = $1::uuid AND u.role = 'teacher'
        ORDER BY u.full_name
        """,
        school_id,
    )

    results = []
    for t in teacher_rows:
        tid = str(t["teacher_id"])
        # Get all classes this teacher is assigned to in this school
        t_classes = await execute_query(
            """SELECT DISTINCT c.id FROM classes c
               JOIN teacher_class_subject_assignments tcsa ON tcsa.class_id = c.id
               JOIN branches b ON b.id = c.branch_id
               WHERE tcsa.teacher_id = $1::uuid AND b.school_id = $2::uuid""",
            tid, school_id,
        )
        all_shs, all_hw = [], []
        for cls in t_classes:
            rows = await execute_query(_MGR_SHS_SQL, str(cls["id"]))
            all_shs.extend(float(r["shs_score"] or 0) for r in rows)
            all_hw.extend(float(r["homework_rate"] or 0) for r in rows)

        if all_shs:
            avg_shs = _mgr_stats.mean(all_shs)
            variance = _mgr_stats.stdev(all_shs) if len(all_shs) > 1 else 0.0
            hw_eff = _mgr_stats.mean(all_hw) if all_hw else 0.0

            # Real learning velocity averaged across all teacher's classes
            if t_classes:
                cids = [str(c["id"]) for c in t_classes]
                vel_rows = await execute_query(
                    f"SELECT AVG(weekly_shs) AS wk, AVG(monthly_shs) AS mo FROM student_health_scores WHERE class_id = ANY($1::uuid[])",
                    cids,
                )
                if vel_rows:
                    mo = float(vel_rows[0]["mo"] or 0)
                    wk = float(vel_rows[0]["wk"] or 0)
                    learning_velocity = min(max(((wk - mo) + 10) / 20.0 * 100, 0), 100) if mo > 0 else 50.0
                else:
                    learning_velocity = 50.0
            else:
                learning_velocity = 50.0

            cvi = _mgr_calc_cvi(avg_shs, learning_velocity, variance, hw_eff)
            grade = _mgr_teacher_grade(cvi)
            struggling = sum(1 for v in all_shs if v < 50)
            excelling = sum(1 for v in all_shs if v >= 80)
        else:
            avg_shs = cvi = learning_velocity = 0.0; grade = "No data"; struggling = excelling = 0

        results.append({
            "teacher_id": tid,
            "teacher_name": t["teacher_name"],
            "email": t["email"],
            "class_count": len(t_classes),
            "avg_cvi": round(cvi, 2),
            "avg_shs": round(avg_shs, 2),
            "struggling_students": struggling,
            "excelling_students": excelling,
            "teacher_grade": grade,
            "learning_velocity": round(learning_velocity, 2),
        })

    results.sort(key=lambda x: x["avg_cvi"], reverse=True)
    return {"teachers": results}


@router.get("/analytics/classes")
async def get_manager_class_analytics(
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """Class CVI ranking — live computation."""
    school_id = str(current_user.get("school_id") or "")

    class_rows = await execute_query(
        """SELECT c.id, c.name AS class_name, c.grade_level, c.section,
                  b.name AS branch_name, u.full_name AS teacher_name
           FROM classes c
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN (
               SELECT DISTINCT ON (class_id) class_id, teacher_id
               FROM teacher_class_subject_assignments
               ORDER BY class_id
           ) tcsa_t ON tcsa_t.class_id = c.id
           LEFT JOIN users u ON u.id = COALESCE(c.teacher_id, tcsa_t.teacher_id)
           WHERE b.school_id = $1::uuid ORDER BY c.name""",
        school_id,
    )

    results = []
    for cls in class_rows:
        cid = str(cls["id"])
        rows = await execute_query(_MGR_SHS_SQL, cid)
        active_rows = [r for r in rows if not r["is_inactive"]]
        inactive_count = len(rows) - len(active_rows)
        shs_vals = [float(r["shs_score"] or 0) for r in active_rows]
        hw_vals = [float(r["homework_rate"] or 0) for r in active_rows]
        vid_vals = [float(r["video_rate"] or 0) for r in active_rows]

        if shs_vals:
            avg_shs = _mgr_stats.mean(shs_vals)
            variance = _mgr_stats.stdev(shs_vals) if len(shs_vals) > 1 else 0.0
            hw_eff = _mgr_stats.mean(hw_vals) if hw_vals else 0.0
            avg_video = _mgr_stats.mean(vid_vals) if vid_vals else 0.0

            vel_row = await execute_one(
                "SELECT AVG(weekly_shs) AS avg_weekly, AVG(monthly_shs) AS avg_monthly FROM student_health_scores WHERE class_id = $1::uuid",
                cid,
            )
            avg_monthly = float(vel_row["avg_monthly"] or 0) if vel_row else 0.0
            if avg_monthly > 0:
                raw_vel = float(vel_row["avg_weekly"] or 0) - avg_monthly
                learning_velocity = min(max((raw_vel + 10) / 20.0 * 100, 0), 100)
            else:
                learning_velocity = 50.0

            cvi = _mgr_calc_cvi(avg_shs, learning_velocity, variance, hw_eff)
            grade = _mgr_teacher_grade(cvi)
            struggling = sum(1 for v in shs_vals if v < 50)
            excelling = sum(1 for v in shs_vals if v >= 80)

            cvi_alert = None
            if avg_video > 85 and hw_eff < 60:
                cvi_alert = "High engagement but low comprehension — content may be too complex"
            elif avg_video < 50 and hw_eff < 60:
                cvi_alert = "Low engagement AND comprehension — teaching approach needs revision"
            elif variance > 25:
                cvi_alert = "Large performance gap — some students being left behind"
        else:
            avg_shs = cvi = avg_video = learning_velocity = 0.0
            grade = "No data"; struggling = excelling = 0; cvi_alert = None

        results.append({
            "class_id": cid,
            "class_name": cls["class_name"],
            "branch_name": cls["branch_name"],
            "teacher_name": cls["teacher_name"],
            "avg_shs": round(avg_shs, 2),
            "avg_cvi": round(cvi, 2),
            "total_students": len(shs_vals),
            "inactive_students": inactive_count,
            "struggling_count": struggling,
            "excelling_count": excelling,
            "teacher_grade": grade,
            "avg_video": round(avg_video, 2),
            "learning_velocity": round(learning_velocity, 2),
            "cvi_alert": cvi_alert,
        })

    results.sort(key=lambda x: x["avg_cvi"], reverse=True)
    return {"classes": results}


@router.get("/analytics/students")
async def get_manager_students_analytics(
    current_user: dict = Depends(require_manager),
):
    """All students in the manager's school with live SHS, class, and teacher info."""
    school_id = str(current_user.get("school_id") or "")

    class_rows = await execute_query(
        """SELECT c.id, c.name AS class_name,
                  b.name AS branch_name, u.full_name AS teacher_name
           FROM classes c
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN (
               SELECT DISTINCT ON (class_id) class_id, teacher_id
               FROM teacher_class_subject_assignments
               ORDER BY class_id
           ) tcsa_t ON tcsa_t.class_id = c.id
           LEFT JOIN users u ON u.id = COALESCE(c.teacher_id, tcsa_t.teacher_id)
           WHERE b.school_id = $1::uuid ORDER BY c.name""",
        school_id,
    )

    students = []
    for cls in class_rows:
        cid = str(cls["id"])
        rows = await execute_query(_MGR_SHS_SQL, cid)
        for r in rows:
            students.append({
                "student_id": str(r["student_id"]),
                "full_name": r["full_name"],
                "class_name": cls["class_name"],
                "branch_name": cls["branch_name"],
                "teacher_name": cls["teacher_name"] or "—",
                "shs_score": round(float(r["shs_score"] or 0), 2),
                "risk_level": _mgr_risk_level(float(r["shs_score"] or 0)),
                "video_rate": round(float(r["video_rate"] or 0), 2),
                "attendance_rate": round(float(r["attendance_rate"] or 0), 2),
                "homework_rate": round(float(r["homework_rate"] or 0), 2),
            })

    students.sort(key=lambda x: x["shs_score"], reverse=True)
    return {"students": students}


@router.get("/analytics/student/{student_id}")
async def get_manager_student_analytics(
    student_id: str,
    period: str = "last_month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """Full SHS detail for a student in manager's school."""
    school_id = str(current_user.get("school_id") or "")
    date_from, date_to = _get_date_range(period, start, end)

    # Verify student belongs to manager's school
    student_check = await execute_one(
        """
        SELECT u.full_name FROM users u
        JOIN enrollments e ON e.student_id = u.id
        JOIN classes c ON c.id = e.class_id
        JOIN branches b ON b.id = c.branch_id
        WHERE u.id = $1::uuid AND b.school_id = $2::uuid AND e.is_active = true
        LIMIT 1
        """,
        student_id, school_id,
    )
    if not student_check:
        raise HTTPException(status_code=404, detail="Student not found in your school")

    # Daily SHS trend (all classes)
    daily = await execute_query(
        """
        SELECT dsm.date, dsm.class_id, c.name AS class_name,
               dsm.daily_shs, dsm.quiz_score, dsm.video_completion_rate,
               dsm.attendance, dsm.homework_submitted
        FROM daily_student_metrics dsm
        JOIN classes c ON c.id = dsm.class_id
        WHERE dsm.student_id = $1::uuid AND dsm.date BETWEEN $2 AND $3
        ORDER BY dsm.date
        """,
        student_id, date_from, date_to,
    )

    # Rolling SHS
    shs_rows = await execute_query(
        "SELECT * FROM student_health_scores WHERE student_id = $1::uuid",
        student_id,
    )

    # Active alerts
    alerts = await execute_query(
        "SELECT alert_type, severity, message, action_required, created_at FROM performance_alerts WHERE student_id = $1::uuid AND is_resolved = false ORDER BY created_at DESC LIMIT 5",
        student_id,
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
        WHERE student_id = $1::uuid AND date BETWEEN $2 AND $3
        """,
        student_id, date_from, date_to,
    )

    return {
        "student_id": student_id,
        "student_name": student_check["full_name"],
        "period": period,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "rolling_scores": [dict(r) for r in shs_rows],
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

# ============================================
# GRAPHICAL ANALYTICS DATA
# ============================================

@router.get("/analytics/dashboard")
async def get_dashboard_analytics(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    days: int = 30,
    current_user: dict = Depends(require_manager),
):
    """Get dashboard analytics (scoped to manager's school)."""
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    if tenant_id and school_id:
        school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        await _assert_tenant_access(current_user, school.get("tenant_id"))
    if tenant_id and branch_id:
        branch = await execute_one("SELECT tenant_id FROM branches WHERE id = $1::uuid", branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
    
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    if tenant_id:
        where_clauses.append(f"b.tenant_id = ${param_count}::uuid")
        params.append(tenant_id)
        param_count += 1
    
    # Daily trend data
    trend_query = f"""
        SELECT 
            sp.date,
            COUNT(DISTINCT sp.student_id) as active_students,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY sp.date
        ORDER BY sp.date
    """
    
    trends = await execute_query(trend_query, *params)
    
    # Performance distribution
    distribution_query = f"""
        SELECT 
            CASE 
                WHEN sp.overall_score >= 90 THEN 'Excellent (90-100)'
                WHEN sp.overall_score >= 75 THEN 'Good (75-89)'
                WHEN sp.overall_score >= 60 THEN 'Average (60-74)'
                WHEN sp.overall_score >= 40 THEN 'Below Average (40-59)'
                ELSE 'Poor (0-39)'
            END as performance_band,
            COUNT(DISTINCT sp.student_id) as student_count
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY performance_band
        ORDER BY 
            CASE performance_band
                WHEN 'Excellent (90-100)' THEN 1
                WHEN 'Good (75-89)' THEN 2
                WHEN 'Average (60-74)' THEN 3
                WHEN 'Below Average (40-59)' THEN 4
                ELSE 5
            END
    """
    
    distribution = await execute_query(distribution_query, *params)
    
    # Subject-wise performance
    subject_query = f"""
        SELECT 
            s.name as subject_name,
            AVG(qa.score) as avg_quiz_score,
            COUNT(DISTINCT qa.student_id) as student_count
        FROM quiz_attempts qa
        JOIN quiz_instances qi ON qa.quiz_instance_id = qi.id
        JOIN published_videos pv ON qi.published_video_id = pv.id
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        JOIN class_subjects cs ON s.id = cs.subject_id
        JOIN classes c ON cs.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE qa.is_completed = true 
            AND qa.submitted_at >= $1
            {' AND ' + ' AND '.join(where_clauses[1:]) if len(where_clauses) > 1 else ''}
        GROUP BY s.name
        ORDER BY avg_quiz_score DESC
    """
    
    subjects = await execute_query(subject_query, *params)
    
    # Top performers
    top_performers_query = f"""
        SELECT 
            u.full_name,
            c.name as class_name,
            AVG(sp.overall_score) as avg_score
        FROM student_performance sp
        JOIN users u ON sp.student_id = u.id
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, c.name
        ORDER BY avg_score DESC
        LIMIT 10
    """
    
    top_performers = await execute_query(top_performers_query, *params)
    
    return {
        "date_from": date_from.isoformat(),
        "date_to": datetime.now().date().isoformat(),
        "trends": [dict(t) for t in trends],
        "performance_distribution": [dict(d) for d in distribution],
        "subject_performance": [dict(s) for s in subjects],
        "top_performers": [dict(tp) for tp in top_performers]
    }


# ============================================
# PASSWORD RESET (for teachers and students)
# ============================================

@router.post("/users/{user_id}/password-reset")
async def send_password_reset_link(user_id: str, current_user: dict = Depends(require_manager)):
    """Generate password reset link for a user in manager's school."""
    
    import uuid
    
    user = await execute_one("SELECT email, role, school_id, tenant_id FROM users WHERE id = $1::uuid", user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.get("role") == "manager" and str(current_user.get("school_id")) != str(user.get("school_id")):
        raise HTTPException(status_code=403, detail="Access denied to this user")
    await _assert_tenant_access(current_user, user.get("tenant_id"))
    
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(hours=24)
    
    query = """
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING token
    """
    
    await execute_one(query, user_id, reset_token, expires_at)
    
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    return {
        "message": "Password reset link generated",
        "email": user["email"],
        "role": user["role"],
        "reset_link": reset_link,
        "token": reset_token
    }


# ============================================
# SYSTEM STATISTICS
# ============================================

@router.get("/statistics/overview")
async def get_system_overview(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: dict = Depends(require_manager),
):
    """Get high-level system statistics (scoped to manager's school)."""
    if current_user.get("role") == "manager":
        school_id = str(current_user.get("school_id") or "")
    tenant_id = current_user.get("tenant_id") if current_user.get("role") == "admin" else None

    if tenant_id and school_id:
        school = await execute_one("SELECT tenant_id FROM schools WHERE id = $1::uuid", school_id)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        await _assert_tenant_access(current_user, school.get("tenant_id"))
    if tenant_id and branch_id:
        branch = await execute_one(
            """
            SELECT b.tenant_id
            FROM branches b
            WHERE b.id = $1::uuid
            """,
            branch_id,
        )
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        await _assert_tenant_access(current_user, branch.get("tenant_id"))
    
    where_clauses = []
    params = []
    param_count = 1
    
    join_tables = ""
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
        join_tables = "JOIN classes c ON e.class_id = c.id"
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
        join_tables = """
            JOIN classes c ON e.class_id = c.id
            JOIN branches b ON c.branch_id = b.id
        """
    if tenant_id:
        where_clauses.append(f"u.tenant_id = ${param_count}::uuid")
        params.append(tenant_id)
        param_count += 1
    
    where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    # Total counts
    stats_query = f"""
        SELECT 
            COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as total_students,
            COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as total_teachers,
            COUNT(DISTINCT e.class_id) as total_classes,
            COUNT(DISTINCT pv.id) as total_videos,
            COUNT(DISTINCT qa.id) as total_quiz_attempts
        FROM users u
        LEFT JOIN enrollments e ON u.id = e.student_id AND e.is_active = true
        {join_tables}
        LEFT JOIN published_videos pv ON e.class_id IS NOT NULL
        LEFT JOIN quiz_instances qi ON pv.id = qi.published_video_id
        LEFT JOIN quiz_attempts qa ON qi.id = qa.quiz_instance_id AND qa.is_completed = true
        {where_clause}
    """
    
    stats = await execute_one(stats_query, *params) if params else await execute_one(stats_query.replace("$1", "NULL"))

    return dict(stats) if stats else {}


# ============================================
# MANAGER CHAPTER MANAGEMENT (add/edit/delete)
# ============================================

class CreateChapterRequest(BaseModel):
    chapter_number: int
    title: str


class UpdateChapterRequest(BaseModel):
    chapter_number: int
    title: str


@router.post("/chapters/{book_id}")
async def manager_add_chapter(
    book_id: str,
    body: CreateChapterRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Manager adds a new approved chapter to an existing book.
    Chapter has teacher_id = NULL (visible to all teachers)."""
    from app.routers.library import ensure_library_tables
    await ensure_library_tables()

    # Verify user is manager
    user_role = current_user.get("role")
    if user_role not in ("manager", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only manager can add chapters")

    book_id = (book_id or "").strip()

    # Verify book exists
    book = await execute_one(
        "SELECT id FROM library_books WHERE id = $1::uuid",
        book_id,
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if not body.title or not body.title.strip():
        raise HTTPException(status_code=400, detail="Chapter title is required")

    # Create chapter with teacher_id = NULL (approved/shared)
    try:
        row = await execute_one(
            """
            INSERT INTO library_chapters (book_id, chapter_number, title, teacher_id)
            VALUES ($1::uuid, $2, $3, NULL)
            RETURNING id, book_id, chapter_number, title, teacher_id, created_at
            """,
            book_id,
            body.chapter_number,
            body.title.strip()[:500],
        )
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail=f"Chapter {body.chapter_number} already exists for this book")
        raise HTTPException(status_code=400, detail=str(e))

    result = dict(row)
    result["id"] = str(result["id"])
    result["book_id"] = str(result["book_id"])
    return {"data": result}


@router.put("/chapters/{chapter_id}")
async def manager_edit_chapter(
    chapter_id: str,
    body: UpdateChapterRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """Manager edits an approved chapter (must have teacher_id = NULL)."""
    from app.routers.library import ensure_library_tables
    await ensure_library_tables()

    # Verify user is manager
    user_role = current_user.get("role")
    if user_role not in ("manager", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only manager can edit chapters")

    chapter_id = (chapter_id or "").strip()

    # Get the chapter
    chapter = await execute_one(
        "SELECT id, teacher_id FROM library_chapters WHERE id = $1::uuid",
        chapter_id,
    )

    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Only allow editing approved chapters (teacher_id IS NULL)
    if chapter["teacher_id"] is not None:
        raise HTTPException(status_code=403, detail="Only approved chapters can be edited by manager")

    if not body.title or not body.title.strip():
        raise HTTPException(status_code=400, detail="Chapter title is required")

    # Update chapter
    updated = await execute_one(
        """
        UPDATE library_chapters
        SET title = $1, chapter_number = $2
        WHERE id = $3::uuid AND teacher_id IS NULL
        RETURNING id, book_id, chapter_number, title, teacher_id, created_at
        """,
        body.title.strip()[:500],
        body.chapter_number,
        chapter_id,
    )

    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update chapter")

    result = dict(updated)
    result["id"] = str(result["id"])
    result["book_id"] = str(result["book_id"])
    return {"data": result}


@router.delete("/chapters/{chapter_id}")
async def manager_delete_chapter(
    chapter_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Manager deletes an approved chapter (must have teacher_id = NULL).
    Does not affect teacher's custom copies of this chapter."""
    from app.routers.library import ensure_library_tables
    await ensure_library_tables()

    # Verify user is manager
    user_role = current_user.get("role")
    if user_role not in ("manager", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only manager can delete chapters")

    chapter_id = (chapter_id or "").strip()

    # Get the chapter
    chapter = await execute_one(
        "SELECT id, teacher_id FROM library_chapters WHERE id = $1::uuid",
        chapter_id,
    )

    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Only allow deleting approved chapters (teacher_id IS NULL)
    if chapter["teacher_id"] is not None:
        raise HTTPException(status_code=403, detail="Only approved chapters can be deleted by manager")

    # Delete chapter (cascade deletes approved topics)
    await execute_write(
        "DELETE FROM library_chapters WHERE id = $1::uuid AND teacher_id IS NULL",
        chapter_id,
    )

    return {"data": {"message": "Chapter deleted successfully", "chapter_id": chapter_id}}
