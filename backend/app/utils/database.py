"""
Database utilities and connection management
"""
import asyncpg
from typing import Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db():
    """Initialize database connection pool"""
    global _pool
    
    try:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        logger.info("Database connection pool created")
    except Exception as e:
        logger.error(f"Failed to create database pool: {str(e)}")
        raise


async def close_db():
    """Close database connection pool"""
    global _pool
    
    if _pool:
        await _pool.close()
        logger.info("Database connection pool closed")
        _pool = None


def get_db():
    """
    Get database connection from pool.
    Usage in routes:
        async with get_db() as conn:
            result = await conn.fetch("SELECT * FROM users")
    """
    global _pool
    return _pool.acquire()


async def check_db_health() -> bool:
    """Check if database is accessible"""
    try:
        async with get_db() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False


async def execute_query(query: str, *args):
    """
    Execute a query and return results
    
    Args:
        query: SQL query string
        *args: Query parameters
    
    Returns:
        Query results
    """
    async with get_db() as conn:
        return await conn.fetch(query, *args)


async def execute_one(query: str, *args):
    """
    Execute a query and return single row
    
    Args:
        query: SQL query string
        *args: Query parameters
    
    Returns:
        Single row or None
    """
    async with get_db() as conn:
        return await conn.fetchrow(query, *args)


async def execute_scalar(query: str, *args):
    """
    Execute a query and return single value
    
    Args:
        query: SQL query string
        *args: Query parameters
    
    Returns:
        Single value
    """
    async with get_db() as conn:
        return await conn.fetchval(query, *args)


async def execute_write(query: str, *args):
    """
    Execute INSERT/UPDATE/DELETE query

    Args:
        query: SQL query string
        *args: Query parameters

    Returns:
        Status string
    """
    async with get_db() as conn:
        return await conn.execute(query, *args)


# ============================================
# COMMON QUERY HELPERS
# ============================================

async def get_user_by_id(user_id: str):
    """Get user by ID"""
    query = """
        SELECT id, email, full_name, role, tenant_id, must_change_password, profile_picture_url, is_active, created_at
        FROM users
        WHERE id = $1 AND is_active = true
    """
    return await execute_one(query, user_id)


async def get_user_by_email(email: str):
    """Get user by email (includes password_hash for authentication)."""
    query = """
        SELECT id, email, full_name, role, tenant_id, password_hash, must_change_password, profile_picture_url, is_active, created_at, school_id
        FROM users
        WHERE email = $1 AND is_active = true
    """
    return await execute_one(query, email)


async def get_student_classes(student_id: str):
    """Get all classes for a student"""
    query = """
        SELECT 
            c.id, c.name, c.grade_level,
            b.name as branch_name,
            s.name as school_name,
            u.full_name as teacher_name
        FROM enrollments e
        JOIN classes c ON e.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE e.student_id = $1 AND e.is_active = true
    """
    return await execute_query(query, student_id)


async def get_teacher_classes(teacher_id: str):
    """Get all classes for a teacher"""
    query = """
        SELECT 
            c.id, c.name, c.grade_level,
            b.name as branch_name,
            s.name as school_name,
            COUNT(DISTINCT e.student_id) as student_count
        FROM classes c
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        WHERE c.teacher_id = $1
        GROUP BY c.id, c.name, c.grade_level, b.name, s.name
    """
    return await execute_query(query, teacher_id)


async def get_class_students(class_id: str):
    """Get all students in a class"""
    query = """
        SELECT 
            u.id, u.email, u.full_name, u.profile_picture_url,
            e.enrolled_at
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        WHERE e.class_id = $1 AND e.is_active = true AND u.is_active = true
        ORDER BY u.full_name
    """
    return await execute_query(query, class_id)
