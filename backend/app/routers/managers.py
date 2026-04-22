"""
Manager Portal Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta

from app.utils.database import execute_query, execute_one, execute_write

router = APIRouter()


# ============================================
# SCHOOL & BRANCH MANAGEMENT
# ============================================

@router.get("/schools")
async def get_all_schools():
    """
    Get all schools accessible to manager
    """
    
    query = """
        SELECT 
            s.id,
            s.name,
            s.address,
            COUNT(DISTINCT b.id) as branch_count,
            COUNT(DISTINCT c.id) as class_count
        FROM schools s
        LEFT JOIN branches b ON s.id = b.school_id
        LEFT JOIN classes c ON b.id = c.branch_id
        GROUP BY s.id, s.name, s.address
        ORDER BY s.name
    """
    
    schools = await execute_query(query)
    return [dict(school) for school in schools]


@router.get("/schools/{school_id}/branches")
async def get_school_branches(school_id: str):
    """
    Get all branches for a school
    """
    
    query = """
        SELECT 
            b.id,
            b.name,
            b.address,
            COUNT(DISTINCT c.id) as class_count,
            COUNT(DISTINCT e.student_id) as student_count
        FROM branches b
        LEFT JOIN classes c ON b.id = c.branch_id
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        WHERE b.school_id = $1
        GROUP BY b.id, b.name, b.address
        ORDER BY b.name
    """
    
    branches = await execute_query(query, school_id)
    return [dict(branch) for branch in branches]


@router.get("/branches/{branch_id}/overview")
async def get_branch_overview(branch_id: str):
    """
    Get comprehensive overview of a branch
    """
    
    # Basic stats
    stats_query = """
        SELECT 
            COUNT(DISTINCT c.id) as total_classes,
            COUNT(DISTINCT e.student_id) as total_students,
            COUNT(DISTINCT c.teacher_id) as total_teachers,
            COUNT(DISTINCT cs.subject_id) as total_subjects
        FROM classes c
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        LEFT JOIN class_subjects cs ON c.id = cs.class_id
        WHERE c.branch_id = $1
    """
    
    stats = await execute_one(stats_query, branch_id)
    
    # Classes with details
    classes_query = """
        SELECT 
            c.id,
            c.name,
            c.grade_level,
            u.full_name as teacher_name,
            COUNT(DISTINCT e.student_id) as student_count
        FROM classes c
        LEFT JOIN users u ON c.teacher_id = u.id
        LEFT JOIN enrollments e ON c.id = e.class_id AND e.is_active = true
        WHERE c.branch_id = $1
        GROUP BY c.id, c.name, c.grade_level, u.full_name
        ORDER BY c.grade_level, c.name
    """
    
    classes = await execute_query(classes_query, branch_id)
    
    return {
        "branch_id": branch_id,
        "statistics": dict(stats),
        "classes": [dict(c) for c in classes]
    }


# ============================================
# STUDENT REPORTS
# ============================================

@router.get("/reports/students")
async def get_student_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    class_id: Optional[str] = None,
    period: str = "monthly"  # daily, weekly, monthly, quarterly, yearly, all
):
    """
    Get student-wise performance reports
    """
    
    # Calculate date range
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "all": 36500  # 100 years
    }
    
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)
    
    # Build dynamic query based on filters
    where_clauses = ["sp.date >= $1"]
    params = [date_from]
    param_count = 2
    
    if class_id:
        where_clauses.append(f"sp.class_id = ${param_count}")
        params.append(class_id)
        param_count += 1
    elif branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    
    query = f"""
        SELECT 
            u.id as student_id,
            u.full_name,
            u.email,
            c.name as class_name,
            b.name as branch_name,
            s.name as school_name,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score,
            MAX(sp.ranking) as best_ranking
        FROM student_performance sp
        JOIN users u ON sp.student_id = u.id
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, u.email, c.name, b.name, s.name
        ORDER BY avg_overall_score DESC NULLS LAST
    """
    
    students = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "filters": {
            "school_id": school_id,
            "branch_id": branch_id,
            "class_id": class_id
        },
        "students": [dict(s) for s in students]
    }


# ============================================
# CLASS REPORTS
# ============================================

@router.get("/reports/classes")
async def get_class_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    period: str = "monthly"
):
    """
    Get class-wise performance reports
    """
    
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "all": 36500
    }
    
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    
    query = f"""
        SELECT 
            c.id as class_id,
            c.name as class_name,
            c.grade_level,
            b.name as branch_name,
            s.name as school_name,
            u.full_name as teacher_name,
            COUNT(DISTINCT sp.student_id) as student_count,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY c.id, c.name, c.grade_level, b.name, s.name, u.full_name
        ORDER BY avg_overall_score DESC NULLS LAST
    """
    
    classes = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "classes": [dict(cls) for cls in classes]
    }


# ============================================
# TEACHER REPORTS
# ============================================

@router.get("/reports/teachers")
async def get_teacher_wise_report(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    period: str = "monthly"
):
    """
    Get teacher-wise performance reports based on their students
    """
    
    period_days = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "all": 36500
    }
    
    days = period_days.get(period, 30)
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1", "u.role = 'teacher'"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    
    query = f"""
        SELECT 
            u.id as teacher_id,
            u.full_name as teacher_name,
            u.email,
            COUNT(DISTINCT c.id) as class_count,
            COUNT(DISTINCT sp.student_id) as student_count,
            AVG(sp.video_completion_rate) as avg_student_video_completion,
            AVG(sp.attendance_rate) as avg_student_attendance,
            AVG(sp.average_quiz_score) as avg_student_quiz_score,
            AVG(sp.overall_score) as avg_student_overall_score
        FROM users u
        JOIN classes c ON u.id = c.teacher_id
        JOIN branches b ON c.branch_id = b.id
        JOIN schools s ON b.school_id = s.id
        LEFT JOIN student_performance sp ON c.id = sp.class_id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY avg_student_overall_score DESC NULLS LAST
    """
    
    teachers = await execute_query(query, *params)
    
    return {
        "period": period,
        "date_from": date_from.isoformat(),
        "teachers": [dict(t) for t in teachers]
    }


# ============================================
# GRAPHICAL ANALYTICS DATA
# ============================================

@router.get("/analytics/dashboard")
async def get_dashboard_analytics(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    days: int = 30
):
    """
    Get data for graphical dashboard visualizations
    """
    
    date_from = datetime.now().date() - timedelta(days=days)
    
    where_clauses = ["sp.date >= $1"]
    params = [date_from]
    param_count = 2
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
    
    # Daily trend data
    trend_query = f"""
        SELECT 
            sp.date,
            COUNT(DISTINCT sp.student_id) as active_students,
            AVG(sp.video_completion_rate) as avg_video_completion,
            AVG(sp.attendance_rate) as avg_attendance,
            AVG(sp.average_quiz_score) as avg_quiz_score,
            AVG(sp.overall_score) as avg_overall_score
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY sp.date
        ORDER BY sp.date
    """
    
    trends = await execute_query(trend_query, *params)
    
    # Performance distribution
    distribution_query = f"""
        SELECT 
            CASE 
                WHEN sp.overall_score >= 90 THEN 'Excellent (90-100)'
                WHEN sp.overall_score >= 75 THEN 'Good (75-89)'
                WHEN sp.overall_score >= 60 THEN 'Average (60-74)'
                WHEN sp.overall_score >= 40 THEN 'Below Average (40-59)'
                ELSE 'Poor (0-39)'
            END as performance_band,
            COUNT(DISTINCT sp.student_id) as student_count
        FROM student_performance sp
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY performance_band
        ORDER BY 
            CASE performance_band
                WHEN 'Excellent (90-100)' THEN 1
                WHEN 'Good (75-89)' THEN 2
                WHEN 'Average (60-74)' THEN 3
                WHEN 'Below Average (40-59)' THEN 4
                ELSE 5
            END
    """
    
    distribution = await execute_query(distribution_query, *params)
    
    # Subject-wise performance
    subject_query = f"""
        SELECT 
            s.name as subject_name,
            AVG(qa.score) as avg_quiz_score,
            COUNT(DISTINCT qa.student_id) as student_count
        FROM quiz_attempts qa
        JOIN quiz_instances qi ON qa.quiz_instance_id = qi.id
        JOIN published_videos pv ON qi.published_video_id = pv.id
        JOIN video_templates vt ON pv.video_template_id = vt.id
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        JOIN class_subjects cs ON s.id = cs.subject_id
        JOIN classes c ON cs.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE qa.is_completed = true 
            AND qa.submitted_at >= $1
            {' AND ' + ' AND '.join(where_clauses[1:]) if len(where_clauses) > 1 else ''}
        GROUP BY s.name
        ORDER BY avg_quiz_score DESC
    """
    
    subjects = await execute_query(subject_query, *params)
    
    # Top performers
    top_performers_query = f"""
        SELECT 
            u.full_name,
            c.name as class_name,
            AVG(sp.overall_score) as avg_score
        FROM student_performance sp
        JOIN users u ON sp.student_id = u.id
        JOIN classes c ON sp.class_id = c.id
        JOIN branches b ON c.branch_id = b.id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY u.id, u.full_name, c.name
        ORDER BY avg_score DESC
        LIMIT 10
    """
    
    top_performers = await execute_query(top_performers_query, *params)
    
    return {
        "date_from": date_from.isoformat(),
        "date_to": datetime.now().date().isoformat(),
        "trends": [dict(t) for t in trends],
        "performance_distribution": [dict(d) for d in distribution],
        "subject_performance": [dict(s) for s in subjects],
        "top_performers": [dict(tp) for tp in top_performers]
    }


# ============================================
# PASSWORD RESET (for teachers and students)
# ============================================

@router.post("/users/{user_id}/password-reset")
async def send_password_reset_link(user_id: str):
    """
    Generate password reset link for any user (teacher or student)
    """
    
    import uuid
    
    user = await execute_one("SELECT email, role FROM users WHERE id = $1", user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(hours=24)
    
    query = """
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING token
    """
    
    await execute_one(query, user_id, reset_token, expires_at)
    
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    return {
        "message": "Password reset link generated",
        "email": user["email"],
        "role": user["role"],
        "reset_link": reset_link,
        "token": reset_token
    }


# ============================================
# SYSTEM STATISTICS
# ============================================

@router.get("/statistics/overview")
async def get_system_overview(
    school_id: Optional[str] = None,
    branch_id: Optional[str] = None
):
    """
    Get high-level system statistics
    """
    
    where_clauses = []
    params = []
    param_count = 1
    
    join_tables = ""
    
    if branch_id:
        where_clauses.append(f"c.branch_id = ${param_count}")
        params.append(branch_id)
        param_count += 1
        join_tables = "JOIN classes c ON e.class_id = c.id"
    elif school_id:
        where_clauses.append(f"b.school_id = ${param_count}")
        params.append(school_id)
        param_count += 1
        join_tables = """
            JOIN classes c ON e.class_id = c.id
            JOIN branches b ON c.branch_id = b.id
        """
    
    where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    # Total counts
    stats_query = f"""
        SELECT 
            COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as total_students,
            COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as total_teachers,
            COUNT(DISTINCT e.class_id) as total_classes,
            COUNT(DISTINCT pv.id) as total_videos,
            COUNT(DISTINCT qa.id) as total_quiz_attempts
        FROM users u
        LEFT JOIN enrollments e ON u.id = e.student_id AND e.is_active = true
        {join_tables}
        LEFT JOIN published_videos pv ON e.class_id IS NOT NULL
        LEFT JOIN quiz_instances qi ON pv.id = qi.published_video_id
        LEFT JOIN quiz_attempts qa ON qi.id = qa.quiz_instance_id AND qa.is_completed = true
        {where_clause}
    """
    
    stats = await execute_one(stats_query, *params) if params else await execute_one(stats_query.replace("$1", "NULL"))
    
    return dict(stats) if stats else {}
