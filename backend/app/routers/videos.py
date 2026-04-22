"""
Video Management Routes
"""
from fastapi import APIRouter
from app.utils.database import execute_query

router = APIRouter()

@router.get("/analytics/{video_id}")
async def get_video_analytics(video_id: str):
    """Get video watch analytics"""
    query = """
        SELECT 
            COUNT(DISTINCT student_id) as total_viewers,
            AVG(completion_percentage) as avg_completion,
            SUM(total_watch_time_seconds) as total_watch_time
        FROM video_watch_sessions
        WHERE published_video_id = $1
    """
    stats = await execute_query(query, video_id)
    return dict(stats[0]) if stats else {}

# Additional endpoints to be implemented
