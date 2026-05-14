"""
Exam Module Router
Handles AI-generated and manual exam papers for teachers.
"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import logging
import os
import uuid
from uuid import NAMESPACE_URL, uuid5

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.claude_ai import generate_exam_structured
from app.routers.auth import get_user_from_token

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================
# REQUEST / RESPONSE MODELS
# ============================================

class CreateExamRequest(BaseModel):
    teacher_id: str
    class_id: str
    subject_id: str
    title: str
    complexity: str = "medium"
    exam_format: Dict[str, int]  # {"mcq": 10, "short_answer": 5, "long_answer": 3, "fill_in_blank": 4}
    # Exactly one scope: explicit topics, whole chapter, or whole book (library topics expanded server-side).
    topic_ids: Optional[List[str]] = None
    chapter_id: Optional[str] = None
    book_id: Optional[str] = None
    # Optional library board (for reporting / student filtering); stored on exam row.
    board_id: Optional[str] = None


class UpdateExamRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None


class UpdateQuestionRequest(BaseModel):
    question_text: Optional[str] = None
    options: Optional[Dict[str, str]] = None
    correct_answer: Optional[str] = None
    marks: Optional[int] = None


class AddQuestionRequest(BaseModel):
    question_type: str
    question_text: str
    options: Optional[Dict[str, str]] = None
    correct_answer: Optional[str] = None
    marks: int = 1


# ============================================
# HELPERS
# ============================================

async def _fetch_exam_with_questions(exam_id: str) -> dict:
    exam = await execute_one(
        """SELECT te.*, COALESCE(s.name, ls.name) AS subject_name, cl.name AS class_name
           FROM teacher_exams te
           LEFT JOIN subjects s ON te.subject_id = s.id
           LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
           LEFT JOIN classes cl ON te.class_id = cl.id
           WHERE te.id = $1""",
        exam_id,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = await execute_query(
        "SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_index ASC, created_at ASC",
        exam_id,
    )

    # Parse JSONB options field
    q_list = []
    for q in questions:
        qd = dict(q)
        if isinstance(qd.get("options"), str):
            try:
                qd["options"] = json.loads(qd["options"])
            except Exception:
                pass
        q_list.append(qd)

    result = dict(exam)
    result["questions"] = q_list
    result["question_count"] = len(q_list)
    result["total_marks"] = sum(q.get("marks", 1) for q in q_list)
    return result


def _slide_bullets_from_json(slides_raw: str) -> str:
    slide_text = ""
    if not slides_raw:
        return slide_text
    try:
        slides = json.loads(slides_raw)
        if isinstance(slides, list):
            for slide in slides:
                if isinstance(slide, dict):
                    for bullet in slide.get("content", []):
                        slide_text += f"- {bullet}\n"
    except Exception:
        pass
    return slide_text


async def _topic_rows_ordered(topic_ids: List[str]) -> List[Dict]:
    """Resolve topic titles from legacy `topics` or library `library_topics`, preserving order."""
    if not topic_ids:
        return []
    placeholders = ", ".join(f"${i+1}" for i in range(len(topic_ids)))
    legacy = await execute_query(
        f"SELECT id, title FROM topics WHERE id IN ({placeholders})",
        *topic_ids,
    )
    by_id = {str(r["id"]): r for r in legacy}
    missing = [tid for tid in topic_ids if str(tid) not in by_id]
    if missing:
        ph2 = ", ".join(f"${i+1}" for i in range(len(missing)))
        lib_rows = await execute_query(
            f"SELECT id, title FROM library_topics WHERE id IN ({ph2})",
            *missing,
        )
        for r in lib_rows:
            by_id[str(r["id"])] = r
    ordered = []
    for tid in topic_ids:
        row = by_id.get(str(tid))
        if row:
            ordered.append(row)
    return ordered


async def _build_syllabus_context(topic_ids: List[str]) -> str:
    """Fetch topic content + slide bullets to use as RAG context for Claude."""
    if not topic_ids:
        return ""
    placeholders = ", ".join(f"${i+1}" for i in range(len(topic_ids)))
    topics = await execute_query(
        f"SELECT id, title, content, slides_json FROM topics WHERE id IN ({placeholders})",
        *topic_ids,
    )
    by_id: Dict[str, Dict] = {}
    for t in topics:
        tid = str(t["id"])
        by_id[tid] = {
            "title": t.get("title", ""),
            "content": t.get("content") or "",
            "slides_json": t.get("slides_json") or "",
        }
    missing = [tid for tid in topic_ids if str(tid) not in by_id]
    if missing:
        ph2 = ", ".join(f"${i+1}" for i in range(len(missing)))
        lib_topics = await execute_query(
            f"SELECT id, title, content_body, slides_json FROM library_topics WHERE id IN ({ph2})",
            *missing,
        )
        for t in lib_topics:
            tid = str(t["id"])
            by_id[tid] = {
                "title": t.get("title", ""),
                "content": (t.get("content_body") or ""),
                "slides_json": t.get("slides_json") or "",
            }
    parts = []
    for tid in topic_ids:
        t = by_id.get(str(tid))
        if not t:
            continue
        title = t.get("title", "")
        content = t.get("content") or ""
        slide_text = _slide_bullets_from_json(t.get("slides_json") or "")
        parts.append(f"## {title}\n{content}\n{slide_text}")
    return "\n\n".join(parts)


async def _resolve_exam_topic_ids(req: CreateExamRequest) -> List[str]:
    """Expand library scope into concrete topic UUIDs for storage and RAG."""
    if req.book_id:
        rows = await execute_query(
            """
            SELECT lt.id
            FROM library_topics lt
            INNER JOIN library_chapters lc ON lc.id = lt.chapter_id
            WHERE lc.book_id = $1::uuid
            ORDER BY lc.chapter_number ASC, lt.created_at ASC
            """,
            req.book_id,
        )
        return [str(r["id"]) for r in rows]
    if req.chapter_id:
        rows = await execute_query(
            "SELECT id FROM library_topics WHERE chapter_id = $1::uuid ORDER BY created_at ASC",
            req.chapter_id,
        )
        return [str(r["id"]) for r in rows]
    if req.topic_ids:
        return list(req.topic_ids)
    raise HTTPException(
        status_code=400,
        detail="Provide topic_ids (specific topics), chapter_id (whole chapter), or book_id (whole book).",
    )


async def _chapters_with_topics_for_book(book_id: str) -> List[Dict]:
    """Chapters and topics for one book; topic flags for learner UI."""
    chapters = await execute_query(
        """
        SELECT id, chapter_number, title
        FROM library_chapters
        WHERE book_id = $1::uuid
        ORDER BY chapter_number ASC
        """,
        book_id,
    )
    out = []
    for ch in chapters:
        topics = await execute_query(
            """
            SELECT id, title,
                   (
                       lecture_video_url IS NOT NULL
                       AND btrim(COALESCE(lecture_video_url::text, '')) <> ''
                   ) AS has_lecture,
                   (
                       slides_json IS NOT NULL
                       AND btrim(COALESCE(slides_json, '')) <> ''
                       AND replace(lower(btrim(slides_json)), ' ', '')
                           NOT IN ('null', '[]', '""', '{}')
                       AND length(btrim(slides_json)) > 2
                   ) AS has_slides
            FROM library_topics
            WHERE chapter_id = $1::uuid
            ORDER BY created_at ASC
            """,
            ch["id"],
        )
        out.append(
            {
                "id": str(ch["id"]),
                "chapter_number": ch["chapter_number"],
                "title": ch["title"],
                "topics": [
                    {
                        "id": str(t["id"]),
                        "title": t["title"],
                        "has_lecture": bool(t.get("has_lecture")),
                        "has_slides": bool(t.get("has_slides")),
                    }
                    for t in topics
                ],
            }
        )
    return out


async def _build_library_exam_tree(class_id: str) -> List[Dict]:
    """Board → subjects → books → chapters → topics for the Create Exam modal."""
    boards_rows = await execute_query(
        """
        SELECT DISTINCT ss.board_id, lb.name AS board_name
        FROM section_subjects ss
        JOIN library_boards lb ON lb.id = ss.board_id
        WHERE ss.class_id = $1::uuid
        ORDER BY lb.name
        """,
        class_id,
    )
    tree: List[Dict] = []
    if boards_rows:
        for b in boards_rows:
            subjects = await execute_query(
                """
                SELECT DISTINCT ls.id, ls.name
                FROM section_subjects ss
                JOIN library_subjects ls ON ls.id = ss.subject_id
                WHERE ss.class_id = $1::uuid AND ss.board_id = $2::uuid
                ORDER BY ls.name
                """,
                class_id,
                b["board_id"],
            )
            subj_list = []
            for s in subjects:
                # Only books explicitly assigned to this section (section_books).
                # When library_books.board_name is set, show the book only under the matching board.
                books = await execute_query(
                    """
                    SELECT DISTINCT lb.id, lb.title
                    FROM section_books sb
                    INNER JOIN library_books lb ON lb.id = sb.book_id
                    WHERE sb.class_id = $1::uuid
                      AND lb.subject_id = $2::uuid
                      AND (
                          COALESCE(TRIM(lb.board_name), '') = ''
                          OR LOWER(TRIM(lb.board_name)) = LOWER(TRIM($3::text))
                      )
                    ORDER BY lb.title
                    """,
                    class_id,
                    s["id"],
                    b["board_name"] or "",
                )
                book_list = []
                for bk in books:
                    book_list.append(
                        {
                            "id": str(bk["id"]),
                            "title": bk["title"],
                            "chapters": await _chapters_with_topics_for_book(str(bk["id"])),
                        }
                    )
                subj_list.append(
                    {
                        "id": str(s["id"]),
                        "name": s["name"],
                        "books": book_list,
                    }
                )
            tree.append(
                {
                    "id": str(b["board_id"]),
                    "name": b["board_name"],
                    "subjects": subj_list,
                }
            )
        return tree

    # No section_subjects: group assigned books by board_name + subject
    book_rows = await execute_query(
        """
        SELECT lb.id AS book_id, lb.title AS book_title, lb.subject_id, ls.name AS subject_name,
               COALESCE(NULLIF(TRIM(lb.board_name), ''), 'General curriculum') AS board_label
        FROM section_books sb
        JOIN library_books lb ON lb.id = sb.book_id
        JOIN library_subjects ls ON ls.id = lb.subject_id
        WHERE sb.class_id = $1::uuid
        ORDER BY board_label, ls.name, lb.title
        """,
        class_id,
    )
    if not book_rows:
        return []

    # Group: board_label -> subject_id -> books
    boards_map: Dict[str, Dict] = {}
    for row in book_rows:
        label = row["board_label"] or "General curriculum"
        bid = str(uuid5(NAMESPACE_URL, f"smart-school-exam-board:{class_id}:{label}"))
        if bid not in boards_map:
            boards_map[bid] = {"id": bid, "name": label, "subjects": {}}
        sid = str(row["subject_id"])
        sub = boards_map[bid]["subjects"]
        if sid not in sub:
            sub[sid] = {"id": sid, "name": row["subject_name"], "books": []}
        sub[sid]["books"].append(
            {
                "id": str(row["book_id"]),
                "title": row["book_title"],
                "chapters": await _chapters_with_topics_for_book(str(row["book_id"])),
            }
        )

    for b in boards_map.values():
        tree.append(
            {
                "id": b["id"],
                "name": b["name"],
                "subjects": list(b["subjects"].values()),
            }
        )
    tree.sort(key=lambda x: x["name"])
    return tree


async def _fetch_previous_questions(topic_ids: List[str]) -> List[str]:
    """Return question texts from prior exams on the same topics for variety."""
    if not topic_ids:
        return []
    placeholders = ", ".join(f"${i+1}" for i in range(len(topic_ids)))
    rows = await execute_query(
        f"""SELECT DISTINCT eq.question_text
            FROM exam_questions eq
            JOIN teacher_exams te ON eq.exam_id = te.id
            WHERE te.topics && ARRAY[{placeholders}]::UUID[]
            LIMIT 50""",
        *topic_ids,
    )
    return [r["question_text"] for r in rows]


# ============================================
# ROUTES
# ============================================

@router.get("/class/{class_id}/curriculum")
async def get_class_curriculum(class_id: str):
    """Get subjects and their topics for a class — used by the Create Exam modal."""
    subjects = await execute_query(
        """SELECT s.id, s.name
           FROM subjects s
           JOIN class_subjects cs ON s.id = cs.subject_id
           WHERE cs.class_id = $1
           ORDER BY s.name""",
        class_id,
    )
    result = []
    for s in subjects:
        topics = await execute_query(
            "SELECT id, title FROM topics WHERE subject_id = $1 ORDER BY order_index ASC, title ASC",
            s["id"],
        )
        result.append({
            "id": str(s["id"]),
            "name": s["name"],
            "topics": [{"id": str(t["id"]), "title": t["title"]} for t in topics],
        })
    if result:
        return result

    # Fallback: library curriculum (section_subjects + topics from assigned books)
    from app.routers.library import ensure_library_tables

    await ensure_library_tables()

    lib_subjects = await execute_query(
        """
        SELECT DISTINCT ls.id, ls.name
        FROM section_subjects ss
        JOIN library_subjects ls ON ls.id = ss.subject_id
        WHERE ss.class_id = $1::uuid
        ORDER BY ls.name
        """,
        class_id,
    )
    if not lib_subjects:
        lib_subjects = await execute_query(
            """
            SELECT DISTINCT ls.id, ls.name
            FROM section_books sb
            JOIN library_books lb ON lb.id = sb.book_id
            JOIN library_subjects ls ON ls.id = lb.subject_id
            WHERE sb.class_id = $1::uuid
            ORDER BY ls.name
            """,
            class_id,
        )

    out = []
    for s in lib_subjects:
        topics = await execute_query(
            """
            SELECT DISTINCT lt.id, lt.title
            FROM section_books sb
            JOIN library_books lb ON lb.id = sb.book_id
            JOIN library_chapters lc ON lc.book_id = lb.id
            JOIN library_topics lt ON lt.chapter_id = lc.id
            WHERE sb.class_id = $1::uuid AND lb.subject_id = $2::uuid
            ORDER BY lc.chapter_number ASC, lt.title ASC
            """,
            class_id,
            s["id"],
        )
        out.append({
            "id": str(s["id"]),
            "name": s["name"],
            "topics": [{"id": str(t["id"]), "title": t["title"]} for t in topics],
        })
    return out


@router.get("/class/{class_id}/exam-scope")
async def get_class_exam_scope(class_id: str):
    """
    Curriculum for Create Exam: either flat legacy subjects/topics or full library tree
    (board → subject → book → chapter → topics).
    """
    from app.routers.library import ensure_library_tables

    subjects = await execute_query(
        """SELECT s.id, s.name
           FROM subjects s
           JOIN class_subjects cs ON s.id = cs.subject_id
           WHERE cs.class_id = $1
           ORDER BY s.name""",
        class_id,
    )
    if subjects:
        subj_list = []
        for s in subjects:
            topics = await execute_query(
                "SELECT id, title FROM topics WHERE subject_id = $1 ORDER BY order_index ASC, title ASC",
                s["id"],
            )
            subj_list.append({
                "id": str(s["id"]),
                "name": s["name"],
                "topics": [{"id": str(t["id"]), "title": t["title"]} for t in topics],
            })
        return {"mode": "flat_legacy", "subjects": subj_list}

    await ensure_library_tables()
    boards = await _build_library_exam_tree(class_id)
    return {"mode": "library_tree", "boards": boards}


@router.get("/class/{class_id}/enrollment-preview")
async def enrollment_preview(class_id: str, user: dict = Depends(get_user_from_token)):
    """Teacher/admin: count (and sample) students enrolled in this section — for exam broadcast preview."""
    role = user.get("role")
    uid = str(user["user_id"])
    cl = await execute_one(
        "SELECT teacher_id FROM classes WHERE id = $1::uuid",
        class_id,
    )
    if not cl:
        raise HTTPException(status_code=404, detail="Class not found")
    if role in ("admin", "super_admin"):
        pass
    elif role == "teacher" and str(cl["teacher_id"]) == uid:
        pass
    else:
        raise HTTPException(status_code=403, detail="You cannot preview enrollment for this class")

    cnt = await execute_one(
        """
        SELECT COUNT(*)::int AS n FROM enrollments
        WHERE class_id = $1::uuid AND is_active = true
        """,
        class_id,
    )
    sample = await execute_query(
        """
        SELECT u.id, u.full_name, u.email
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        WHERE e.class_id = $1::uuid AND e.is_active = true
        ORDER BY u.full_name
        LIMIT 25
        """,
        class_id,
    )
    return {
        "count": cnt["n"] if cnt else 0,
        "sample_students": [dict(r) for r in sample],
    }


@router.get("/")
async def list_exams(teacher_id: str):
    """List all exams created by a teacher."""
    exams = await execute_query(
        """SELECT te.id, te.title, te.complexity, te.status, te.exam_format,
                  te.created_at, te.updated_at,
                  COALESCE(s.name, ls.name) AS subject_name,
                  cl.name AS class_name,
                  COUNT(eq.id)::int AS question_count,
                  COALESCE(SUM(eq.marks), 0)::int AS total_marks
           FROM teacher_exams te
           LEFT JOIN subjects s ON te.subject_id = s.id
           LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
           LEFT JOIN classes cl ON te.class_id = cl.id
           LEFT JOIN exam_questions eq ON eq.exam_id = te.id
           WHERE te.teacher_id = $1
           GROUP BY te.id, s.name, ls.name, cl.name
           ORDER BY te.created_at DESC""",
        teacher_id,
    )
    return [dict(e) for e in exams]


@router.post("/")
async def create_exam(req: CreateExamRequest):
    """Create an AI-generated exam, grounded in topic syllabus content."""
    from app.routers.library import ensure_library_tables

    await ensure_library_tables()
    # Validate caller — allow teacher or admin
    teacher = await execute_one("SELECT id FROM users WHERE id = $1 AND role IN ('teacher', 'admin')", req.teacher_id)
    if not teacher:
        raise HTTPException(status_code=403, detail="Invalid teacher")

    topic_ids_final = await _resolve_exam_topic_ids(req)
    if not topic_ids_final:
        raise HTTPException(
            status_code=400,
            detail="No syllabus topics found for this scope. Add topics to the library or choose another book/chapter.",
        )

    topics_rows = await _topic_rows_ordered(topic_ids_final)
    if len(topics_rows) != len(topic_ids_final):
        raise HTTPException(status_code=404, detail="One or more topics not found")

    topics_info = [{"title": t["title"]} for t in topics_rows]

    # Fetch subject + class names (legacy subjects or library_subjects)
    subject_row = await execute_one("SELECT name FROM subjects WHERE id = $1", req.subject_id)
    lib_subject_row = await execute_one("SELECT name FROM library_subjects WHERE id = $1", req.subject_id)
    if subject_row:
        subject_name = subject_row["name"]
        ins_subject_id = req.subject_id
        ins_library_subject_id = None
    elif lib_subject_row:
        subject_name = lib_subject_row["name"]
        ins_subject_id = None
        ins_library_subject_id = req.subject_id
    else:
        raise HTTPException(status_code=404, detail="Subject not found")

    class_row = await execute_one("SELECT name FROM classes WHERE id = $1", req.class_id)
    class_name = class_row["name"] if class_row else "Unknown Class"

    geo = await execute_one(
        """
        SELECT sc.id AS school_id, b.id AS branch_id
        FROM classes c
        JOIN branches b ON c.branch_id = b.id
        JOIN schools sc ON b.school_id = sc.id
        WHERE c.id = $1::uuid
        """,
        req.class_id,
    )
    school_id = geo["school_id"] if geo else None
    branch_id = geo["branch_id"] if geo else None
    exam_board_id = req.board_id if req.board_id else None

    # Build syllabus context (RAG)
    syllabus_context = await _build_syllabus_context(topic_ids_final)
    previous_questions = await _fetch_previous_questions(topic_ids_final)

    # Generate structured questions via Claude
    questions = await generate_exam_structured(
        topics_info=topics_info,
        subject_name=subject_name,
        class_name=class_name,
        exam_format=req.exam_format,
        complexity=req.complexity,
        syllabus_context=syllabus_context,
        previous_questions=previous_questions,
    )

    # Insert exam row
    exam_id = await execute_one(
        """INSERT INTO teacher_exams
               (teacher_id, class_id, subject_id, library_subject_id, school_id, branch_id, board_id,
                title, topics, complexity, exam_format, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::UUID[], $10, $11, 'draft')
           RETURNING id""",
        req.teacher_id,
        req.class_id,
        ins_subject_id,
        ins_library_subject_id,
        school_id,
        branch_id,
        exam_board_id,
        req.title,
        topic_ids_final,
        req.complexity,
        json.dumps(req.exam_format),
    )
    exam_id = exam_id["id"]

    # Bulk insert questions
    for idx, q in enumerate(questions):
        opts = q.get("options")
        await execute_write(
            """INSERT INTO exam_questions
                   (exam_id, question_type, question_text, options, correct_answer, marks, order_index)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            exam_id,
            q.get("question_type", "short_answer"),
            q.get("question_text", ""),
            json.dumps(opts) if opts else None,
            q.get("correct_answer", ""),
            int(q.get("marks", 1)),
            idx,
        )

    return await _fetch_exam_with_questions(exam_id)


@router.get("/{exam_id}")
async def get_exam(exam_id: str):
    """Get exam with all questions."""
    return await _fetch_exam_with_questions(exam_id)


@router.put("/{exam_id}")
async def update_exam(exam_id: str, req: UpdateExamRequest):
    """Update exam title or status."""
    updates = []
    values = []
    i = 1
    if req.title is not None:
        updates.append(f"title = ${i}")
        values.append(req.title)
        i += 1
    if req.status is not None:
        updates.append(f"status = ${i}")
        values.append(req.status)
        i += 1
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    updates.append(f"updated_at = NOW()")
    values.append(exam_id)
    await execute_write(
        f"UPDATE teacher_exams SET {', '.join(updates)} WHERE id = ${i}",
        *values,
    )
    return await _fetch_exam_with_questions(exam_id)


@router.delete("/{exam_id}")
async def delete_exam(exam_id: str, teacher_id: str):
    """Delete exam and all its questions (cascades via FK)."""
    # Admin can delete any exam; teacher can only delete their own
    caller = await execute_one("SELECT role FROM users WHERE id = $1", teacher_id)
    is_admin = caller and caller["role"] == "admin"
    if is_admin:
        existing = await execute_one("SELECT id FROM teacher_exams WHERE id = $1", exam_id)
    else:
        existing = await execute_one(
            "SELECT id FROM teacher_exams WHERE id = $1 AND teacher_id = $2",
            exam_id, teacher_id,
        )
    if not existing:
        raise HTTPException(status_code=404, detail="Exam not found or not owned by you")
    await execute_write("DELETE FROM teacher_exams WHERE id = $1", exam_id)
    return {"success": True}


@router.post("/{exam_id}/regenerate")
async def regenerate_exam(exam_id: str, teacher_id: str):
    """Re-generate all questions for an exam using the same settings."""
    from app.routers.library import ensure_library_tables

    await ensure_library_tables()
    # Admin can regenerate any exam; teacher only their own
    caller = await execute_one("SELECT role FROM users WHERE id = $1", teacher_id)
    is_admin = caller and caller["role"] == "admin"
    if is_admin:
        exam = await execute_one(
            """SELECT te.*, COALESCE(s.name, ls.name) AS subject_name, cl.name AS class_name
               FROM teacher_exams te
               LEFT JOIN subjects s ON te.subject_id = s.id
               LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
               LEFT JOIN classes cl ON te.class_id = cl.id
               WHERE te.id = $1""",
            exam_id,
        )
    else:
        exam = await execute_one(
            """SELECT te.*, COALESCE(s.name, ls.name) AS subject_name, cl.name AS class_name
               FROM teacher_exams te
               LEFT JOIN subjects s ON te.subject_id = s.id
               LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
               LEFT JOIN classes cl ON te.class_id = cl.id
               WHERE te.id = $1 AND te.teacher_id = $2""",
            exam_id, teacher_id,
        )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    topic_ids = exam.get("topics") or []
    exam_format = exam.get("exam_format") or {}
    if isinstance(exam_format, str):
        exam_format = json.loads(exam_format)

    topics_rows = await _topic_rows_ordered(topic_ids or [])
    topics_info = [{"title": t["title"]} for t in topics_rows]

    syllabus_context = await _build_syllabus_context(topic_ids)
    previous_questions = await _fetch_previous_questions(topic_ids)

    questions = await generate_exam_structured(
        topics_info=topics_info,
        subject_name=exam.get("subject_name", ""),
        class_name=exam.get("class_name", ""),
        exam_format=exam_format,
        complexity=exam.get("complexity", "medium"),
        syllabus_context=syllabus_context,
        previous_questions=previous_questions,
    )

    # Replace existing questions
    await execute_write("DELETE FROM exam_questions WHERE exam_id = $1", exam_id)
    for idx, q in enumerate(questions):
        opts = q.get("options")
        await execute_write(
            """INSERT INTO exam_questions
                   (exam_id, question_type, question_text, options, correct_answer, marks, order_index)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            exam_id,
            q.get("question_type", "short_answer"),
            q.get("question_text", ""),
            json.dumps(opts) if opts else None,
            q.get("correct_answer", ""),
            int(q.get("marks", 1)),
            idx,
        )

    await execute_write("UPDATE teacher_exams SET updated_at = NOW() WHERE id = $1", exam_id)
    return await _fetch_exam_with_questions(exam_id)


@router.put("/{exam_id}/questions/{question_id}")
async def update_question(exam_id: str, question_id: str, req: UpdateQuestionRequest):
    """Update a single question in an exam."""
    updates = []
    values = []
    i = 1
    if req.question_text is not None:
        updates.append(f"question_text = ${i}")
        values.append(req.question_text)
        i += 1
    if req.options is not None:
        updates.append(f"options = ${i}")
        values.append(json.dumps(req.options))
        i += 1
    if req.correct_answer is not None:
        updates.append(f"correct_answer = ${i}")
        values.append(req.correct_answer)
        i += 1
    if req.marks is not None:
        updates.append(f"marks = ${i}")
        values.append(req.marks)
        i += 1
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    values.extend([question_id, exam_id])
    await execute_write(
        f"UPDATE exam_questions SET {', '.join(updates)} WHERE id = ${i} AND exam_id = ${i+1}",
        *values,
    )
    q = await execute_one("SELECT * FROM exam_questions WHERE id = $1", question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    qd = dict(q)
    if isinstance(qd.get("options"), str):
        try:
            qd["options"] = json.loads(qd["options"])
        except Exception:
            pass
    return qd


@router.delete("/{exam_id}/questions/{question_id}")
async def delete_question(exam_id: str, question_id: str):
    """Delete a single question from an exam."""
    await execute_write(
        "DELETE FROM exam_questions WHERE id = $1 AND exam_id = $2",
        question_id, exam_id,
    )
    return {"success": True}


@router.post("/{exam_id}/questions")
async def add_question(exam_id: str, req: AddQuestionRequest):
    """Add a manual question to an existing exam."""
    exam = await execute_one("SELECT id FROM teacher_exams WHERE id = $1", exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Get next order_index
    max_idx = await execute_one(
        "SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM exam_questions WHERE exam_id = $1",
        exam_id,
    )
    next_idx = (max_idx["max_idx"] or 0) + 1

    row = await execute_one(
        """INSERT INTO exam_questions
               (exam_id, question_type, question_text, options, correct_answer, marks, order_index, is_manual)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING *""",
        exam_id,
        req.question_type,
        req.question_text,
        json.dumps(req.options) if req.options else None,
        req.correct_answer or "",
        req.marks,
        next_idx,
    )
    qd = dict(row)
    if isinstance(qd.get("options"), str):
        try:
            qd["options"] = json.loads(qd["options"])
        except Exception:
            pass
    return qd


# ============================================
# STUDENT EXAM SUBMISSION
# ============================================

class AnswerIn(BaseModel):
    question_id: str
    answer_text: str


class SubmitExamRequest(BaseModel):
    answers: List[AnswerIn]


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: str,
    body: SubmitExamRequest,
    current_user: dict = Depends(get_user_from_token),
):
    """
    Student submits their answers for an exam.
    Auto-grades MCQ questions; text questions get marks_awarded=0 for manual grading.
    """
    if current_user.get("role") not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Students only")

    student_id = current_user["user_id"]

    exam = await execute_one("SELECT id, class_id FROM teacher_exams WHERE id = $1", exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Load all questions for this exam
    questions = await execute_query(
        "SELECT id, question_type, correct_answer, marks FROM exam_questions WHERE exam_id = $1",
        exam_id,
    )
    q_map = {str(q["id"]): dict(q) for q in questions}

    total_marks = sum(float(q["marks"] or 0) for q in questions)
    earned = 0.0
    per_question = []

    for ans in body.answers:
        qid = ans.question_id
        q = q_map.get(qid)
        if not q:
            continue
        is_mcq = q["question_type"] == "mcq"
        correct = q.get("correct_answer") or ""
        is_correct = is_mcq and ans.answer_text.strip().lower() == correct.strip().lower()
        marks_awarded = float(q["marks"] or 0) if is_correct else 0.0
        earned += marks_awarded

        await execute_write(
            """INSERT INTO student_exam_answers (exam_id, student_id, question_id, answer_text, is_correct, marks_awarded)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (student_id, question_id) DO UPDATE
                 SET answer_text = EXCLUDED.answer_text,
                     is_correct = EXCLUDED.is_correct,
                     marks_awarded = EXCLUDED.marks_awarded""",
            exam_id, student_id, qid, ans.answer_text, is_correct if is_mcq else None, marks_awarded,
        )
        per_question.append({
            "question_id": qid,
            "answer_text": ans.answer_text,
            "is_correct": is_correct if is_mcq else None,
            "marks_awarded": marks_awarded,
        })

    percentage = round(earned / total_marks * 100, 1) if total_marks > 0 else 0

    # Upsert assignment row
    await execute_write(
        """INSERT INTO student_exam_assignments (student_id, exam_id, status, submitted_at, score)
           VALUES ($1, $2, 'submitted', NOW(), $3)
           ON CONFLICT (student_id, exam_id) DO UPDATE
             SET status = 'submitted', submitted_at = NOW(), score = EXCLUDED.score""",
        student_id, exam_id, earned,
    )

    return {
        "score": earned,
        "total_marks": total_marks,
        "percentage": percentage,
        "passed": percentage >= 50,
        "per_question": per_question,
    }


@router.get("/{exam_id}/my-result")
async def get_my_exam_result(
    exam_id: str,
    current_user: dict = Depends(get_user_from_token),
):
    """Returns a student's submitted answers and marks for an exam."""
    if current_user.get("role") not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Students only")

    student_id = current_user["user_id"]

    assignment = await execute_one(
        "SELECT status, submitted_at, score FROM student_exam_assignments WHERE student_id = $1 AND exam_id = $2",
        student_id, exam_id,
    )
    if not assignment or assignment["status"] != "submitted":
        raise HTTPException(status_code=404, detail="No submission found for this exam")

    answers = await execute_query(
        """SELECT sea.question_id, sea.answer_text, sea.is_correct, sea.marks_awarded,
                  eq.question_text, eq.question_type, eq.correct_answer, eq.marks
           FROM student_exam_answers sea
           JOIN exam_questions eq ON eq.id = sea.question_id
           WHERE sea.student_id = $1 AND sea.exam_id = $2
           ORDER BY eq.order_index""",
        student_id, exam_id,
    )

    total_marks = sum(float(a["marks"] or 0) for a in answers)
    score = float(assignment["score"] or 0)
    percentage = round(score / total_marks * 100, 1) if total_marks > 0 else 0

    return {
        "status": assignment["status"],
        "submitted_at": assignment["submitted_at"],
        "score": score,
        "total_marks": total_marks,
        "percentage": percentage,
        "passed": percentage >= 50,
        "answers": [dict(a) for a in answers],
    }


@router.post("/submissions/integrity")
async def submit_exam_integrity_report(
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Store integrity tracking data for exam submission."""
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    exam_id = body.get("exam_id")
    reports = body.get("reports", [])

    if not exam_id or not reports:
        return {"status": "ok"}

    # Create integrity tracking table for exams if not exists
    await execute_write(
        """
        CREATE TABLE IF NOT EXISTS exam_integrity_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            exam_id UUID NOT NULL REFERENCES exams(id),
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
            INSERT INTO exam_integrity_reports
            (exam_id, student_id, question_id, paste_events, typing_analysis,
             focus_losses, draft_history, flags, risk_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            exam_id,
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


@router.get("/{exam_id}/integrity-reports")
async def get_exam_integrity_reports(
    exam_id: str,
    user: dict = Depends(get_user_from_token),
):
    """Get integrity reports for all submissions of an exam (teacher/admin only)."""
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Verify teacher owns this exam
    exam = await execute_one(
        "SELECT id, teacher_id FROM exams WHERE id = $1::uuid",
        exam_id,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if user.get("role") != "admin" and str(exam["teacher_id"]) != user["user_id"]:
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
            sea.is_correct
        FROM exam_integrity_reports ir
        JOIN users u ON u.id = ir.student_id
        LEFT JOIN student_exam_answers sea ON sea.exam_id = ir.exam_id AND sea.student_id = ir.student_id
        WHERE ir.exam_id = $1::uuid
        ORDER BY ir.created_at DESC, ir.student_id
        """,
        exam_id,
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


@router.post("/{exam_id}/submit-files")
async def submit_exam_files(
    exam_id: str,
    user: dict = Depends(get_user_from_token),
    files: List[UploadFile] = File(...),
):
    """Student submits exam via file upload."""
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    student_id = user["user_id"]

    exam = await execute_one(
        "SELECT id, class_id FROM exams WHERE id = $1::uuid",
        exam_id,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Check if student can access this exam (enrolled in class)
    enrollment = await execute_one(
        "SELECT id FROM enrollments WHERE student_id = $1::uuid AND class_id = $2::uuid AND is_active = true",
        student_id,
        exam["class_id"],
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    # Create or update submission record
    assignment = await execute_one(
        "SELECT id FROM student_exam_assignments WHERE student_id = $1::uuid AND exam_id = $2::uuid",
        student_id,
        exam_id,
    )

    submission_id = str(assignment["id"]) if assignment else str(uuid.uuid4())

    # Create folder for uploads
    folder = os.path.join("static", "exam_uploads", submission_id)
    os.makedirs(folder, exist_ok=True)

    stored = []
    for f in files:
        fname = f"{uuid.uuid4().hex}_{f.filename}"
        path = os.path.join(folder, fname)
        content = await f.read()
        with open(path, "wb") as out:
            out.write(content)
        rel = f"/static/exam_uploads/{submission_id}/{fname}"
        stored.append(
            {
                "path": rel,
                "original_name": f.filename or fname,
                "mime": f.content_type or "application/octet-stream",
            }
        )

    # Store files as JSON
    if assignment:
        await execute_write(
            """
            UPDATE student_exam_assignments
            SET upload_files_json = $2::jsonb, submitted_at = NOW(), status = 'submitted'
            WHERE id = $1::uuid
            """,
            assignment["id"],
            json.dumps(stored),
        )
    else:
        await execute_write(
            """
            INSERT INTO student_exam_assignments (id, student_id, exam_id, status, submitted_at, upload_files_json)
            VALUES ($1::uuid, $2::uuid, $3::uuid, 'submitted', NOW(), $4::jsonb)
            """,
            submission_id,
            student_id,
            exam_id,
            json.dumps(stored),
        )

    return {"ok": True, "submission_id": submission_id, "files": stored}
