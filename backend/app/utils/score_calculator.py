"""
Score Calculation Utilities
SHS (Student Health Score), CVI (Class Vitality Index), SPI (School Performance Index)
Formulas defined in schoolanalysis.md
"""
from datetime import date, timedelta
from typing import Optional


# ---------------------------------------------------------------------------
# Period helpers
# ---------------------------------------------------------------------------

def get_date_range(
    period: str,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
) -> tuple[date, date]:
    """
    Resolve a named period or custom date range into (date_from, date_to).
    period: 'last_month' | 'last_year' | 'custom'
    """
    today = date.today()
    if period == "last_year":
        return today - timedelta(days=365), today
    if period == "custom" and custom_start and custom_end:
        return date.fromisoformat(custom_start), date.fromisoformat(custom_end)
    # default: last_month
    return today - timedelta(days=30), today


# ---------------------------------------------------------------------------
# SHS — Student Health Score  (0-100)
# ---------------------------------------------------------------------------

def calculate_daily_shs(
    video_completion_rate: float,   # 0-100
    focus_score: float,             # 0-100
    homework_score: float,          # 0-100  (marks_awarded/total_marks*100 or 75 for submission)
    attendance: bool,
    study_duration_minutes: int,    # raw minutes; normalised to 0-100
    topic_revisits: int,            # count of topics revisited
    homework_retakes: int,          # count of homework resubmissions
) -> float:
    """
    Weighted daily SHS (homework replaces quiz):
      video engagement  25%  — watch completion + focus
      homework          40%  — comprehension proxy
      consistency       20%  — attendance + study time
      behavioral        15%  — topic revisits + homework retakes
    """
    # --- Video engagement (0-100) ---
    video_engagement = (video_completion_rate * 0.6) + (focus_score * 0.4)

    # --- Consistency (0-100) ---
    attendance_score = 100.0 if attendance else 0.0
    study_score = min(study_duration_minutes / 60.0 * 100, 100)
    consistency = (attendance_score * 0.60) + (study_score * 0.40)

    # --- Behavioral (0-100): revisits cap 5=100, retakes cap 3=100 ---
    revisit_score = min(topic_revisits / 5.0 * 100, 100)
    retake_score = min(homework_retakes / 3.0 * 100, 100)
    behavioral = (revisit_score * 0.50) + (retake_score * 0.50)

    shs = (
        video_engagement * 0.25
        + homework_score * 0.40
        + consistency * 0.20
        + behavioral * 0.15
    )
    return round(min(max(shs, 0), 100), 2)


def calculate_live_shs(
    video_rate: float,              # 0-100: Video watch completion
    homework_grade: float,          # 0-100: Homework marks (replaces quiz)
    attendance_rate: float,         # 0-100: Attendance percentage
    behavioral_score: float = 0.0,  # 0-100: topic revisits + homework retakes
) -> float:
    """
    SHS formula — 4 components (homework replaces quiz):
      Video       25%  — lecture watch completion
      Homework    40%  — comprehension / academic work
      Attendance  20%  — consistency
      Behavioral  15%  — topic revisits + homework retakes

    Returns: shs_score (0-100)
    """
    video_rate = max(0, min(video_rate, 100))
    homework_grade = max(0, min(homework_grade, 100))
    attendance_rate = max(0, min(attendance_rate, 100))
    behavioral_score = max(0, min(behavioral_score, 100))

    shs = (
        video_rate * 0.25
        + homework_grade * 0.40
        + attendance_rate * 0.20
        + behavioral_score * 0.15
    )
    return round(min(max(shs, 0), 100), 2)


def get_risk_level(shs: float) -> str:
    if shs < 40:
        return "critical"
    if shs < 60:
        return "at_risk"
    if shs < 80:
        return "stable"
    return "excelling"


def calculate_momentum(current_week_shs: float, prev_week_shs: float) -> float:
    """% change week-over-week. Returns 0 if previous week is 0."""
    if not prev_week_shs:
        return 0.0
    return round((current_week_shs - prev_week_shs) / prev_week_shs * 100, 2)


# ---------------------------------------------------------------------------
# CVI — Class Vitality Index  (0-100)
# ---------------------------------------------------------------------------

def calculate_cvi(
    class_avg_shs: float,              # 0-100
    learning_velocity: float,          # normalised improvement rate 0-100
    engagement_variance: float,        # std-dev of student SHS; lower = better
    content_effectiveness: float,      # first_attempt_success_rate 0-100
) -> float:
    """
    Weighted CVI:
      class_avg_shs         35%
      learning_velocity     25%
      engagement_variance   20%  (inverted: lower variance → higher score)
      content_effectiveness 20%
    """
    # Variance score: 0 variance = 100 pts, 40+ variance = 0 pts
    variance_score = max(0, 100 - (engagement_variance / 40.0 * 100))

    cvi = (
        class_avg_shs * 0.35
        + learning_velocity * 0.25
        + variance_score * 0.20
        + content_effectiveness * 0.20
    )
    return round(min(max(cvi, 0), 100), 2)


def get_teacher_grade(cvi: float) -> str:
    if cvi >= 85:
        return "Excellent"
    if cvi >= 75:
        return "Good"
    if cvi >= 60:
        return "Satisfactory"
    return "Needs Improvement"


# ---------------------------------------------------------------------------
# SPI — School Performance Index  (0-100)
# ---------------------------------------------------------------------------

def calculate_spi(
    school_avg_shs: float,              # 0-100
    school_avg_cvi: float,              # 0-100
    top_performers_pct: float,          # % of students with SHS >= 80
    at_risk_pct: float,                 # % of students with SHS < 50
    excellent_teachers_pct: float,      # % of teachers with CVI >= 85
    underperforming_teachers_pct: float,# % of teachers with CVI < 60
    avg_attendance_rate: float,         # 0-100
    homework_submission_rate: float,    # 0-100
    mom_improvement: float,             # month-over-month SPI % change
) -> float:
    """
    Weighted SPI:
      academic_excellence   40%
      teacher_quality       30%
      operational_efficiency 20%
      growth_trajectory     10%
    """
    # Academic excellence (0-100)
    academic_excellence = (
        school_avg_shs * 0.50
        + top_performers_pct * 0.30
        + (100 - at_risk_pct) * 0.20
    )

    # Teacher quality (0-100)
    teacher_quality = (
        school_avg_cvi * 0.50
        + excellent_teachers_pct * 0.30
        + (100 - underperforming_teachers_pct) * 0.20
    )

    # Operational efficiency (0-100)
    operational_efficiency = (avg_attendance_rate * 0.60) + (homework_submission_rate * 0.40)

    # Growth trajectory: cap mom_improvement at ±20 → map to 0-100
    growth_score = min(max((mom_improvement + 20) / 40.0 * 100, 0), 100)

    spi = (
        academic_excellence * 0.40
        + teacher_quality * 0.30
        + operational_efficiency * 0.20
        + growth_score * 0.10
    )
    return round(min(max(spi, 0), 100), 2)


def get_school_rating(spi: float) -> str:
    if spi >= 90:
        return "Outstanding"
    if spi >= 80:
        return "Excellent"
    if spi >= 70:
        return "Good"
    if spi >= 60:
        return "Satisfactory"
    return "Needs Improvement"
