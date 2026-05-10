"""
Enrollment-based access checks for student-facing library learning routes.
"""
from app.utils.database import execute_one


async def student_can_access_library_topic(student_id: str, topic_id: str) -> bool:
    """
    True if the topic belongs to a book assigned to any section the student is actively enrolled in.
    """
    row = await execute_one(
        """
        SELECT 1 AS ok
        FROM enrollments e
        JOIN section_books sb ON sb.class_id = e.class_id
        JOIN library_books lb ON lb.id = sb.book_id
        JOIN library_chapters lc ON lc.book_id = lb.id
        JOIN library_topics lt ON lt.chapter_id = lc.id
        WHERE e.student_id = $1::uuid
          AND e.is_active = true
          AND lt.id = $2::uuid
        LIMIT 1
        """,
        student_id,
        topic_id,
    )
    return bool(row)


async def student_can_access_exam(student_id: str, exam_id: str) -> bool:
    row = await execute_one(
        """
        SELECT 1 AS ok
        FROM teacher_exams te
        JOIN enrollments e ON e.class_id = te.class_id
        WHERE te.id = $1::uuid
          AND e.student_id = $2::uuid
          AND e.is_active = true
        LIMIT 1
        """,
        exam_id,
        student_id,
    )
    return bool(row)


async def student_can_access_book(student_id: str, book_id: str) -> bool:
    row = await execute_one(
        """
        SELECT 1 AS ok
        FROM enrollments e
        JOIN section_books sb ON sb.class_id = e.class_id AND sb.book_id = $2::uuid
        WHERE e.student_id = $1::uuid AND e.is_active = true
        LIMIT 1
        """,
        student_id,
        book_id,
    )
    return bool(row)
