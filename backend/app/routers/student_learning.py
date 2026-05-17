"""
Student learning — read-only curriculum tree, topic payloads, progress, exams.
JWT role=student; content scoped by enrollments → section books / matching exam class_id.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

from app.routers.auth import get_user_from_token
from app.utils.database import execute_query, execute_one, execute_write
from app.utils.student_access import student_can_access_library_topic, student_can_access_exam
from app.routers.library import ensure_library_tables
from app.routers.exams import _build_library_exam_tree, _fetch_exam_with_questions

router = APIRouter()


async def require_student(current_user: dict = Depends(get_user_from_token)) -> dict:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")
    return current_user


async def _enrollment_sections(student_id: str) -> List[dict]:
    return await execute_query(
        """
        SELECT c.id, c.name, c.grade_level, c.section
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        WHERE e.student_id = $1::uuid AND e.is_active = true
        ORDER BY c.name
        """,
        student_id,
    )


class ProgressUpdate(BaseModel):
    topic_id: str
    lecture_watch_percent: Optional[float] = None
    lecture_position_seconds: Optional[float] = None
    watch_time_seconds: Optional[int] = None
    slides_completed: Optional[bool] = None
    slides_viewed_count: Optional[int] = None
    slides_total: Optional[int] = None


def _strip_correct_answers(exam: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(exam)
    qs = []
    for q in out.get("questions") or []:
        qd = dict(q)
        qd.pop("correct_answer", None)
        qs.append(qd)
    out["questions"] = qs
    return out


@router.get("/learning/tree")
async def get_learning_tree(current_user: dict = Depends(require_student)):
    """Board → subject → book → chapter → topics for each enrolled section."""
    await ensure_library_tables()
    student_id = current_user["user_id"]
    rows = await _enrollment_sections(student_id)
    enrollments_out = []
    for r in rows:
        cid = str(r["id"])
        boards = await _build_library_exam_tree(cid)
        enrollments_out.append(
            {
                "class_id": cid,
                "class_name": r["name"],
                "grade_level": r.get("grade_level"),
                "section": r.get("section"),
                "boards": boards,
            }
        )
    return {"enrollments": enrollments_out}


@router.get("/learning/topics/{topic_id}")
async def get_learning_topic(topic_id: str, current_user: dict = Depends(require_student)):
    """Library topic + saved progress (resume position)."""
    await ensure_library_tables()
    student_id = current_user["user_id"]
    if not await student_can_access_library_topic(student_id, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")

    row = await execute_one("SELECT * FROM library_topics WHERE id = $1::uuid", topic_id)
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Find this student's assigned teacher for the topic's subject and overlay their content
    teacher_content = await execute_one(
        """
        SELECT ttc.slides_json, ttc.slide_theme,
               ttc.lecture_video_url, ttc.lecture_metadata_json,
               ttc.lecture_saved_at, ttc.lecture_duration_seconds
        FROM library_topics lt
        JOIN library_chapters lc ON lc.id = lt.chapter_id
        JOIN teacher_class_subject_assignments tcsa
             ON tcsa.library_book_id = lc.book_id
        JOIN enrollments e
             ON e.class_id = tcsa.class_id
            AND e.student_id = $1::uuid
            AND e.is_active = true
        LEFT JOIN teacher_topic_content ttc
             ON ttc.teacher_id = tcsa.teacher_id
            AND ttc.library_topic_id = lt.id
        WHERE lt.id = $2::uuid
        LIMIT 1
        """,
        student_id,
        topic_id,
    )

    topic_data = dict(row)
    if teacher_content:
        for col in ("slides_json", "slide_theme", "lecture_video_url",
                    "lecture_metadata_json", "lecture_saved_at", "lecture_duration_seconds"):
            if teacher_content.get(col) is not None:
                topic_data[col] = teacher_content[col]

    prog = await execute_one(
        """
        SELECT * FROM student_topic_progress
        WHERE student_id = $1::uuid AND topic_id = $2::uuid
        """,
        student_id,
        topic_id,
    )
    return {"data": topic_data, "progress": dict(prog) if prog else None}


@router.get("/learning/topics/{topic_id}/navigation")
async def get_topic_navigation(topic_id: str, current_user: dict = Depends(require_student)):
    """Previous / next topic within the same chapter (for learner navigation)."""
    await ensure_library_tables()
    student_id = current_user["user_id"]
    if not await student_can_access_library_topic(student_id, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")

    ch = await execute_one(
        "SELECT chapter_id FROM library_topics WHERE id = $1::uuid",
        topic_id,
    )
    if not ch or not ch.get("chapter_id"):
        return {"previous_topic_id": None, "next_topic_id": None}

    topics = await execute_query(
        """
        SELECT id, title FROM library_topics
        WHERE chapter_id = $1::uuid
        ORDER BY created_at ASC
        """,
        ch["chapter_id"],
    )
    ids = [str(t["id"]) for t in topics]
    try:
        idx = ids.index(str(topic_id))
    except ValueError:
        return {"previous_topic_id": None, "next_topic_id": None}

    prev_id = ids[idx - 1] if idx > 0 else None
    next_id = ids[idx + 1] if idx < len(ids) - 1 else None

    async def allowed(tid: Optional[str]) -> Optional[str]:
        if not tid:
            return None
        if await student_can_access_library_topic(student_id, tid):
            return tid
        return None

    return {
        "previous_topic_id": await allowed(prev_id),
        "next_topic_id": await allowed(next_id),
    }


@router.post("/learning/progress")
async def upsert_learning_progress(req: ProgressUpdate, current_user: dict = Depends(require_student)):
    """Upsert per-topic progress; completion rules applied server-side."""
    await ensure_library_tables()
    student_id = current_user["user_id"]
    if not await student_can_access_library_topic(student_id, req.topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")

    topic_row = await execute_one(
        """
        SELECT COALESCE(ttc.lecture_video_url, lt.lecture_video_url) AS lecture_video_url
        FROM library_topics lt
        JOIN library_chapters lc ON lc.id = lt.chapter_id
        JOIN teacher_class_subject_assignments tcsa ON tcsa.library_book_id = lc.book_id
        JOIN enrollments e ON e.class_id = tcsa.class_id
            AND e.student_id = $1::uuid AND e.is_active = true
        LEFT JOIN teacher_topic_content ttc
            ON ttc.teacher_id = tcsa.teacher_id AND ttc.library_topic_id = lt.id
        WHERE lt.id = $2::uuid
        LIMIT 1
        """,
        student_id,
        req.topic_id,
    )
    if not topic_row:
        topic_row = await execute_one(
            "SELECT lecture_video_url FROM library_topics WHERE id = $1::uuid", req.topic_id
        )
    has_lecture = bool(
        topic_row and (topic_row.get("lecture_video_url") or "").strip()
    )

    incoming_lecture = float(req.lecture_watch_percent) if req.lecture_watch_percent is not None else None
    existing = await execute_one(
        """
        SELECT * FROM student_topic_progress
        WHERE student_id = $1::uuid AND topic_id = $2::uuid
        """,
        student_id,
        req.topic_id,
    )

    prev_lecture = float(existing["lecture_watch_percent"] or 0) if existing else 0.0
    lecture_pct = max(prev_lecture, incoming_lecture if incoming_lecture is not None else prev_lecture)

    prev_slides_done = bool(existing["slides_completed"]) if existing else False
    slides_done = prev_slides_done or (bool(req.slides_completed) if req.slides_completed is not None else False)

    wt_prev = int(existing["watch_time_seconds"] or 0) if existing else 0
    wt_new = max(wt_prev, int(req.watch_time_seconds or 0))

    pos_prev = float(existing["lecture_position_seconds"] or 0) if existing else 0.0
    pos_new = max(pos_prev, float(req.lecture_position_seconds or 0))

    sv_prev = int(existing["slides_viewed_count"] or 0) if existing else 0
    sv_new = req.slides_viewed_count if req.slides_viewed_count is not None else sv_prev

    st_prev = int(existing["slides_total"] or 0) if existing else 0
    st_new = req.slides_total if req.slides_total is not None else st_prev

    lecture_completed = lecture_pct >= 90.0
    if has_lecture:
        topic_completed = slides_done and lecture_pct >= 80.0
    else:
        topic_completed = slides_done

    await execute_write(
        """
        INSERT INTO student_topic_progress (
            student_id, topic_id,
            slides_viewed_count, slides_total, slides_completed,
            lecture_watch_percent, watch_time_seconds, lecture_position_seconds,
            lecture_completed, topic_completed, last_opened_at, updated_at
        )
        VALUES (
            $1::uuid, $2::uuid,
            $3, $4, $5,
            $6, $7, $8,
            $9, $10, NOW(), NOW()
        )
        ON CONFLICT (student_id, topic_id) DO UPDATE SET
            slides_viewed_count = EXCLUDED.slides_viewed_count,
            slides_total = EXCLUDED.slides_total,
            slides_completed = EXCLUDED.slides_completed,
            lecture_watch_percent = EXCLUDED.lecture_watch_percent,
            watch_time_seconds = EXCLUDED.watch_time_seconds,
            lecture_position_seconds = EXCLUDED.lecture_position_seconds,
            lecture_completed = EXCLUDED.lecture_completed,
            topic_completed = EXCLUDED.topic_completed,
            last_opened_at = NOW(),
            updated_at = NOW()
        """,
        student_id,
        req.topic_id,
        sv_new,
        st_new,
        slides_done,
        lecture_pct,
        wt_new,
        pos_new,
        lecture_completed,
        topic_completed,
    )
    row = await execute_one(
        "SELECT * FROM student_topic_progress WHERE student_id = $1::uuid AND topic_id = $2::uuid",
        student_id,
        req.topic_id,
    )
    return dict(row) if row else {"ok": True}


@router.get("/learning/progress")
async def list_my_progress(current_user: dict = Depends(require_student)):
    student_id = current_user["user_id"]
    rows = await execute_query(
        """
        SELECT * FROM student_topic_progress
        WHERE student_id = $1::uuid
        ORDER BY last_opened_at DESC NULLS LAST, updated_at DESC
        LIMIT 200
        """,
        student_id,
    )
    return {"items": [dict(r) for r in rows]}


def _exam_row_to_public(row: dict) -> dict:
    d = dict(row)
    for k in ("topics", "exam_format"):
        if isinstance(d.get(k), str):
            try:
                import json as _json

                d[k] = _json.loads(d[k])
            except Exception:
                pass
    return d


@router.get("/learning/exams")
async def list_visible_exams(current_user: dict = Depends(require_student)):
    """Finalized exams visible via enrollment.class_id = exam.class_id."""
    student_id = current_user["user_id"]
    exams = await execute_query(
        """
        SELECT te.id, te.title, te.complexity, te.status, te.created_at, te.updated_at,
               te.class_id, te.exam_format, te.due_at,
               COALESCE(s.name, ls.name) AS subject_name,
               c.name AS class_name
        FROM teacher_exams te
        JOIN enrollments e ON e.class_id = te.class_id
          AND e.student_id = $1::uuid AND e.is_active = true
        LEFT JOIN subjects s ON te.subject_id = s.id
        LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
        LEFT JOIN classes c ON te.class_id = c.id
        WHERE te.status = 'finalized'
        ORDER BY te.created_at DESC
        """,
        student_id,
    )
    return {"exams": [_exam_row_to_public(dict(x)) for x in exams]}


@router.get("/learning/exams/grouped")
async def list_exams_grouped(current_user: dict = Depends(require_student)):
    """
    Buckets: upcoming (not started), active (started), completed (submitted),
    missed (past due_at, not completed) — requires optional teacher_exams.due_at.
    """
    student_id = current_user["user_id"]
    rows = await execute_query(
        """
        SELECT te.id, te.title, te.complexity, te.status, te.created_at, te.updated_at,
               te.class_id, te.exam_format, te.due_at,
               COALESCE(s.name, ls.name) AS subject_name,
               c.name AS class_name,
               sea.status AS assignment_status,
               sea.started_at,
               sea.submitted_at,
               sea.score
        FROM teacher_exams te
        JOIN enrollments e ON e.class_id = te.class_id
          AND e.student_id = $1::uuid AND e.is_active = true
        LEFT JOIN subjects s ON te.subject_id = s.id
        LEFT JOIN library_subjects ls ON te.library_subject_id = ls.id
        LEFT JOIN classes c ON te.class_id = c.id
        LEFT JOIN student_exam_assignments sea
          ON sea.exam_id = te.id AND sea.student_id = $1::uuid
        WHERE te.status = 'finalized'
        ORDER BY te.created_at DESC
        """,
        student_id,
    )

    now = datetime.now(timezone.utc)
    upcoming: List[dict] = []
    active: List[dict] = []
    completed: List[dict] = []
    missed: List[dict] = []

    for x in rows:
        ex = _exam_row_to_public(dict(x))
        ast = ex.get("assignment_status")
        submitted = ast == "submitted" or ex.get("submitted_at") is not None
        started = ast in ("started", "in_progress") or ex.get("started_at") is not None

        if submitted or ex.get("score") is not None:
            completed.append(ex)
            continue
        if started:
            active.append(ex)
            continue

        due = ex.get("due_at")
        if due:
            if hasattr(due, "tzinfo") and due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if due < now:
                missed.append(ex)
                continue

        upcoming.append(ex)

    return {
        "upcoming": upcoming,
        "active": active,
        "completed": completed,
        "missed": missed,
    }


@router.get("/learning/exams/{exam_id}")
async def get_student_exam_view(exam_id: str, current_user: dict = Depends(require_student)):
    """Exam + questions without correct answers."""
    student_id = current_user["user_id"]
    if not await student_can_access_exam(student_id, exam_id):
        raise HTTPException(status_code=404, detail="Exam not found")

    full = await _fetch_exam_with_questions(exam_id)
    exam = await execute_one(
        "SELECT status FROM teacher_exams WHERE id = $1::uuid",
        exam_id,
    )
    if not exam or exam.get("status") != "finalized":
        raise HTTPException(status_code=404, detail="Exam not available")

    return _strip_correct_answers(full)


@router.post("/learning/exams/{exam_id}/start")
async def start_student_exam(exam_id: str, current_user: dict = Depends(require_student)):
    """Mark assignment as started (broadcast is implicit via enrollment)."""
    student_id = current_user["user_id"]
    if not await student_can_access_exam(student_id, exam_id):
        raise HTTPException(status_code=404, detail="Exam not found")

    exam = await execute_one("SELECT status FROM teacher_exams WHERE id = $1::uuid", exam_id)
    if not exam or exam.get("status") != "finalized":
        raise HTTPException(status_code=400, detail="Exam is not finalized")

    await execute_write(
        """
        INSERT INTO student_exam_assignments (student_id, exam_id, status, started_at, assigned_at, updated_at)
        VALUES ($1::uuid, $2::uuid, 'started', NOW(), NOW(), NOW())
        ON CONFLICT (student_id, exam_id) DO UPDATE SET
            status = CASE
                WHEN student_exam_assignments.status = 'submitted' THEN student_exam_assignments.status
                ELSE 'started'
            END,
            started_at = COALESCE(student_exam_assignments.started_at, NOW()),
            updated_at = NOW()
        """,
        student_id,
        exam_id,
    )
    return {"success": True}


@router.post("/learning/exams/{exam_id}/submit")
async def submit_student_exam(exam_id: str, current_user: dict = Depends(require_student)):
    """Placeholder submit — stores submission timestamp for dashboard buckets (grading later)."""
    student_id = current_user["user_id"]
    if not await student_can_access_exam(student_id, exam_id):
        raise HTTPException(status_code=404, detail="Exam not found")

    await execute_write(
        """
        INSERT INTO student_exam_assignments (student_id, exam_id, status, submitted_at, assigned_at, updated_at)
        VALUES ($1::uuid, $2::uuid, 'submitted', NOW(), NOW(), NOW())
        ON CONFLICT (student_id, exam_id) DO UPDATE SET
            status = 'submitted',
            submitted_at = NOW(),
            updated_at = NOW()
        """,
        student_id,
        exam_id,
    )
    return {"success": True}


@router.get("/learning/summary")
async def learning_dashboard_summary(current_user: dict = Depends(require_student)):
    """Dashboard: recent topics, completion stats, exam counts."""
    student_id = current_user["user_id"]

    recent = await execute_query(
        """
        SELECT p.topic_id, p.last_opened_at, p.lecture_watch_percent,
               p.topic_completed, p.slides_completed, p.lecture_completed
        FROM student_topic_progress p
        WHERE p.student_id = $1::uuid
        ORDER BY p.last_opened_at DESC NULLS LAST
        LIMIT 8
        """,
        student_id,
    )

    titles = {}
    for r in recent:
        tid = str(r["topic_id"])
        trow = await execute_one("SELECT title FROM library_topics WHERE id = $1::uuid", tid)
        titles[tid] = trow["title"] if trow else "Topic"

    recent_enriched = []
    for r in recent:
        tid = str(r["topic_id"])
        recent_enriched.append(
            {
                "topic_id": tid,
                "title": titles.get(tid, "Topic"),
                "last_opened_at": r.get("last_opened_at"),
                "lecture_watch_percent": r.get("lecture_watch_percent"),
                "topic_completed": r.get("topic_completed"),
            }
        )

    agg = await execute_one(
        """
        SELECT
            COUNT(*)::int AS tracked,
            COUNT(*) FILTER (WHERE topic_completed = true)::int AS completed
        FROM student_topic_progress
        WHERE student_id = $1::uuid
        """,
        student_id,
    )
    tracked = int(agg["tracked"] or 0) if agg else 0
    completed_topics = int(agg["completed"] or 0) if agg else 0
    progress_percent = round(100.0 * completed_topics / tracked, 1) if tracked else 0.0

    completed_list = await execute_query(
        """
        SELECT p.topic_id, p.updated_at
        FROM student_topic_progress p
        WHERE p.student_id = $1::uuid AND p.topic_completed = true
        ORDER BY p.updated_at DESC
        LIMIT 12
        """,
        student_id,
    )
    done_topics = []
    for r in completed_list:
        tid = str(r["topic_id"])
        trow = await execute_one("SELECT title FROM library_topics WHERE id = $1::uuid", tid)
        done_topics.append(
            {
                "topic_id": tid,
                "title": trow["title"] if trow else "Topic",
                "completed_at": r.get("updated_at"),
            }
        )

    exam_count = await execute_one(
        """
        SELECT COUNT(DISTINCT te.id)::int AS cnt
        FROM teacher_exams te
        JOIN enrollments e ON e.class_id = te.class_id
          AND e.student_id = $1::uuid AND e.is_active = true
        WHERE te.status = 'finalized'
        """,
        student_id,
    )

    grouped = await list_exams_grouped(current_user)

    return {
        "recent_topics": recent_enriched,
        "completed_topics_list": done_topics,
        "topics_tracked": tracked,
        "topics_completed": completed_topics,
        "progress_percent": progress_percent,
        "finalized_exam_count": exam_count["cnt"] if exam_count else 0,
        "exams_upcoming": len(grouped["upcoming"]),
        "exams_active": len(grouped["active"]),
        "exams_completed": len(grouped["completed"]),
        "exams_missed": len(grouped["missed"]),
    }
