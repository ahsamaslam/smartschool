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
    quiz_score: float,              # 0-100
    first_attempt_score: float,     # 0-100
    questions_asked: int,           # raw count; normalised below
    attendance: bool,
    study_duration_minutes: int,    # raw; normalised
    homework_submitted: bool,
    topic_revisits: int,            # raw count
    test_retakes: int,              # raw count
) -> float:
    """
    Weighted daily SHS:
      video engagement  25%
      comprehension     40%
      consistency       20%
      behavioral        15%
    """
    # --- Video engagement sub-score (0-100) ---
    video_engagement = (video_completion_rate * 0.6) + (focus_score * 0.4)

    # --- Comprehension sub-score (0-100) ---
    # questions_asked is positive (curiosity); cap normalise to 20 questions = 100
    question_quality = min(questions_asked / 20.0 * 100, 100)
    comprehension = (quiz_score * 0.55) + (first_attempt_score * 0.35) + (question_quality * 0.10)

    # --- Consistency sub-score (0-100) ---
    attendance_score = 100.0 if attendance else 0.0
    # 60 min of study = full score; cap at 120 min
    study_score = min(study_duration_minutes / 60.0 * 100, 100)
    homework_score = 100.0 if homework_submitted else 0.0
    consistency = (attendance_score * 0.40) + (study_score * 0.35) + (homework_score * 0.25)

    # --- Behavioral health sub-score (0-100) ---
    # revisits and retakes indicate engagement; cap at 5 each = 100
    revisit_score = min(topic_revisits / 5.0 * 100, 100)
    retake_score = min(test_retakes / 3.0 * 100, 100)
    behavioral = (revisit_score * 0.50) + (retake_score * 0.50)

    shs = (
        video_engagement * 0.25
        + comprehension * 0.40
        + consistency * 0.20
        + behavioral * 0.15
    )
    return round(min(max(shs, 0), 100), 2)


def calculate_live_shs(
    video_rate: float,
    homework_rate: float,
    attendance_rate: float,
    homework_submission_rate: float,
    homework_retakes_avg: float = 0,
    topic_revisits_avg: float = 0,
    study_duration_minutes: float = 0,
) -> tuple[float, float, float]:
    """
    Live (current cumulative) SHS using available data:
    - Video Engagement: 25% (lectures watched ≥75%)
    - Homework Comprehension: 40% (marks_awarded/total_marks)
    - Consistency: 20% (attendance + submission rate)
    - Behavioral Health: 15% (retakes + revisits + study duration)

    Returns: (shs_score, consistency_score, behavioral_score)
    """
    # Video engagement (0-100)
    video_engagement = video_rate

    # Homework comprehension via marks (0-100)
    homework_comprehension = homework_rate

    # Consistency: average of attendance and submission rates
    consistency = (attendance_rate + homework_submission_rate) / 2.0

    # Behavioral health: weighted average of 3 factors
    # Retakes: fewer attempts = higher score. Baseline: 1.5 attempts = 85
    retakes_score = max(0, 100 - (homework_retakes_avg * 15))

    # Revisits: more topic revisits = higher score. Baseline: 1 revisit per topic = 80
    revisits_score = min(100, topic_revisits_avg * 40)

    # Duration: more study time = higher score. Baseline: 300 min/month = 100
    duration_score = min(100, (study_duration_minutes / 300.0) * 100) if study_duration_minutes > 0 else 50

    behavioral = (retakes_score + revisits_score + duration_score) / 3.0

    # Final SHS: 25% video + 40% homework + 20% consistency + 15% behavioral
    shs = (
        video_engagement * 0.25
        + homework_comprehension * 0.40
        + consistency * 0.20
        + behavioral * 0.15
    )

    return round(min(max(shs, 0), 100), 2), round(consistency, 2), round(behavioral, 2)


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
