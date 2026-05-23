from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime, timedelta
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel
from app.routers.auth import get_user_from_token
from app.utils.database import execute_query, execute_one, execute_scalar, execute_write

router = APIRouter(tags=["lessons"])


# ==================== REQUEST/RESPONSE MODELS ====================

class TopicSelection(BaseModel):
    library_topic_id: str
    chapter_number: Optional[int] = None
    topic_title: Optional[str] = None


class CreateLessonPlanRequest(BaseModel):
    planned_date: date
    planned_time: str = "09:00"
    class_ids: List[str]
    library_book_id: str
    library_subject_id: str
    library_board_id: Optional[str] = None
    topics: List[TopicSelection]
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: int = 45


class UpdateLessonPlanRequest(BaseModel):
    planned_date: Optional[date] = None
    class_ids: Optional[List[str]] = None
    topics: Optional[List[TopicSelection]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None


class LessonPlanResponse(BaseModel):
    id: str
    planned_date: str
    planned_time: str
    class_ids: List[str]
    class_names: List[str]
    library_subject_id: str
    subject_name: str
    library_book_id: str
    book_title: str
    topics: List[dict]
    title: Optional[str]
    description: Optional[str]
    status: str
    duration_minutes: int
    created_at: str
    updated_at: str


# ==================== HELPER FUNCTIONS ====================

async def validate_teacher_assignment(teacher_id: str, class_id: str, library_subject_id: str, library_book_id: str):
    """Validate teacher has assignment for this class, subject, and book."""
    assignment = await execute_one(
        """
        SELECT id FROM teacher_class_subject_assignments
        WHERE teacher_id = $1::uuid
          AND class_id = $2::uuid
          AND library_subject_id = $3::uuid
          AND library_book_id = $4::uuid
        """,
        teacher_id, class_id, library_subject_id, library_book_id
    )
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to teach this class/subject/book combination"
        )


async def get_lesson_plan_details(lesson_id: str):
    """Fetch lesson plan with all related data."""
    lesson = await execute_one(
        """
        SELECT id, teacher_id, planned_date, planned_time, class_id, library_subject_id, library_book_id,
               title, description, status, duration_minutes, created_at, updated_at
        FROM lesson_plans
        WHERE id = $1::uuid
        """,
        lesson_id
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson plan not found")

    # Fetch class names
    class_ids = await execute_query(
        """
        SELECT DISTINCT c.id, c.name
        FROM lesson_plan_classes lpc
        JOIN classes c ON lpc.class_id = c.id
        WHERE lpc.lesson_plan_id = $1::uuid
        """,
        lesson_id
    )

    # Fetch subject name
    subject = await execute_one(
        "SELECT id, name FROM library_subjects WHERE id = $1::uuid",
        str(lesson["library_subject_id"])
    )

    # Fetch book title
    book = await execute_one(
        "SELECT id, title FROM library_books WHERE id = $1::uuid",
        str(lesson["library_book_id"])
    )

    # Fetch topics
    topics = await execute_query(
        """
        SELECT lpt.id, lpt.library_topic_id, lpt.chapter_number, lpt.topic_title, lpt.sort_order
        FROM lesson_plan_topics lpt
        WHERE lpt.lesson_plan_id = $1::uuid
        ORDER BY lpt.sort_order ASC
        """,
        lesson_id
    )

    return {
        "id": str(lesson["id"]),
        "planned_date": lesson["planned_date"].isoformat(),
        "planned_time": str(lesson["planned_time"]) if lesson["planned_time"] else "09:00",
        "class_ids": [str(c["id"]) for c in class_ids],
        "class_names": [c["name"] for c in class_ids],
        "library_subject_id": str(lesson["library_subject_id"]),
        "subject_name": subject["name"] if subject else "Unknown",
        "library_book_id": str(lesson["library_book_id"]),
        "book_title": book["title"] if book else "Unknown",
        "topics": [
            {
                "id": str(t["library_topic_id"]),
                "title": t["topic_title"] or "Unknown",
                "chapter_number": t["chapter_number"]
            }
            for t in topics
        ],
        "title": lesson["title"],
        "description": lesson["description"],
        "status": lesson["status"],
        "duration_minutes": lesson["duration_minutes"],
        "created_at": lesson["created_at"].isoformat() if lesson["created_at"] else None,
        "updated_at": lesson["updated_at"].isoformat() if lesson["updated_at"] else None
    }


# ==================== ENDPOINTS ====================

@router.post("")
async def create_lesson_plan(
    request: CreateLessonPlanRequest,
    current_user = Depends(get_user_from_token),
):
    """Create a new lesson plan for the authenticated teacher."""
    teacher_id = current_user["user_id"]

    # Validate teacher has assignment for all selected classes with this subject and book
    for class_id in request.class_ids:
        await validate_teacher_assignment(str(teacher_id), class_id, request.library_subject_id, request.library_book_id)

    # Check for duplicate lesson plan (same teacher, date, class, subject)
    for class_id in request.class_ids:
        existing = await execute_one(
            """
            SELECT id FROM lesson_plans
            WHERE teacher_id = $1::uuid
              AND planned_date = $2
              AND planned_time = $3
              AND class_id = $4::uuid
              AND library_subject_id = $5::uuid
            """,
            teacher_id, request.planned_date, request.planned_time, class_id, request.library_subject_id
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Lesson already planned for this date, time, class, and subject"
            )

    # Create lesson plan (use first class_id as primary, will link all in junction table)
    lesson_id = await execute_scalar(
        """
        INSERT INTO lesson_plans (
            teacher_id, planned_date, planned_time, class_id, library_subject_id,
            library_board_id, library_book_id, title, description, status, duration_minutes
        ) VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8, $9, 'planned', $10)
        RETURNING id
        """,
        teacher_id, request.planned_date, request.planned_time, request.class_ids[0],
        request.library_subject_id, request.library_board_id, request.library_book_id,
        request.title, request.description, request.duration_minutes
    )

    # Link all classes to lesson plan
    for class_id in request.class_ids:
        await execute_write(
            """
            INSERT INTO lesson_plan_classes (lesson_plan_id, class_id)
            VALUES ($1::uuid, $2::uuid)
            """,
            lesson_id, class_id
        )

    # Link all topics to lesson plan
    for idx, topic in enumerate(request.topics):
        topic_data = await execute_one(
            "SELECT title, chapter_number FROM library_topics WHERE id = $1::uuid",
            topic.library_topic_id
        )

        await execute_write(
            """
            INSERT INTO lesson_plan_topics (
                lesson_plan_id, library_topic_id, chapter_number, topic_title, sort_order
            ) VALUES ($1::uuid, $2::uuid, $3, $4, $5)
            """,
            lesson_id, topic.library_topic_id,
            topic_data["chapter_number"] if topic_data else topic.chapter_number,
            topic_data["title"] if topic_data else topic.topic_title,
            idx
        )

        # Update topic_coverage_tracking with first_planned_date
        await execute_write(
            """
            INSERT INTO topic_coverage_tracking (
                teacher_id, library_topic_id, class_id,
                first_planned_date, is_covered, coverage_count
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, false, 1)
            ON CONFLICT (teacher_id, library_topic_id, class_id)
            DO UPDATE SET
                first_planned_date = COALESCE(topic_coverage_tracking.first_planned_date, $4),
                coverage_count = coverage_count + 1
            """,
            teacher_id, topic.library_topic_id, request.class_ids[0], request.planned_date
        )

    return await get_lesson_plan_details(str(lesson_id))


@router.get("/{lesson_id}")
async def get_lesson_plan(
    lesson_id: str,
    current_user = Depends(get_user_from_token),
):
    """Get a single lesson plan by ID."""
    lesson = await execute_one(
        "SELECT teacher_id FROM lesson_plans WHERE id = $1::uuid",
        lesson_id
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson plan not found")

    # Verify teacher owns this lesson
    if str(lesson["teacher_id"]) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view this lesson")

    return await get_lesson_plan_details(lesson_id)


@router.get("/teacher/{teacher_id}")
async def list_teacher_lessons(
    teacher_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user = Depends(get_user_from_token),
):
    """List teacher's lesson plans with optional filters."""
    # Verify teacher can only view own lessons
    if str(teacher_id) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You can only view your own lessons")

    # Build query with proper parameterization
    query = "SELECT id FROM lesson_plans WHERE teacher_id = $1::uuid"
    params = [teacher_id]
    param_count = 1

    # Parse date strings to date objects
    date_from_obj = None
    date_to_obj = None
    try:
        if date_from:
            date_from_obj = datetime.fromisoformat(date_from).date()
            param_count += 1
            query += f" AND planned_date >= ${param_count}"
            params.append(date_from_obj)

        if date_to:
            date_to_obj = datetime.fromisoformat(date_to).date()
            param_count += 1
            query += f" AND planned_date <= ${param_count}"
            params.append(date_to_obj)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format: YYYY-MM-DD")

    if class_id:
        param_count += 1
        query += f" AND id IN (SELECT lesson_plan_id FROM lesson_plan_classes WHERE class_id = ${param_count}::uuid)"
        params.append(class_id)

    if status:
        param_count += 1
        query += f" AND status = ${param_count}"
        params.append(status)

    query += " ORDER BY planned_date ASC"

    # Get total count with same filters
    count_query = "SELECT COUNT(*) as count FROM lesson_plans WHERE teacher_id = $1::uuid"
    count_params = [teacher_id]
    if date_from_obj:
        count_params.append(date_from_obj)
        count_query += f" AND planned_date >= ${len(count_params)}"
    if date_to_obj:
        count_params.append(date_to_obj)
        count_query += f" AND planned_date <= ${len(count_params)}"
    if status:
        count_params.append(status)
        count_query += f" AND status = ${len(count_params)}"

    total_result = await execute_one(count_query, *count_params)
    total = total_result["count"] if total_result else 0

    # Apply pagination
    offset = (page - 1) * limit
    query += f" LIMIT {limit} OFFSET {offset}"

    lesson_ids = await execute_query(query, *params)

    lessons = []
    for row in lesson_ids:
        lessons.append(await get_lesson_plan_details(str(row["id"])))

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "lessons": lessons
    }


@router.get("/calendar/{teacher_id}")
async def get_calendar_view(
    teacher_id: str,
    year_month: str = Query(...),  # Format: YYYY-MM
    current_user = Depends(get_user_from_token),
):
    """Get lesson plan counts for calendar view."""
    if str(teacher_id) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You can only view your own calendar")

    try:
        year, month = year_month.split("-")
        year, month = int(year), int(month)
    except:
        raise HTTPException(status_code=400, detail="Invalid year_month format. Use YYYY-MM")

    # Get all lessons for the month
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    lessons = await execute_query(
        """
        SELECT planned_date, class_id
        FROM lesson_plans
        WHERE teacher_id = $1::uuid
          AND planned_date >= $2
          AND planned_date < $3
        """,
        teacher_id,
        month_start,
        month_end
    )

    # Get class names for each date
    dates_data = {}
    for lesson in lessons:
        date_str = lesson["planned_date"].isoformat()
        if date_str not in dates_data:
            dates_data[date_str] = {"lesson_count": 0, "classes": []}

        dates_data[date_str]["lesson_count"] += 1

        # Get class name
        cls = await execute_one(
            "SELECT name FROM classes WHERE id = $1::uuid",
            lesson["class_id"]
        )
        if cls and cls["name"] not in dates_data[date_str]["classes"]:
            dates_data[date_str]["classes"].append(cls["name"])

    return {"dates": dates_data}


@router.put("/{lesson_id}")
async def update_lesson_plan(
    lesson_id: str,
    request: UpdateLessonPlanRequest,
    current_user = Depends(get_user_from_token),
):
    """Update an existing lesson plan."""
    lesson = await execute_one(
        "SELECT teacher_id, library_subject_id, library_book_id FROM lesson_plans WHERE id = $1::uuid",
        lesson_id
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson plan not found")

    if str(lesson["teacher_id"]) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to edit this lesson")

    # Update basic fields
    updates = []
    params = []
    param_count = 1

    if request.planned_date:
        param_count += 1
        updates.append(f"planned_date = ${param_count}")
        params.append(request.planned_date)

    if request.title is not None:
        param_count += 1
        updates.append(f"title = ${param_count}")
        params.append(request.title)

    if request.description is not None:
        param_count += 1
        updates.append(f"description = ${param_count}")
        params.append(request.description)

    if request.status:
        param_count += 1
        updates.append(f"status = ${param_count}")
        params.append(request.status)

    if request.duration_minutes:
        param_count += 1
        updates.append(f"duration_minutes = ${param_count}")
        params.append(request.duration_minutes)

    if updates:
        updates.append("updated_at = NOW()")
        query = f"UPDATE lesson_plans SET {', '.join(updates)} WHERE id = $1::uuid"
        params.insert(0, lesson_id)
        await execute_write(query, *params)

    # Update classes if provided
    if request.class_ids:
        # Validate teacher has assignment for all new classes
        for class_id in request.class_ids:
            await validate_teacher_assignment(
                db, str(current_user["user_id"]), class_id,
                str(lesson["library_subject_id"]), str(lesson["library_book_id"])
            )

        # Delete old class links
        await execute_write(
            "DELETE FROM lesson_plan_classes WHERE lesson_plan_id = $1::uuid",
            lesson_id
        )

        # Add new class links
        for class_id in request.class_ids:
            await execute_write(
                """
                INSERT INTO lesson_plan_classes (lesson_plan_id, class_id)
                VALUES ($1::uuid, $2::uuid)
                """,
                lesson_id, class_id
            )

    # Update topics if provided
    if request.topics:
        # Delete old topic links
        await execute_write(
            "DELETE FROM lesson_plan_topics WHERE lesson_plan_id = $1::uuid",
            lesson_id
        )

        # Add new topic links
        for idx, topic in enumerate(request.topics):
            topic_data = await execute_one(
                "SELECT title, chapter_number FROM library_topics WHERE id = $1::uuid",
                topic.library_topic_id
            )

            await execute_write(
                """
                INSERT INTO lesson_plan_topics (
                    lesson_plan_id, library_topic_id, chapter_number, topic_title, sort_order
                ) VALUES ($1::uuid, $2::uuid, $3, $4, $5)
                """,
                lesson_id, topic.library_topic_id,
                topic_data["chapter_number"] if topic_data else topic.chapter_number,
                topic_data["title"] if topic_data else topic.topic_title,
                idx
            )

    return await get_lesson_plan_details(lesson_id)


@router.delete("/{lesson_id}")
async def delete_lesson_plan(
    lesson_id: str,
    current_user = Depends(get_user_from_token),
):
    """Delete a lesson plan."""
    lesson = await execute_one(
        "SELECT teacher_id FROM lesson_plans WHERE id = $1::uuid",
        lesson_id
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson plan not found")

    if str(lesson["teacher_id"]) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this lesson")

    # Delete (cascade handles lesson_plan_topics and lesson_plan_classes)
    await execute_write(
        "DELETE FROM lesson_plans WHERE id = $1::uuid",
        lesson_id
    )

    return {"message": "Lesson plan deleted"}


@router.post("/{lesson_id}/mark-complete")
async def mark_lesson_complete(
    lesson_id: str,
    current_user = Depends(get_user_from_token),
):
    """Mark a lesson plan as completed."""
    lesson = await execute_one(
        """
        SELECT teacher_id, class_id FROM lesson_plans WHERE id = $1::uuid
        """,
        lesson_id
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson plan not found")

    if str(lesson["teacher_id"]) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to mark this lesson")

    # Update lesson status
    await execute_write(
        """
        UPDATE lesson_plans
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1::uuid
        """,
        lesson_id
    )

    # Update topic_coverage_tracking for all topics in this lesson
    topics = await execute_query(
        """
        SELECT library_topic_id FROM lesson_plan_topics WHERE lesson_plan_id = $1::uuid
        """,
        lesson_id
    )

    for topic in topics:
        await execute_write(
            """
            UPDATE topic_coverage_tracking
            SET is_covered = true, covered_at = NOW(), last_covered_date = NOW()::date
            WHERE teacher_id = $1::uuid
              AND library_topic_id = $2::uuid
              AND class_id = $3::uuid
            """,
            current_user["user_id"], topic["library_topic_id"], lesson["class_id"]
        )

    return await get_lesson_plan_details(lesson_id)


@router.get("/{teacher_id}/syllabus-coverage")
async def get_syllabus_coverage(
    teacher_id: str,
    class_id: Optional[str] = Query(None),
    library_subject_id: Optional[str] = Query(None),
    current_user = Depends(get_user_from_token),
):
    """Get syllabus coverage statistics for a teacher."""
    if str(teacher_id) != str(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="You can only view your own coverage")

    # Get all topics in assigned books
    query = """
        SELECT DISTINCT lt.id, lt.title, lc.chapter_number
        FROM library_topics lt
        JOIN library_chapters lc ON lt.chapter_id = lc.id
        JOIN library_books lb ON lc.book_id = lb.id
        JOIN teacher_class_subject_assignments tcsa
            ON lb.id = tcsa.library_book_id
        WHERE tcsa.teacher_id = $1::uuid
    """
    params = [teacher_id]

    if library_subject_id:
        query += " AND tcsa.library_subject_id = $2::uuid"
        params.append(library_subject_id)

    all_topics = await execute_query(query, *params)
    total_topics = len(all_topics)

    # Get planned topics
    planned_query = """
        SELECT DISTINCT lpt.library_topic_id
        FROM lesson_plan_topics lpt
        JOIN lesson_plans lp ON lpt.lesson_plan_id = lp.id
        WHERE lp.teacher_id = $1::uuid
    """
    planned_params = [teacher_id]

    if class_id:
        planned_query += " AND lp.class_id = $2::uuid"
        planned_params.append(class_id)

    planned = await execute_query(planned_query, *planned_params)
    planned_topic_ids = {str(p["library_topic_id"]) for p in planned}
    planned_count = len(planned_topic_ids)

    # Get covered topics
    covered_query = """
        SELECT DISTINCT library_topic_id
        FROM topic_coverage_tracking
        WHERE teacher_id = $1::uuid AND is_covered = true
    """
    covered_params = [teacher_id]

    if class_id:
        covered_query += " AND class_id = $2::uuid"
        covered_params.append(class_id)

    covered = await execute_query(covered_query, *covered_params)
    covered_topic_ids = {str(c["library_topic_id"]) for c in covered}
    covered_count = len(covered_topic_ids)

    # Build topics list with status
    topics_by_status = []
    for topic in all_topics:
        topic_id_str = str(topic["id"])
        if topic_id_str in covered_topic_ids:
            status = "covered"
            coverage_info = await execute_one(
                "SELECT covered_at FROM topic_coverage_tracking WHERE library_topic_id = $1::uuid AND teacher_id = $2::uuid AND is_covered = true LIMIT 1",
                topic_id_str, teacher_id
            )
            covered_date = coverage_info["covered_at"].isoformat() if coverage_info and coverage_info["covered_at"] else None
            topics_by_status.append({
                "id": topic_id_str,
                "title": topic["title"],
                "chapter_number": topic["chapter_number"],
                "status": status,
                "covered_date": covered_date
            })
        elif topic_id_str in planned_topic_ids:
            status = "planned"
            lesson_info = await execute_one(
                """
                SELECT lp.planned_date FROM lesson_plans lp
                JOIN lesson_plan_topics lpt ON lp.id = lpt.lesson_plan_id
                WHERE lpt.library_topic_id = $1::uuid AND lp.teacher_id = $2::uuid
                LIMIT 1
                """,
                topic_id_str, teacher_id
            )
            planned_date = lesson_info["planned_date"].isoformat() if lesson_info else None
            topics_by_status.append({
                "id": topic_id_str,
                "title": topic["title"],
                "chapter_number": topic["chapter_number"],
                "status": status,
                "planned_date": planned_date
            })
        else:
            topics_by_status.append({
                "id": topic_id_str,
                "title": topic["title"],
                "chapter_number": topic["chapter_number"],
                "status": "not_planned"
            })

    coverage_percentage = int((covered_count / total_topics * 100)) if total_topics > 0 else 0

    return {
        "total_topics": total_topics,
        "planned_topics": planned_count,
        "covered_topics": covered_count,
        "coverage_percentage": coverage_percentage,
        "topics_by_status": topics_by_status
    }
