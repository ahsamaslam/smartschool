"""
Classes Management Routes
"""
from fastapi import APIRouter, Depends
from app.utils.database import execute_query
from app.routers.auth import get_user_from_token

router = APIRouter()

@router.get("/{class_id}")
async def get_class_details(class_id: str, current_user: dict = Depends(get_user_from_token)):
    """Get class details"""
    query = """
        SELECT c.*, b.name as branch_name, s.name as school_name
        FROM classes c
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        WHERE c.id = $1
    """
    result = await execute_query(query, class_id)
    return dict(result[0]) if result else {}
