"""
Exam Module Router
Handles AI-generated and manual exam papers for teachers.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import logging

from app.utils.database import execute_query, execute_one, execute_write
from app.utils.claude_ai import generate_exam_structured

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================
# REQUEST / RESPONSE MODELS
# ============================================

class CreateExamRequest(BaseModel):
    teacher_id: str
    class_id: str
    subject_id: str
    topic_ids: List[str]
    title: str
    complexity: str = "medium"
    exam_format: Dict[str, int]  # {"mcq": 10, "short_answer": 5, "long_answer": 3, "fill_in_blank": 4}


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
        """SELECT te.*, s.name AS subject_name, cl.name AS class_name
           FROM teacher_exams te
           LEFT JOIN subjects s ON te.subject_id = s.id
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


async def _build_syllabus_context(topic_ids: List[str]) -> str:
    """Fetch topic content + slide bullets to use as RAG context for Claude."""
    if not topic_ids:
        return ""
    placeholders = ", ".join(f"${i+1}" for i in range(len(topic_ids)))
    topics = await execute_query(
        f"SELECT title, content, slides_json FROM topics WHERE id IN ({placeholders})",
        *topic_ids,
    )
    parts = []
    for t in topics:
        title = t.get("title", "")
        content = t.get("content") or ""
        slides_raw = t.get("slides_json") or ""
        slide_text = ""
        if slides_raw:
            try:
                slides = json.loads(slides_raw)
                if isinstance(slides, list):
                    for slide in slides:
                        if isinstance(slide, dict):
                            for bullet in slide.get("content", []):
                                slide_text += f"- {bullet}\n"
            except Exception:
                pass
        parts.append(f"## {title}\n{content}\n{slide_text}")
    return "\n\n".join(parts)


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
            "id": s["id"],
            "name": s["name"],
            "topics": [{"id": t["id"], "title": t["title"]} for t in topics],
        })
    return result


@router.get("/")
async def list_exams(teacher_id: str):
    """List all exams created by a teacher."""
    exams = await execute_query(
        """SELECT te.id, te.title, te.complexity, te.status, te.exam_format,
                  te.created_at, te.updated_at,
                  s.name AS subject_name,
                  cl.name AS class_name,
                  COUNT(eq.id)::int AS question_count,
                  COALESCE(SUM(eq.marks), 0)::int AS total_marks
           FROM teacher_exams te
           LEFT JOIN subjects s ON te.subject_id = s.id
           LEFT JOIN classes cl ON te.class_id = cl.id
           LEFT JOIN exam_questions eq ON eq.exam_id = te.id
           WHERE te.teacher_id = $1
           GROUP BY te.id, s.name, cl.name
           ORDER BY te.created_at DESC""",
        teacher_id,
    )
    return [dict(e) for e in exams]


@router.post("/")
async def create_exam(req: CreateExamRequest):
    """Create an AI-generated exam, grounded in topic syllabus content."""
    # Validate caller — allow teacher or admin
    teacher = await execute_one("SELECT id FROM users WHERE id = $1 AND role IN ('teacher', 'admin')", req.teacher_id)
    if not teacher:
        raise HTTPException(status_code=403, detail="Invalid teacher")

    # Fetch topic metadata
    if not req.topic_ids:
        raise HTTPException(status_code=400, detail="At least one topic required")

    placeholders = ", ".join(f"${i+1}" for i in range(len(req.topic_ids)))
    topics_rows = await execute_query(
        f"SELECT id, title FROM topics WHERE id IN ({placeholders})",
        *req.topic_ids,
    )
    if not topics_rows:
        raise HTTPException(status_code=404, detail="No topics found")

    topics_info = [{"title": t["title"]} for t in topics_rows]

    # Fetch subject + class names
    subject_row = await execute_one("SELECT name FROM subjects WHERE id = $1", req.subject_id)
    class_row = await execute_one("SELECT name FROM classes WHERE id = $1", req.class_id)
    subject_name = subject_row["name"] if subject_row else "Unknown Subject"
    class_name = class_row["name"] if class_row else "Unknown Class"

    # Build syllabus context (RAG)
    syllabus_context = await _build_syllabus_context(req.topic_ids)
    previous_questions = await _fetch_previous_questions(req.topic_ids)

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
               (teacher_id, class_id, subject_id, title, topics, complexity, exam_format, status)
           VALUES ($1, $2, $3, $4, $5::UUID[], $6, $7, 'draft')
           RETURNING id""",
        req.teacher_id,
        req.class_id,
        req.subject_id,
        req.title,
        req.topic_ids,
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
    # Admin can regenerate any exam; teacher only their own
    caller = await execute_one("SELECT role FROM users WHERE id = $1", teacher_id)
    is_admin = caller and caller["role"] == "admin"
    if is_admin:
        exam = await execute_one(
            """SELECT te.*, s.name AS subject_name, cl.name AS class_name
               FROM teacher_exams te
               LEFT JOIN subjects s ON te.subject_id = s.id
               LEFT JOIN classes cl ON te.class_id = cl.id
               WHERE te.id = $1""",
            exam_id,
        )
    else:
        exam = await execute_one(
            """SELECT te.*, s.name AS subject_name, cl.name AS class_name
               FROM teacher_exams te
               LEFT JOIN subjects s ON te.subject_id = s.id
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

    # Fetch topic info
    topics_info = []
    if topic_ids:
        placeholders = ", ".join(f"${i+1}" for i in range(len(topic_ids)))
        topics_rows = await execute_query(
            f"SELECT title FROM topics WHERE id IN ({placeholders})", *topic_ids
        )
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
