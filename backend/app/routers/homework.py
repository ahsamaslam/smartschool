"""
Homework: interactive (typed answers) and upload (files), scoped to class/section and library topic.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, List, Literal, Optional, Set, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.routers.auth import get_user_from_token
from app.utils.claude_ai import generate_homework_structured_json
from app.utils.database import execute_one, execute_query, execute_write

router = APIRouter()


async def ensure_homework_schema():
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS teacher_class_assignments (
            teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (teacher_id, class_id)
        )
        """
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS homeworks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            homework_type VARCHAR(20) NOT NULL
                CHECK (homework_type IN ('interactive', 'upload')),
            title TEXT NOT NULL,
            instructions TEXT,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            library_board_id UUID REFERENCES library_boards(id) ON DELETE SET NULL,
            library_subject_id UUID REFERENCES library_subjects(id) ON DELETE SET NULL,
            library_book_id UUID REFERENCES library_books(id) ON DELETE SET NULL,
            library_chapter_id UUID REFERENCES library_chapters(id) ON DELETE SET NULL,
            library_topic_id UUID NOT NULL REFERENCES library_topics(id) ON DELETE CASCADE,
            total_marks NUMERIC(10,2),
            due_at TIMESTAMPTZ,
            allowed_file_extensions TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
            school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
            branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
            ai_metadata_json JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_homeworks_class ON homeworks(class_id)"
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_homeworks_topic ON homeworks(library_topic_id)"
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_homeworks_teacher ON homeworks(teacher_id)"
    )
    await execute_write(
        "ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN NOT NULL DEFAULT false"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS homework_questions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
            sort_order INT NOT NULL DEFAULT 0,
            question_text TEXT NOT NULL,
            marks NUMERIC(10,2) NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_homework_questions_hw ON homework_questions(homework_id)"
    )
    await execute_write(
        "ALTER TABLE homework_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'text'"
    )
    await execute_write(
        "ALTER TABLE homework_questions ADD COLUMN IF NOT EXISTS options_json JSONB DEFAULT '[]'::jsonb"
    )
    await execute_write(
        "ALTER TABLE homework_questions ADD COLUMN IF NOT EXISTS correct_option_index INT"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS homework_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
            student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            submission_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (submission_status IN (
                    'pending', 'in_progress', 'submitted', 'late', 'reviewed', 'returned', 'missing'
                )),
            submitted_at TIMESTAMPTZ,
            is_late BOOLEAN DEFAULT FALSE,
            teacher_feedback TEXT,
            marks_awarded NUMERIC(10,2),
            reviewed_at TIMESTAMPTZ,
            reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
            upload_files_json JSONB,
            UNIQUE (homework_id, student_id)
        )
        """
    )
    # Widen status check on existing DBs — idempotent via DO block
    await execute_write(
        """
        DO $$
        BEGIN
            ALTER TABLE homework_submissions DROP CONSTRAINT IF EXISTS homework_submissions_submission_status_check;
            ALTER TABLE homework_submissions ADD CONSTRAINT homework_submissions_submission_status_check
                CHECK (submission_status IN (
                    'pending', 'in_progress', 'submitted', 'late', 'reviewed', 'returned', 'missing'
                ));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON homework_submissions(student_id)"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS homework_answers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            submission_id UUID NOT NULL REFERENCES homework_submissions(id) ON DELETE CASCADE,
            homework_question_id UUID NOT NULL REFERENCES homework_questions(id) ON DELETE CASCADE,
            answer_text TEXT,
            marks_awarded NUMERIC(10,2),
            teacher_comment TEXT,
            UNIQUE (submission_id, homework_question_id)
        )
        """
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS teacher_class_subject_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
            branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
            library_board_id UUID REFERENCES library_boards(id) ON DELETE SET NULL,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            library_subject_id UUID NOT NULL REFERENCES library_subjects(id) ON DELETE CASCADE,
            library_book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (teacher_id, class_id, library_subject_id)
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_tcsa_teacher ON teacher_class_subject_assignments(teacher_id)"
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_tcsa_class ON teacher_class_subject_assignments(class_id)"
    )
    # Lesson planning tables
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS lesson_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
            branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            library_class_id UUID REFERENCES library_classes(id) ON DELETE SET NULL,
            library_board_id UUID REFERENCES library_boards(id) ON DELETE SET NULL,
            library_subject_id UUID NOT NULL REFERENCES library_subjects(id) ON DELETE CASCADE,
            library_book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
            planned_date DATE NOT NULL,
            planned_time TIME DEFAULT '09:00',
            duration_minutes INTEGER DEFAULT 45,
            title VARCHAR(500),
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'in_progress', 'completed', 'postponed')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(teacher_id, planned_date, planned_time, class_id, library_subject_id)
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_date ON lesson_plans(teacher_id, planned_date)"
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_lesson_plans_class_date ON lesson_plans(class_id, planned_date)"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS lesson_plan_topics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
            library_topic_id UUID NOT NULL REFERENCES library_topics(id) ON DELETE CASCADE,
            chapter_number INTEGER,
            topic_title VARCHAR(500),
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(lesson_plan_id, library_topic_id)
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_lesson_plan_topics_lesson_id ON lesson_plan_topics(lesson_plan_id)"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS lesson_plan_classes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(lesson_plan_id, class_id)
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_lesson_plan_classes_lesson_id ON lesson_plan_classes(lesson_plan_id)"
    )
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS topic_coverage_tracking (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            library_topic_id UUID NOT NULL REFERENCES library_topics(id) ON DELETE CASCADE,
            class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            first_planned_date DATE,
            last_covered_date DATE,
            coverage_count INTEGER DEFAULT 1,
            is_covered BOOLEAN DEFAULT false,
            covered_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(teacher_id, library_topic_id, class_id)
        )
        """
    )
    await execute_write(
        "CREATE INDEX IF NOT EXISTS idx_topic_coverage_teacher_id ON topic_coverage_tracking(teacher_id)"
    )


def _uuid_or_null(v: Optional[str]) -> Optional[str]:
    if v is None or (isinstance(v, str) and not str(v).strip()):
        return None
    return str(v).strip()


async def sync_teacher_class_subject_assignments(
    teacher_user_id: str, rows: Optional[List[dict]]
) -> None:
    """Replace all per-section subject+book rows for a teacher. Empty list clears."""
    await ensure_homework_schema()
    await execute_write(
        "DELETE FROM teacher_class_subject_assignments WHERE teacher_id = $1::uuid",
        teacher_user_id,
    )
    if not rows:
        return
    seen: set = set()
    for r in rows:
        if not r:
            continue
        cid = r.get("class_id")
        sid = r.get("library_subject_id")
        bid = r.get("library_book_id")
        if not cid or not sid or not bid:
            continue
        key = (str(cid), str(sid))
        if key in seen:
            continue
        seen.add(key)
        await execute_write(
            """
            INSERT INTO teacher_class_subject_assignments (
                teacher_id, school_id, branch_id, library_board_id,
                class_id, library_subject_id, library_book_id
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::uuid)
            ON CONFLICT (teacher_id, class_id, library_subject_id)
            DO UPDATE SET
                library_book_id = EXCLUDED.library_book_id,
                school_id = EXCLUDED.school_id,
                branch_id = EXCLUDED.branch_id,
                library_board_id = EXCLUDED.library_board_id
            """,
            teacher_user_id,
            _uuid_or_null(r.get("school_id")),
            _uuid_or_null(r.get("branch_id")),
            _uuid_or_null(r.get("library_board_id")),
            str(cid),
            str(sid),
            str(bid),
        )


async def teacher_has_any_subject_assignment(teacher_id: str) -> bool:
    await ensure_homework_schema()
    row = await execute_one(
        """
        SELECT 1 AS ok FROM teacher_class_subject_assignments
        WHERE teacher_id = $1::uuid LIMIT 1
        """,
        teacher_id,
    )
    return row is not None


async def teacher_topic_allowed_for_homework(
    teacher_id: str, class_id: str, meta: Optional[dict]
) -> bool:
    """If teacher has subject rows, topic must match assigned subject+book for that class."""
    if not meta:
        return False
    subj = meta.get("library_subject_id")
    book = meta.get("library_book_id")
    if not subj or not book:
        return False
    if not await teacher_has_any_subject_assignment(teacher_id):
        return True
    row = await execute_one(
        """
        SELECT 1 FROM teacher_class_subject_assignments
        WHERE teacher_id = $1::uuid AND class_id = $2::uuid
          AND library_subject_id = $3::uuid AND library_book_id = $4::uuid
        LIMIT 1
        """,
        teacher_id,
        class_id,
        str(subj),
        str(book),
    )
    return row is not None


def filter_library_tree_by_teacher_assignments(
    boards: List[dict], allowed_pairs: Set[Tuple[str, str]]
) -> List[dict]:
    """Keep only subjects/books where (subject_id, book_id) is allowed for this section."""
    out: List[dict] = []
    for b in boards or []:
        subj_list = []
        for s in b.get("subjects") or []:
            sid = str(s.get("id", ""))
            books = []
            for bk in s.get("books") or []:
                bid = str(bk.get("id", ""))
                if sid and bid and (sid, bid) in allowed_pairs:
                    books.append(bk)
            if books:
                subj_list.append({**s, "books": books})
        if subj_list:
            out.append({**b, "subjects": subj_list})
    return out


async def resolve_topic_hierarchy(library_topic_id: str) -> Optional[dict]:
    row = await execute_one(
        """
        SELECT
            lb.id AS library_board_id,
            ls.id AS library_subject_id,
            bk.id AS library_book_id,
            lc.id AS library_chapter_id,
            lt.id AS library_topic_id,
            lt.title AS topic_title
        FROM library_topics lt
        JOIN library_chapters lc ON lc.id = lt.chapter_id
        JOIN library_books bk ON bk.id = lc.book_id
        JOIN library_subjects ls ON ls.id = bk.subject_id
        LEFT JOIN library_boards lb
            ON LOWER(TRIM(COALESCE(lb.name, ''))) = LOWER(TRIM(COALESCE(bk.board_name, '')))
            AND TRIM(COALESCE(bk.board_name, '')) <> ''
        WHERE lt.id = $1::uuid
        LIMIT 1
        """,
        library_topic_id,
    )
    return dict(row) if row else None


async def teacher_can_manage_class(teacher_id: str, class_id: str) -> bool:
    role_row = await execute_one("SELECT role FROM users WHERE id = $1::uuid", teacher_id)
    if role_row and role_row.get("role") == "admin":
        return True
    cl = await execute_one(
        "SELECT teacher_id FROM classes WHERE id = $1::uuid",
        class_id,
    )
    if cl and str(cl["teacher_id"]) == teacher_id:
        return True
    asg = await execute_one(
        """
        SELECT 1 FROM teacher_class_assignments
        WHERE teacher_id = $1::uuid AND class_id = $2::uuid
        """,
        teacher_id,
        class_id,
    )
    return asg is not None


async def student_enrolled_in_class(student_id: str, class_id: str) -> bool:
    row = await execute_one(
        """
        SELECT 1 FROM enrollments
        WHERE student_id = $1::uuid AND class_id = $2::uuid AND is_active = true
        """,
        student_id,
        class_id,
    )
    return row is not None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_late(due: Optional[datetime]) -> bool:
    if not due:
        return False
    return _now_utc() > due if due.tzinfo else _now_utc() > due.replace(tzinfo=timezone.utc)


def _deadline_hard_lock(hw: dict) -> bool:
    """After due, block edits/submits unless teacher enabled late submission."""
    if hw.get("allow_late_submission"):
        return False
    return _is_late(hw.get("due_at"))


def _submission_status_str(row: Optional[dict]) -> str:
    if not row:
        return "pending"
    return str(row.get("submission_status") or "pending")


async def _require_student_may_edit_homework(
    hw: dict, homework_id: str, student_id: str
) -> Optional[dict]:
    """Raises 400 if student cannot save draft or submit. Returns submission row if it exists."""
    ex = await execute_one(
        """
        SELECT id, submission_status, submitted_at
        FROM homework_submissions
        WHERE homework_id = $1::uuid AND student_id = $2::uuid
        """,
        homework_id,
        student_id,
    )
    row = dict(ex) if ex else None
    st = _submission_status_str(row)
    if st == "reviewed":
        raise HTTPException(status_code=400, detail="This homework is already reviewed.")
    if st in ("submitted", "late"):
        raise HTTPException(status_code=400, detail="This homework is already submitted.")
    if st != "returned" and _deadline_hard_lock(hw):
        raise HTTPException(status_code=400, detail="Submission deadline has passed")
    return row


def _prepare_question_row(q: "HomeworkQuestionIn") -> tuple:
    qtype = (q.question_type or "text").lower()
    if qtype not in ("text", "mcq"):
        raise HTTPException(status_code=400, detail="Invalid question_type")
    opts: List[str] = []
    cor: Optional[int] = None
    if qtype == "mcq":
        raw = q.options or []
        opts = [str(x).strip() for x in raw if str(x).strip()]
        if len(opts) < 2:
            raise HTTPException(status_code=400, detail="MCQs need at least two options")
        if q.correct_option_index is None:
            raise HTTPException(status_code=400, detail="Select the correct answer for each MCQ")
        cor = int(q.correct_option_index)
        if cor < 0 or cor >= len(opts):
            raise HTTPException(status_code=400, detail="correct_option_index out of range")
    return qtype, json.dumps(opts), cor


def _sanitize_question_student(q: dict) -> dict:
    out = dict(q)
    if (out.get("question_type") or "text") == "mcq":
        out.pop("correct_option_index", None)
    return out


async def _apply_mcq_auto_grading(submission_id: str, homework_id: str) -> None:
    qs = await execute_query(
        """
        SELECT id, marks, question_type, correct_option_index
        FROM homework_questions
        WHERE homework_id = $1::uuid
        """,
        homework_id,
    )
    for q in qs:
        if (q.get("question_type") or "text") != "mcq":
            continue
        cor = q.get("correct_option_index")
        if cor is None:
            continue
        ans = await execute_one(
            """
            SELECT answer_text FROM homework_answers
            WHERE submission_id = $1::uuid AND homework_question_id = $2::uuid
            """,
            submission_id,
            q["id"],
        )
        if not ans:
            continue
        try:
            sel = int(str(ans.get("answer_text") or "").strip())
        except (TypeError, ValueError):
            sel = -999
        awarded = float(q["marks"]) if sel == int(cor) else 0.0
        await execute_write(
            """
            UPDATE homework_answers
            SET marks_awarded = $3
            WHERE submission_id = $1::uuid AND homework_question_id = $2::uuid
            """,
            submission_id,
            q["id"],
            awarded,
        )


class HomeworkQuestionIn(BaseModel):
    question_text: str
    marks: float = 1.0
    question_type: Literal["text", "mcq"] = "text"
    options: Optional[List[str]] = None
    correct_option_index: Optional[int] = None


class CreateHomeworkBody(BaseModel):
    homework_type: Literal["interactive", "upload"]
    title: str
    instructions: Optional[str] = None
    class_id: str
    library_topic_id: str
    total_marks: Optional[float] = None
    due_at: Optional[datetime] = None
    allowed_file_extensions: Optional[str] = None  # e.g. "pdf,jpg,png"
    allow_late_submission: bool = False
    questions: Optional[List[HomeworkQuestionIn]] = None


class UpdateHomeworkBody(BaseModel):
    title: Optional[str] = None
    instructions: Optional[str] = None
    total_marks: Optional[float] = None
    due_at: Optional[datetime] = None
    allowed_file_extensions: Optional[str] = None
    allow_late_submission: Optional[bool] = None


class ReplaceQuestionsBody(BaseModel):
    questions: List[HomeworkQuestionIn]


class AiGenerateHomeworkBody(BaseModel):
    """Topic title and/or pasted lesson content the model should base questions on."""

    topic_or_content: str = Field(..., min_length=1, max_length=20000)
    class_id: Optional[str] = None
    library_topic_id: Optional[str] = None
    num_mcq: int = Field(default=4, ge=0, le=15)
    num_text: int = Field(default=2, ge=0, le=15)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class SubmitInteractiveBody(BaseModel):
    answers: List[dict]  # [{ "homework_question_id": "...", "answer_text": "..." }]


class GradeSubmissionBody(BaseModel):
    teacher_feedback: Optional[str] = None
    marks_awarded: Optional[float] = None
    submission_status: Optional[str] = None  # reviewed | returned | pending (re-open)
    answers: Optional[List[dict]] = None


# Visibility: enrolled in class AND (
#   legacy rows without subject/book on homework OR
#   no curriculum assignment rows for this section OR
#   homework subject+book matches at least one section assignment row
# )
HOMEWORK_CURRICULUM_GATE_SQL = """
  AND (
    h.library_subject_id IS NULL OR h.library_book_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM teacher_class_subject_assignments t
      WHERE t.class_id = h.class_id
    )
    OR EXISTS (
      SELECT 1 FROM teacher_class_subject_assignments t
      WHERE t.class_id = h.class_id
        AND t.library_subject_id = h.library_subject_id
        AND t.library_book_id = h.library_book_id
    )
  )
"""


@router.get("/teacher/{teacher_id}/curriculum/{class_id}")
async def get_teacher_homework_curriculum(
    teacher_id: str,
    class_id: str,
    user: dict = Depends(get_user_from_token),
):
    """Full library tree for a class, filtered to this teacher's assigned subject+book pairs."""
    await ensure_homework_schema()
    uid = str(user["user_id"])
    role = user.get("role")
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    if role == "teacher" and str(uid) != str(teacher_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    if role == "teacher" and not await teacher_can_manage_class(uid, class_id):
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    from app.routers.exams import _build_library_exam_tree

    rows = await execute_query(
        """
        SELECT library_subject_id::text AS sid, library_book_id::text AS bid
        FROM teacher_class_subject_assignments
        WHERE teacher_id = $1::uuid AND class_id = $2::uuid
        """,
        teacher_id,
        class_id,
    )
    boards = await _build_library_exam_tree(class_id)
    if not rows:
        return {"mode": "library_tree", "boards": boards, "scoped": False}
    pairs = {(r["sid"], r["bid"]) for r in rows}
    filtered = filter_library_tree_by_teacher_assignments(boards, pairs)
    return {"mode": "library_tree", "boards": filtered, "scoped": True}


@router.post("/ai/generate-draft")
async def ai_generate_homework_draft(
    body: AiGenerateHomeworkBody,
    user: dict = Depends(get_user_from_token),
):
    """
    Generate homework title, instructions, and interactive questions (MCQ + written) from
    a topic line and/or pasted lesson content. Does not persist — teacher reviews then saves.
    """
    await ensure_homework_schema()
    uid = user["user_id"]
    role = user.get("role")
    if role not in ("teacher", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Teachers only")

    if body.class_id and not await teacher_can_manage_class(str(uid), body.class_id):
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    meta = None
    if body.library_topic_id:
        meta = await resolve_topic_hierarchy(str(body.library_topic_id).strip())
        if not meta:
            raise HTTPException(status_code=400, detail="Invalid library topic")

    if (
        role not in ("admin", "super_admin")
        and body.class_id
        and meta
        and not await teacher_topic_allowed_for_homework(str(uid), body.class_id, meta)
    ):
        raise HTTPException(
            status_code=403,
            detail="Choose a topic from a subject and book assigned to you for this class.",
        )

    class_hint: Optional[str] = None
    if body.class_id:
        crow = await execute_one(
            "SELECT name FROM classes WHERE id = $1::uuid",
            body.class_id,
        )
        class_hint = crow["name"] if crow else None

    subject_hint = (meta or {}).get("topic_title")

    try:
        raw = await generate_homework_structured_json(
            body.topic_or_content.strip(),
            subject_hint=subject_hint,
            class_hint=class_hint,
            num_mcq=body.num_mcq,
            num_text=body.num_text,
            difficulty=body.difficulty,
        )
    except RuntimeError as ai_err:
        raise HTTPException(status_code=402, detail=str(ai_err))

    questions_out: List[dict] = []
    for q in raw.get("questions") or []:
        qtype = (q.get("question_type") or "text").lower()
        qt = str(q.get("question_text") or "").strip()
        marks = float(q.get("marks") or 1)
        if qtype == "mcq":
            raw_opts = q.get("options") or []
            if not isinstance(raw_opts, list):
                raw_opts = []
            opts = [str(x).strip() for x in raw_opts if str(x).strip()]
            try:
                ci = int(q.get("correct_option_index"))
            except (TypeError, ValueError):
                continue
            if len(opts) < 2:
                continue
            if ci < 0 or ci >= len(opts):
                continue
            questions_out.append(
                {
                    "question_type": "mcq",
                    "question_text": qt,
                    "marks": marks,
                    "options": opts,
                    "correct_option_index": ci,
                }
            )
        elif qt:
            questions_out.append({"question_type": "text", "question_text": qt, "marks": marks})

    return {
        "title": raw.get("title") or "Homework",
        "instructions": raw.get("instructions") or "",
        "questions": questions_out,
    }


@router.post("")
async def create_homework(
    body: CreateHomeworkBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    role = user.get("role")
    if role not in ("teacher", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Teachers only")

    if not await teacher_can_manage_class(uid, body.class_id):
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    meta = await resolve_topic_hierarchy(body.library_topic_id)
    if not meta:
        raise HTTPException(status_code=400, detail="Invalid library topic")

    if role not in ("admin", "super_admin") and not await teacher_topic_allowed_for_homework(
        str(uid), body.class_id, meta
    ):
        raise HTTPException(
            status_code=403,
            detail="Choose a topic from a subject and book assigned to you for this class.",
        )

    sch = await execute_one(
        """
        SELECT b.school_id, c.branch_id
        FROM classes c
        JOIN branches b ON b.id = c.branch_id
        WHERE c.id = $1::uuid
        """,
        body.class_id,
    )

    hw_id = str(uuid.uuid4())
    await execute_write(
        """
        INSERT INTO homeworks (
            id, teacher_id, homework_type, title, instructions, class_id,
            library_board_id, library_subject_id, library_book_id, library_chapter_id,
            library_topic_id, total_marks, due_at, allowed_file_extensions,
            allow_late_submission,
            status, school_id, branch_id, updated_at
        ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5, $6::uuid,
            $7::uuid, $8::uuid, $9::uuid, $10::uuid,
            $11::uuid, $12, $13, $14,
            $15,
            'draft', $16::uuid, $17::uuid, NOW()
        )
        """,
        hw_id,
        uid,
        body.homework_type,
        body.title,
        body.instructions,
        body.class_id,
        meta.get("library_board_id"),
        meta.get("library_subject_id"),
        meta.get("library_book_id"),
        meta.get("library_chapter_id"),
        body.library_topic_id,
        body.total_marks,
        body.due_at,
        body.allowed_file_extensions,
        bool(body.allow_late_submission),
        sch["school_id"] if sch else None,
        sch["branch_id"] if sch else None,
    )

    if body.homework_type == "interactive" and body.questions:
        for i, q in enumerate(body.questions):
            qtype, opts_json, cor_idx = _prepare_question_row(q)
            await execute_write(
                """
                INSERT INTO homework_questions (
                    homework_id, sort_order, question_text, marks,
                    question_type, options_json, correct_option_index
                )
                VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
                """,
                hw_id,
                i,
                q.question_text,
                q.marks,
                qtype,
                opts_json,
                cor_idx,
            )

    row = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", hw_id)
    return {"data": dict(row)}


@router.patch("/submissions/{submission_id}")
async def grade_submission(
    submission_id: str,
    body: GradeSubmissionBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    sub = await execute_one(
        """
        SELECT hs.*, h.teacher_id, h.class_id, h.homework_type
        FROM homework_submissions hs
        JOIN homeworks h ON h.id = hs.homework_id
        WHERE hs.id = $1::uuid
        """,
        submission_id,
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    hw_teacher = str(sub["teacher_id"])
    if user.get("role") != "admin" and hw_teacher != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not await teacher_can_manage_class(uid, str(sub["class_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    new_status = body.submission_status or "reviewed"
    if new_status not in ("reviewed", "returned", "pending"):
        new_status = "reviewed"
    await execute_write(
        """
        UPDATE homework_submissions
        SET teacher_feedback = COALESCE($2, teacher_feedback),
            marks_awarded = COALESCE($3, marks_awarded),
            submission_status = $4::text,
            reviewed_at = CASE WHEN $4::text = 'pending' THEN NULL ELSE NOW() END,
            reviewed_by = CASE WHEN $4::text = 'pending' THEN NULL ELSE $5::uuid END
        WHERE id = $1::uuid
        """,
        submission_id,
        body.teacher_feedback,
        body.marks_awarded,
        new_status,
        uid,
    )

    if body.answers:
        for a in body.answers:
            qid = a.get("homework_question_id")
            if not qid:
                continue
            await execute_write(
                """
                UPDATE homework_answers
                SET marks_awarded = COALESCE($3, marks_awarded),
                    teacher_comment = COALESCE($4, teacher_comment)
                WHERE submission_id = $1::uuid AND homework_question_id = $2::uuid
                """,
                submission_id,
                qid,
                a.get("marks_awarded"),
                a.get("teacher_comment"),
            )

    row = await execute_one(
        "SELECT * FROM homework_submissions WHERE id = $1::uuid",
        submission_id,
    )
    return {"data": dict(row)}


@router.patch("/{homework_id}")
async def update_homework(
    homework_id: str,
    body: UpdateHomeworkBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one(
        "SELECT * FROM homeworks WHERE id = $1::uuid",
        homework_id,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not await teacher_can_manage_class(uid, str(hw["class_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    fields = []
    params: List[Any] = []
    n = 1
    for key, val in body.model_dump(exclude_unset=True).items():
        if val is None:
            continue
        fields.append(f"{key} = ${n}")
        params.append(val)
        n += 1
    if not fields:
        row = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
        return {"data": dict(row)}
    fields.append(f"updated_at = ${n}")
    params.append(_now_utc())
    n += 1
    params.append(homework_id)
    await execute_write(
        f"UPDATE homeworks SET {', '.join(fields)} WHERE id = ${n}::uuid",
        *params,
    )
    row = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    return {"data": dict(row)}


@router.put("/{homework_id}/questions")
async def replace_questions(
    homework_id: str,
    body: ReplaceQuestionsBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one(
        "SELECT * FROM homeworks WHERE id = $1::uuid AND homework_type = 'interactive'",
        homework_id,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Interactive homework not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    await execute_write(
        "DELETE FROM homework_questions WHERE homework_id = $1::uuid",
        homework_id,
    )
    for i, q in enumerate(body.questions):
        qtype, opts_json, cor_idx = _prepare_question_row(q)
        await execute_write(
            """
            INSERT INTO homework_questions (
                homework_id, sort_order, question_text, marks,
                question_type, options_json, correct_option_index
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
            """,
            homework_id,
            i,
            q.question_text,
            q.marks,
            qtype,
            opts_json,
            cor_idx,
        )
    return {"ok": True, "count": len(body.questions)}


@router.post("/{homework_id}/publish")
async def publish_homework(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if hw["homework_type"] == "interactive":
        nq = await execute_one(
            "SELECT COUNT(*) AS c FROM homework_questions WHERE homework_id = $1::uuid",
            homework_id,
        )
        if not nq or nq["c"] == 0:
            raise HTTPException(
                status_code=400, detail="Add at least one question before publishing"
            )

    has_slots = await execute_one(
        """
        SELECT 1 FROM teacher_class_subject_assignments t
        WHERE t.class_id = $1::uuid AND t.teacher_id = $2::uuid
        LIMIT 1
        """,
        str(hw["class_id"]),
        str(hw["teacher_id"]),
    )
    meta = await resolve_topic_hierarchy(str(hw["library_topic_id"]))
    if has_slots and meta:
        ok = await execute_one(
            """
            SELECT 1 FROM teacher_class_subject_assignments t
            WHERE t.class_id = $1::uuid AND t.teacher_id = $2::uuid
              AND t.library_subject_id = $3::uuid AND t.library_book_id = $4::uuid
            LIMIT 1
            """,
            str(hw["class_id"]),
            str(hw["teacher_id"]),
            str(meta["library_subject_id"]),
            str(meta["library_book_id"]),
        )
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="Homework topic subject/book must match your teaching assignment for this class.",
            )

    await execute_write(
        "UPDATE homeworks SET status = 'published', updated_at = NOW() WHERE id = $1::uuid",
        homework_id,
    )
    row = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    return {"data": dict(row)}


@router.post("/{homework_id}/unpublish")
async def unpublish_homework(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    await execute_write(
        "UPDATE homeworks SET status = 'draft', updated_at = NOW() WHERE id = $1::uuid",
        homework_id,
    )
    row = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    return {"data": dict(row)}


@router.get("/teacher/list")
async def list_teacher_homework(
    class_id: Optional[str] = None,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    role = user.get("role")
    if role not in ("teacher", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    if class_id:
        if not await teacher_can_manage_class(uid, class_id):
            raise HTTPException(status_code=403, detail="Forbidden")
        if role in ("admin", "super_admin"):
            rows = await execute_query(
                """
                SELECT h.*, lt.title AS topic_title
                FROM homeworks h
                JOIN library_topics lt ON lt.id = h.library_topic_id
                WHERE h.class_id = $1::uuid
                ORDER BY h.updated_at DESC
                """,
                class_id,
            )
        else:
            rows = await execute_query(
                """
                SELECT h.*, lt.title AS topic_title
                FROM homeworks h
                JOIN library_topics lt ON lt.id = h.library_topic_id
                WHERE h.class_id = $1::uuid AND h.teacher_id = $2::uuid
                ORDER BY h.updated_at DESC
                """,
                class_id,
                uid,
            )
    else:
        rows = await execute_query(
            """
            SELECT h.*, lt.title AS topic_title
            FROM homeworks h
            JOIN library_topics lt ON lt.id = h.library_topic_id
            WHERE h.teacher_id = $1::uuid
            ORDER BY h.updated_at DESC
            LIMIT 200
            """,
            uid,
        )

    return {"data": [dict(r) for r in rows]}


@router.get("/teacher/{homework_id}")
async def get_teacher_homework_detail(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one(
        """
        SELECT h.*, lt.title AS topic_title
        FROM homeworks h
        JOIN library_topics lt ON lt.id = h.library_topic_id
        WHERE h.id = $1::uuid
        """,
        homework_id,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not await teacher_can_manage_class(uid, str(hw["class_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    qs = await execute_query(
        """
        SELECT * FROM homework_questions
        WHERE homework_id = $1::uuid
        ORDER BY sort_order ASC, created_at ASC
        """,
        homework_id,
    )
    return {"data": dict(hw), "questions": [dict(q) for q in qs]}


@router.get("/teacher/{homework_id}/submissions")
async def list_submissions(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one(
        """
        SELECT h.*, lt.title AS topic_title
        FROM homeworks h
        JOIN library_topics lt ON lt.id = h.library_topic_id
        WHERE h.id = $1::uuid
        """,
        homework_id,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not await teacher_can_manage_class(uid, str(hw["class_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    class_id = str(hw["class_id"])
    due = hw.get("due_at")

    roster = await execute_query(
        """
        SELECT
            u.id AS student_id,
            u.full_name,
            u.email,
            hs.id AS id,
            hs.homework_id,
            hs.submission_status,
            hs.submitted_at,
            hs.is_late,
            hs.marks_awarded,
            hs.teacher_feedback,
            hs.upload_files_json,
            hs.reviewed_at,
            CASE
              WHEN $2::timestamptz IS NOT NULL AND $2::timestamptz < NOW()
                   AND COALESCE(hs.submission_status, 'pending') IN ('pending', 'in_progress')
                   AND hs.submitted_at IS NULL
                THEN 'missing'
              WHEN COALESCE(hs.submission_status, 'pending') = 'returned' THEN 'returned'
              WHEN COALESCE(hs.submission_status, 'pending') = 'reviewed' THEN 'reviewed'
              WHEN COALESCE(hs.submission_status, 'pending') IN ('submitted', 'late')
                   AND COALESCE(hs.is_late, false) = true
                THEN 'late_awaiting'
              WHEN COALESCE(hs.submission_status, 'pending') IN ('submitted', 'late')
                THEN 'submitted_awaiting'
              WHEN hs.submission_status = 'in_progress' THEN 'in_progress'
              ELSE 'pending'
            END AS effective_status
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        LEFT JOIN homework_submissions hs
            ON hs.homework_id = $1::uuid AND hs.student_id = u.id
        WHERE e.class_id = $3::uuid AND e.is_active = true
        ORDER BY u.full_name
        """,
        homework_id,
        due,
        class_id,
    )

    sub_ids = [str(r["id"]) for r in roster if r.get("id")]
    answers_by_sub: dict = {}
    if sub_ids:
        ans_rows = await execute_query(
            """
            SELECT ha.*, hq.question_text, hq.sort_order, hq.question_type,
                   hq.options_json, hq.correct_option_index, hq.marks AS question_marks
            FROM homework_answers ha
            JOIN homework_questions hq ON hq.id = ha.homework_question_id
            WHERE ha.submission_id = ANY($1::uuid[])
            ORDER BY ha.submission_id, hq.sort_order
            """,
            sub_ids,
        )
        for a in ans_rows:
            sid = str(a["submission_id"])
            answers_by_sub.setdefault(sid, []).append(dict(a))

    out = []
    marks_vals: List[float] = []
    for r in roster:
        d = dict(r)
        sid_sub = d.get("id")
        if sid_sub:
            d["answers"] = answers_by_sub.get(str(sid_sub), [])
            if d.get("marks_awarded") is not None:
                try:
                    marks_vals.append(float(d["marks_awarded"]))
                except (TypeError, ValueError):
                    pass
        else:
            d["answers"] = []
            d["submission_status"] = d.get("submission_status") or "pending"
        out.append(d)

    analytics = {
        "total_students": len(out),
        "missing": sum(1 for x in out if x.get("effective_status") == "missing"),
        "pending": sum(1 for x in out if x.get("effective_status") == "pending"),
        "in_progress": sum(1 for x in out if x.get("effective_status") == "in_progress"),
        "awaiting_review": sum(
            1 for x in out if x.get("effective_status") in ("submitted_awaiting", "late_awaiting")
        ),
        "reviewed": sum(1 for x in out if x.get("effective_status") == "reviewed"),
        "returned": sum(1 for x in out if x.get("effective_status") == "returned"),
        "average_marks_awarded": round(sum(marks_vals) / len(marks_vals), 2) if marks_vals else None,
    }

    return {"data": out, "analytics": analytics, "homework": dict(hw)}


@router.post("/submissions/integrity")
async def submit_integrity_report(
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Store integrity tracking data for homework submission."""
    await ensure_homework_schema()
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    homework_id = body.get("homework_id")
    reports = body.get("reports", [])

    if not homework_id or not reports:
        return {"status": "ok"}  # Silent success for empty data

    # Create integrity tracking table if not exists
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS submission_integrity_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            homework_id UUID NOT NULL REFERENCES homeworks(id),
            student_id UUID NOT NULL REFERENCES users(id),
            question_id UUID,
            paste_events JSONB,
            typing_analysis JSONB,
            focus_losses JSONB,
            draft_history JSONB,
            flags JSONB,
            risk_level VARCHAR(20),
            created_at TIMESTAMP DEFAULT NOW()
        )
        """
    )

    student_id = user["user_id"]

    # Store each report
    for report in reports:
        await execute_write(
            """
            INSERT INTO submission_integrity_reports
            (homework_id, student_id, question_id, paste_events, typing_analysis,
             focus_losses, draft_history, flags, risk_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            homework_id,
            student_id,
            report.get("questionId"),
            json.dumps(report.get("pasteEvents", [])),
            json.dumps(report.get("typingAnalysis", {})),
            json.dumps(report.get("focusLosses", [])),
            json.dumps(report.get("draftHistory", [])),
            json.dumps(report.get("flags", [])),
            report.get("riskLevel"),
        )

    return {"status": "ok", "stored": len(reports)}


@router.get("/teacher/{homework_id}/integrity-reports")
async def get_integrity_reports(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    """Get integrity reports for all submissions of a homework (teacher only)."""
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Verify teacher owns this homework
    hw = await execute_one(
        "SELECT id, teacher_id FROM homeworks WHERE id = $1::uuid",
        homework_id,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if user.get("role") != "admin" and str(hw["teacher_id"]) != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Get all integrity reports grouped by submission
    reports = await execute_query(
        """
        SELECT
            ir.id,
            ir.student_id,
            u.full_name,
            u.email,
            ir.question_id,
            ir.paste_events,
            ir.typing_analysis,
            ir.focus_losses,
            ir.flags,
            ir.risk_level,
            ir.created_at,
            hs.submission_status,
            hs.submitted_at
        FROM submission_integrity_reports ir
        JOIN users u ON u.id = ir.student_id
        LEFT JOIN homework_submissions hs ON hs.homework_id = ir.homework_id AND hs.student_id = ir.student_id
        WHERE ir.homework_id = $1::uuid
        ORDER BY ir.created_at DESC, ir.student_id
        """,
        homework_id,
    )

    # Group by student
    grouped = {}
    for row in reports:
        sid = str(row["student_id"])
        if sid not in grouped:
            grouped[sid] = {
                "student_id": sid,
                "student_name": row["full_name"],
                "student_email": row["email"],
                "submission_status": row["submission_status"],
                "submitted_at": row["submitted_at"],
                "reports": [],
            }
        grouped[sid]["reports"].append({
            "id": str(row["id"]),
            "question_id": str(row["question_id"]) if row["question_id"] else None,
            "paste_events": row["paste_events"] or [],
            "typing_analysis": row["typing_analysis"] or {},
            "focus_losses": row["focus_losses"] or [],
            "flags": row["flags"] or [],
            "risk_level": row["risk_level"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        })

    return {"data": list(grouped.values())}


async def assert_student_can_access_homework(student_id: str, homework_id: str) -> dict:
    """Published homework visible to this student: enrolled in class + curriculum gate."""
    row = await execute_one(
        f"""
        SELECT h.*
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = $2::uuid AND e.is_active = true
        WHERE h.id = $1::uuid AND h.status = 'published'
        {HOMEWORK_CURRICULUM_GATE_SQL}
        """,
        homework_id,
        student_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Homework not available")
    return dict(row)


async def build_student_homework_dashboard(student_id: str) -> dict:
    rows = await execute_query(
        f"""
        SELECT
            h.id,
            h.title,
            h.instructions,
            h.homework_type,
            h.class_id,
            h.due_at,
            h.total_marks,
            h.library_topic_id,
            h.created_at,
            COALESCE(h.allow_late_submission, false) AS allow_late_submission,
            lt.title AS topic_title,
            ls.name AS subject_name,
            lb.title AS book_title,
            lbo.name AS board_name,
            tu.full_name AS teacher_name,
            hs.id AS submission_id,
            hs.submission_status,
            hs.submitted_at,
            hs.is_late,
            hs.marks_awarded,
            hs.teacher_feedback,
            hs.reviewed_at,
            CASE
              WHEN hs.submission_status = 'missing'
                   AND (h.due_at IS NULL OR h.due_at >= NOW())
                THEN 'pending'
              WHEN COALESCE(hs.submission_status, 'pending') = 'returned' THEN 'returned'
              WHEN COALESCE(hs.submission_status, 'pending') = 'reviewed' THEN 'reviewed'
              WHEN COALESCE(hs.submission_status, 'pending') IN ('submitted', 'late')
                   AND COALESCE(hs.is_late, false) = true
                THEN 'late_awaiting'
              WHEN COALESCE(hs.submission_status, 'pending') IN ('submitted', 'late')
                THEN 'submitted_awaiting'
              WHEN h.due_at IS NOT NULL AND h.due_at < NOW()
                   AND COALESCE(h.allow_late_submission, false) = false
                   AND COALESCE(hs.submission_status, 'pending') IN ('pending', 'in_progress', 'missing')
                   AND (hs.submitted_at IS NULL OR hs.submission_status = 'missing')
                THEN 'missing'
              WHEN h.due_at IS NOT NULL AND h.due_at < NOW()
                   AND COALESCE(h.allow_late_submission, false) = true
                   AND COALESCE(hs.submission_status, 'pending') IN ('pending', 'in_progress', 'missing')
                   AND (hs.submitted_at IS NULL OR hs.submission_status = 'missing')
                THEN 'late_open'
              WHEN hs.submission_status = 'in_progress' THEN 'in_progress'
              ELSE 'pending'
            END AS ui_bucket
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id AND e.is_active = true
        JOIN library_topics lt ON lt.id = h.library_topic_id
        LEFT JOIN library_subjects ls ON ls.id = h.library_subject_id
        LEFT JOIN library_books lb ON lb.id = h.library_book_id
        LEFT JOIN library_boards lbo ON lbo.id = h.library_board_id
        JOIN users tu ON tu.id = h.teacher_id
        LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = e.student_id
        WHERE e.student_id = $1::uuid AND h.status = 'published'
        {HOMEWORK_CURRICULUM_GATE_SQL}
        ORDER BY h.due_at NULLS LAST, h.created_at DESC
        """,
        student_id,
    )
    data = [dict(r) for r in rows]
    now = _now_utc()
    summary = {
        "missing": 0,
        "late_open": 0,
        "pending": 0,
        "in_progress": 0,
        "submitted_awaiting": 0,
        "late_awaiting": 0,
        "reviewed": 0,
        "returned": 0,
        "overdue_not_submitted": 0,
        "action_open": 0,
    }
    for r in data:
        b = r.get("ui_bucket") or "pending"
        if b in summary:
            summary[b] += 1
        if b == "missing":
            summary["overdue_not_submitted"] += 1
        if b in (
            "missing",
            "late_open",
            "pending",
            "in_progress",
            "returned",
            "submitted_awaiting",
            "late_awaiting",
        ):
            summary["action_open"] += 1

    notifications: List[dict] = []
    for r in data:
        hid = str(r["id"])
        title = r.get("title") or "Homework"
        due = r.get("due_at")
        bucket = r.get("ui_bucket")
        created = r.get("created_at")
        reviewed_at = r.get("reviewed_at")
        st = r.get("submission_status") or "pending"

        if created:
            ca = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
            if (now - ca).total_seconds() < 7 * 86400 and bucket in ("pending", "in_progress", "late_open"):
                notifications.append(
                    {
                        "type": "new_homework",
                        "homework_id": hid,
                        "title": title,
                        "message": f"New homework assigned: {title}",
                    }
                )
        if due:
            due_dt = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
            if due_dt - now <= timedelta(days=1) and due_dt > now and bucket not in (
                "reviewed",
                "submitted_awaiting",
                "late_awaiting",
            ):
                notifications.append(
                    {
                        "type": "due_tomorrow",
                        "homework_id": hid,
                        "title": title,
                        "message": f"Homework due soon: {title}",
                    }
                )
        if st == "reviewed" and reviewed_at:
            ra = reviewed_at if reviewed_at.tzinfo else reviewed_at.replace(tzinfo=timezone.utc)
            if (now - ra).total_seconds() < 5 * 86400:
                notifications.append(
                    {
                        "type": "homework_reviewed",
                        "homework_id": hid,
                        "title": title,
                        "message": f"Homework reviewed: {title}",
                    }
                )
        if st == "returned":
            notifications.append(
                {
                    "type": "homework_returned",
                    "homework_id": hid,
                    "title": title,
                    "message": f"Homework returned for correction: {title}",
                }
            )

    return {"data": data, "summary": summary, "notifications": notifications[:25]}


@router.get("/student/list")
async def list_student_homework(user: dict = Depends(get_user_from_token)):
    await ensure_homework_schema()
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")
    return await build_student_homework_dashboard(str(user["user_id"]))


@router.get("/admin/student/{student_id}/homework-list")
async def admin_student_homework_list(
    student_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return await build_student_homework_dashboard(str(student_id))


@router.get("/student/{homework_id}")
async def get_student_homework_view(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    sid = user["user_id"]
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")

    hw = await execute_one(
        f"""
        SELECT h.*, lt.title AS topic_title,
               ls.name AS subject_name,
               lb.title AS book_title,
               lbo.name AS board_name,
               tu.full_name AS teacher_name
        FROM homeworks h
        JOIN library_topics lt ON lt.id = h.library_topic_id
        LEFT JOIN library_subjects ls ON ls.id = h.library_subject_id
        LEFT JOIN library_books lb ON lb.id = h.library_book_id
        LEFT JOIN library_boards lbo ON lbo.id = h.library_board_id
        JOIN users tu ON tu.id = h.teacher_id
        JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = $2::uuid AND e.is_active = true
        WHERE h.id = $1::uuid AND h.status = 'published'
        {HOMEWORK_CURRICULUM_GATE_SQL}
        """,
        homework_id,
        sid,
    )
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not available")

    sub = await execute_one(
        """
        SELECT * FROM homework_submissions
        WHERE homework_id = $1::uuid AND student_id = $2::uuid
        """,
        homework_id,
        sid,
    )

    qs = []
    if hw["homework_type"] == "interactive":
        qs = await execute_query(
            """
            SELECT id, sort_order, question_text, marks, question_type, options_json
            FROM homework_questions
            WHERE homework_id = $1::uuid
            ORDER BY sort_order
            """,
            homework_id,
        )

    answers = []
    if sub:
        answers = await execute_query(
            """
            SELECT ha.homework_question_id, ha.answer_text, ha.marks_awarded, ha.teacher_comment
            FROM homework_answers ha
            WHERE ha.submission_id = $1::uuid
            """,
            str(sub["id"]),
        )

    return {
        "homework": dict(hw),
        "submission": dict(sub) if sub else None,
        "questions": [_sanitize_question_student(dict(q)) for q in qs],
        "answers": [dict(a) for a in answers],
    }


@router.post("/student/{homework_id}/save-progress")
async def save_homework_progress(
    homework_id: str,
    body: SubmitInteractiveBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    sid = user["user_id"]
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    hw = await assert_student_can_access_homework(sid, homework_id)
    if hw["homework_type"] != "interactive":
        raise HTTPException(status_code=400, detail="Only interactive homework supports saving progress")

    await _require_student_may_edit_homework(hw, homework_id, str(sid))

    sub_id_row = await execute_one(
        """
        INSERT INTO homework_submissions (
            homework_id, student_id, submission_status, submitted_at, is_late
        ) VALUES ($1::uuid, $2::uuid, 'in_progress', NULL, false)
        ON CONFLICT (homework_id, student_id) DO UPDATE SET
            submission_status = CASE
                WHEN homework_submissions.submission_status IN ('submitted', 'late', 'reviewed')
                    THEN homework_submissions.submission_status
                ELSE 'in_progress'
            END
        RETURNING id
        """,
        homework_id,
        sid,
    )
    sid_row = str(sub_id_row["id"])

    for a in body.answers:
        qid = a.get("homework_question_id")
        if not qid:
            continue
        txt = a.get("answer_text") or ""
        await execute_write(
            """
            INSERT INTO homework_answers (submission_id, homework_question_id, answer_text)
            VALUES ($1::uuid, $2::uuid, $3)
            ON CONFLICT (submission_id, homework_question_id) DO UPDATE SET
                answer_text = EXCLUDED.answer_text
            """,
            sid_row,
            qid,
            txt,
        )

    return {"ok": True, "submission_id": sid_row, "status": "in_progress"}


@router.post("/student/{homework_id}/submit-interactive")
async def submit_interactive(
    homework_id: str,
    body: SubmitInteractiveBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    sid = user["user_id"]
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    hw = await assert_student_can_access_homework(sid, homework_id)
    if hw["homework_type"] != "interactive":
        raise HTTPException(status_code=400, detail="Invalid homework")

    await _require_student_may_edit_homework(hw, homework_id, str(sid))

    due = hw.get("due_at")
    late = _is_late(due)
    st = "late" if late else "submitted"

    sub_id = await execute_one(
        """
        INSERT INTO homework_submissions (
            homework_id, student_id, submission_status, submitted_at, is_late
        ) VALUES ($1::uuid, $2::uuid, $3, NOW(), $4)
        ON CONFLICT (homework_id, student_id) DO UPDATE SET
            submission_status = CASE
                WHEN homework_submissions.submission_status = 'reviewed'
                    THEN homework_submissions.submission_status
                ELSE EXCLUDED.submission_status
            END,
            submitted_at = CASE
                WHEN homework_submissions.submission_status = 'reviewed'
                    THEN homework_submissions.submitted_at
                ELSE NOW()
            END,
            is_late = CASE
                WHEN homework_submissions.submission_status = 'reviewed'
                    THEN homework_submissions.is_late
                ELSE EXCLUDED.is_late
            END
        RETURNING id
        """,
        homework_id,
        sid,
        st,
        late,
    )
    sid_row = str(sub_id["id"])

    for a in body.answers:
        qid = a.get("homework_question_id")
        if not qid:
            continue
        txt = a.get("answer_text") or ""
        await execute_write(
            """
            INSERT INTO homework_answers (submission_id, homework_question_id, answer_text)
            VALUES ($1::uuid, $2::uuid, $3)
            ON CONFLICT (submission_id, homework_question_id) DO UPDATE SET
                answer_text = EXCLUDED.answer_text
            """,
            sid_row,
            qid,
            txt,
        )

    await _apply_mcq_auto_grading(sid_row, homework_id)

    return {"ok": True, "submission_id": sid_row, "status": st}


@router.post("/student/{homework_id}/submit-upload")
async def submit_upload(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
    files: List[UploadFile] = File(...),
):
    await ensure_homework_schema()
    sid = user["user_id"]
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    hw = await assert_student_can_access_homework(sid, homework_id)
    if hw["homework_type"] != "upload":
        raise HTTPException(status_code=400, detail="Invalid upload homework")

    allowed = (hw.get("allowed_file_extensions") or "").lower()
    allowed_set = {x.strip().lstrip(".") for x in allowed.split(",") if x.strip()}

    late_flag = _is_late(hw.get("due_at"))
    st_after = "late" if late_flag else "submitted"

    existing_sub = await _require_student_may_edit_homework(hw, homework_id, str(sid))
    if existing_sub:
        submission_id = str(existing_sub["id"])
    else:
        ins = await execute_one(
            """
            INSERT INTO homework_submissions (
                homework_id, student_id, submission_status, upload_files_json
            ) VALUES ($1::uuid, $2::uuid, 'pending', '[]'::jsonb)
            RETURNING id
            """,
            homework_id,
            sid,
        )
        submission_id = str(ins["id"])

    folder = os.path.join("static", "homework_uploads", submission_id)
    os.makedirs(folder, exist_ok=True)

    stored = []
    for f in files:
        ext = (f.filename or "").rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else ""
        if allowed_set and ext and ext not in allowed_set:
            raise HTTPException(
                status_code=400,
                detail=f"File type .{ext} not allowed. Allowed: {allowed}",
            )
        fname = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
        path = os.path.join(folder, fname)
        content = await f.read()
        with open(path, "wb") as out:
            out.write(content)
        rel = f"/static/homework_uploads/{submission_id}/{fname}"
        stored.append(
            {
                "path": rel,
                "original_name": f.filename or fname,
                "mime": f.content_type or "application/octet-stream",
            }
        )

    await execute_write(
        """
        UPDATE homework_submissions
        SET upload_files_json = $2::jsonb,
            submission_status = $3,
            is_late = $4,
            submitted_at = NOW()
        WHERE id = $1::uuid
        """,
        submission_id,
        json.dumps(stored),
        st_after,
        late_flag,
    )

    return {"ok": True, "submission_id": submission_id, "files": stored, "status": st_after}


@router.delete("/{homework_id}")
async def delete_homework(
    homework_id: str,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    hw = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    await execute_write("DELETE FROM homeworks WHERE id = $1::uuid", homework_id)
    return {"ok": True}
