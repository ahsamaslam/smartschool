"""
Attendance Routes
"""
from fastapi import APIRouter, Depends
from app.utils.database import execute_query
from app.routers.auth import get_user_from_token

router = APIRouter()

@router.get("/student/{student_id}")
async def get_student_attendance(student_id: str, current_user: dict = Depends(get_user_from_token)):
    """Get student attendance records"""
    query = """
        SELECT date, is_present, class_id
        FROM attendance
        WHERE student_id = $1
        ORDER BY date DESC
        LIMIT 30
    """
    records = await execute_query(query, student_id)
    return [dict(r) for r in records]
