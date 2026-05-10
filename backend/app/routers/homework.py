"""
Homework: interactive (typed answers) and upload (files), scoped to class/section and library topic.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional, Set, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.routers.auth import get_user_from_token
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
                CHECK (submission_status IN ('pending', 'submitted', 'late', 'reviewed', 'returned')),
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
    questions: Optional[List[HomeworkQuestionIn]] = None


class UpdateHomeworkBody(BaseModel):
    title: Optional[str] = None
    instructions: Optional[str] = None
    total_marks: Optional[float] = None
    due_at: Optional[datetime] = None
    allowed_file_extensions: Optional[str] = None


class ReplaceQuestionsBody(BaseModel):
    questions: List[HomeworkQuestionIn]


class SubmitInteractiveBody(BaseModel):
    answers: List[dict]  # [{ "homework_question_id": "...", "answer_text": "..." }]


class GradeSubmissionBody(BaseModel):
    teacher_feedback: Optional[str] = None
    marks_awarded: Optional[float] = None
    submission_status: Optional[str] = None  # reviewed | returned
    answers: Optional[List[dict]] = None


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


@router.post("")
async def create_homework(
    body: CreateHomeworkBody,
    user: dict = Depends(get_user_from_token),
):
    await ensure_homework_schema()
    uid = user["user_id"]
    role = user.get("role")
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teachers only")

    if not await teacher_can_manage_class(uid, body.class_id):
        raise HTTPException(status_code=403, detail="Not assigned to this class")

    meta = await resolve_topic_hierarchy(body.library_topic_id)
    if not meta:
        raise HTTPException(status_code=400, detail="Invalid library topic")

    if role != "admin" and not await teacher_topic_allowed_for_homework(
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
            status, school_id, branch_id, updated_at
        ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5, $6::uuid,
            $7::uuid, $8::uuid, $9::uuid, $10::uuid,
            $11::uuid, $12, $13, $14,
            'draft', $15::uuid, $16::uuid, NOW()
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
    await execute_write(
        "UPDATE homeworks SET status = 'published', updated_at = NOW() WHERE id = $1::uuid",
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
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    if class_id:
        if not await teacher_can_manage_class(uid, class_id):
            raise HTTPException(status_code=403, detail="Forbidden")
        if role == "admin":
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
    hw = await execute_one("SELECT * FROM homeworks WHERE id = $1::uuid", homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and str(hw["teacher_id"]) != uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not await teacher_can_manage_class(uid, str(hw["class_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    rows = await execute_query(
        """
        SELECT hs.*, u.full_name, u.email
        FROM homework_submissions hs
        JOIN users u ON u.id = hs.student_id
        WHERE hs.homework_id = $1::uuid
        ORDER BY hs.submitted_at DESC NULLS LAST, u.full_name
        """,
        homework_id,
    )
    out = []
    for r in rows:
        rid = str(r["id"])
        answers = await execute_query(
            """
            SELECT ha.*, hq.question_text, hq.sort_order, hq.question_type,
                   hq.options_json, hq.correct_option_index, hq.marks AS question_marks
            FROM homework_answers ha
            JOIN homework_questions hq ON hq.id = ha.homework_question_id
            WHERE ha.submission_id = $1::uuid
            ORDER BY hq.sort_order
            """,
            rid,
        )
        d = dict(r)
        d["answers"] = [dict(a) for a in answers]
        out.append(d)
    return {"data": out}


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
    if new_status not in ("reviewed", "returned"):
        new_status = "reviewed"
    await execute_write(
        """
        UPDATE homework_submissions
        SET teacher_feedback = COALESCE($2, teacher_feedback),
            marks_awarded = COALESCE($3, marks_awarded),
            submission_status = $4,
            reviewed_at = NOW(),
            reviewed_by = $5::uuid
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


@router.get("/student/list")
async def list_student_homework(user: dict = Depends(get_user_from_token)):
    await ensure_homework_schema()
    sid = user["user_id"]
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")

    rows = await execute_query(
        """
        SELECT
            h.*,
            lt.title AS topic_title,
            hs.id AS submission_id,
            hs.submission_status,
            hs.submitted_at,
            hs.is_late,
            hs.marks_awarded,
            hs.teacher_feedback
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id AND e.is_active = true
        JOIN library_topics lt ON lt.id = h.library_topic_id
        LEFT JOIN homework_submissions hs
            ON hs.homework_id = h.id AND hs.student_id = e.student_id
        WHERE e.student_id = $1::uuid AND h.status = 'published'
        ORDER BY h.due_at NULLS LAST, h.created_at DESC
        """,
        sid,
    )
    return {"data": [dict(r) for r in rows]}


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
        """
        SELECT h.*, lt.title AS topic_title
        FROM homeworks h
        JOIN library_topics lt ON lt.id = h.library_topic_id
        JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = $2::uuid AND e.is_active = true
        WHERE h.id = $1::uuid AND h.status = 'published'
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

    hw = await execute_one(
        """
        SELECT h.*
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = $2::uuid AND e.is_active = true
        WHERE h.id = $1::uuid AND h.status = 'published' AND h.homework_type = 'interactive'
        """,
        homework_id,
        sid,
    )
    if not hw:
        raise HTTPException(status_code=400, detail="Invalid homework")

    due = hw.get("due_at")
    late = _is_late(due)
    st = "late" if late else "submitted"

    sub_id = await execute_one(
        """
        INSERT INTO homework_submissions (
            homework_id, student_id, submission_status, submitted_at, is_late
        ) VALUES ($1::uuid, $2::uuid, $3, NOW(), $4)
        ON CONFLICT (homework_id, student_id) DO UPDATE SET
            submission_status = EXCLUDED.submission_status,
            submitted_at = NOW(),
            is_late = EXCLUDED.is_late
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

    hw = await execute_one(
        """
        SELECT h.*
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = $2::uuid AND e.is_active = true
        WHERE h.id = $1::uuid AND h.status = 'published' AND h.homework_type = 'upload'
        """,
        homework_id,
        sid,
    )
    if not hw:
        raise HTTPException(status_code=400, detail="Invalid upload homework")

    allowed = (hw.get("allowed_file_extensions") or "").lower()
    allowed_set = {x.strip().lstrip(".") for x in allowed.split(",") if x.strip()}

    late_flag = _is_late(hw.get("due_at"))
    st_after = "late" if late_flag else "submitted"

    existing_sub = await execute_one(
        """
        SELECT id FROM homework_submissions
        WHERE homework_id = $1::uuid AND student_id = $2::uuid
        """,
        homework_id,
        sid,
    )
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
