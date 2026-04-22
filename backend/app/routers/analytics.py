"""
Analytics & Reporting Routes
"""
from fastapi import APIRouter
from app.utils.database import execute_query

router = APIRouter()

@router.get("/student/{student_id}/performance")
async def get_student_performance(student_id: str):
    """Get student performance analytics"""
    query = """
        SELECT * FROM student_performance
        WHERE student_id = $1
        ORDER BY date DESC
        LIMIT 30
    """
    performance = await execute_query(query, student_id)
    return [dict(p) for p in performance]
