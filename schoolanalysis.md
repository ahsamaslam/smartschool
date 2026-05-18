System Overview: Multi-Dimensional Performance Tracking
Your system needs three analytical layers:

Student Health Score (SHS) - Individual performance tracking
Class Vitality Index (CVI) - Teacher effectiveness measurement
School Performance Index (SPI) - Principal/management effectiveness


1. Student Health Score (SHS) - Individual Level
Daily Metrics to Track
python# Core Engagement Metrics
daily_metrics = {
    "video_engagement": {
        "completion_rate": 0-100,      # % of video watched
        "focus_score": 0-100,          # Active viewing time (pauses, rewinds indicate engagement)
        "avg_watch_speed": 1.0,        # Playback speed (1x is normal)
        "drops_count": int,            # How many times student left video
    },
    
    "comprehension_metrics": {
        "quiz_score": 0-100,           # Test performance
        "first_attempt_score": 0-100,  # Score without retakes
        "questions_asked": int,        # AI chatbot interactions
        "question_quality": 0-10,      # AI evaluates question depth
    },
    
    "consistency_metrics": {
        "login_time": datetime,        # When they logged in
        "study_duration": minutes,     # Total active time
        "homework_submission": bool,   # On-time submission
        "attendance": bool,            # Present/absent
    },
    
    "behavioral_indicators": {
        "help_seeking": int,           # How often they ask for help
        "topic_revisits": int,         # Reviewing past topics
        "test_retakes": int,           # Practice attempts
    }
}
SHS Calculation Formula
python# Weighted Daily Score (0-100)
SHS_daily = (
    (video_engagement * 0.25) +        # 25% weight
    (comprehension * 0.40) +           # 40% weight - most important
    (consistency * 0.20) +             # 20% weight
    (behavioral_health * 0.15)         # 15% weight
)

# 7-Day Rolling Average for trend smoothing
SHS_weekly = average(last_7_days_SHS)

# Momentum Score (trending up/down)
momentum = (current_week_SHS - previous_week_SHS) / previous_week_SHS * 100
Risk Categories & Alerts
pythonrisk_levels = {
    "critical": SHS < 40,      # Red flag - immediate intervention
    "at_risk": 40 <= SHS < 60, # Yellow - needs attention
    "stable": 60 <= SHS < 80,  # Green - performing adequately
    "excelling": SHS >= 80     # Blue - high performer
}

# Predictive Alert System
if momentum < -15:  # 15% decline in 1 week
    alert = "Rapid decline - immediate teacher intervention needed"
elif SHS < 50 for 3 consecutive days:
    alert = "Consistent underperformance - parent meeting recommended"

2. Class Vitality Index (CVI) - Teacher Effectiveness
Aggregated Class Metrics
pythonclass_metrics = {
    "engagement_health": {
        "avg_video_completion": mean(all_students.video_completion),
        "avg_quiz_scores": mean(all_students.quiz_scores),
        "engagement_variance": std_dev(student_SHS),  # Class consistency
    },
    
    "learning_velocity": {
        "class_improvement_rate": (current_avg - baseline_avg) / days,
        "struggling_students_count": count(SHS < 50),
        "excelling_students_count": count(SHS >= 80),
    },
    
    "teacher_interaction_quality": {
        "avg_questions_per_student": mean(questions_asked),
        "question_response_time": avg_time_to_respond,
        "topic_clarity_score": 100 - (repeat_questions / total_questions * 100),
    },
    
    "content_effectiveness": {
        "first_attempt_success_rate": count(quiz_score >= 70 on first try) / total_students,
        "rewatch_necessity": avg(video_rewatches),
        "dropout_rate_in_video": avg(video_drops / video_length),
    }
}
CVI Calculation
pythonCVI = (
    (class_avg_SHS * 0.35) +                    # 35% - student performance
    (learning_velocity * 0.25) +                # 25% - improvement rate
    (engagement_variance_score * 0.20) +        # 20% - class consistency (lower variance = better)
    (content_effectiveness * 0.20)              # 20% - teaching quality
)

# Teacher Performance Grade
if CVI >= 85: grade = "Excellent - Top 10%"
elif CVI >= 75: grade = "Good - Above Average"
elif CVI >= 60: grade = "Satisfactory - Meets Standards"
else: grade = "Needs Improvement - Intervention Required"
Teacher-Specific Alerts
python# Content Quality Issues
if avg_quiz_score < 60 and avg_video_completion > 85:
    alert = "High engagement but low comprehension - content may be too complex"

# Engagement Issues  
if avg_video_completion < 50 and avg_quiz_score < 60:
    alert = "Low engagement AND comprehension - teaching approach needs revision"

# Inequality Issues
if engagement_variance > 25:  # High std deviation
    alert = "Large performance gap - some students being left behind"

3. School Performance Index (SPI) - Principal Effectiveness
School-Wide Metrics
pythonschool_metrics = {
    "academic_excellence": {
        "school_avg_SHS": mean(all_students.SHS),
        "school_avg_CVI": mean(all_classes.CVI),
        "top_performers_percentage": count(SHS >= 80) / total_students * 100,
        "at_risk_percentage": count(SHS < 50) / total_students * 100,
    },
    
    "teacher_quality": {
        "excellent_teachers": count(CVI >= 85),
        "underperforming_teachers": count(CVI < 60),
        "teacher_consistency": std_dev(all_teachers.CVI),
    },
    
    "operational_efficiency": {
        "avg_attendance_rate": mean(all_students.attendance),
        "homework_submission_rate": mean(homework_submitted / homework_assigned),
        "parent_engagement": count(parent_portal_logins) / total_parents,
    },
    
    "growth_trajectory": {
        "month_over_month_improvement": (current_month_SPI - prev_month_SPI) / prev_month_SPI,
        "student_retention_rate": (current_students / initial_students) * 100,
        "dropout_rate": (students_dropped / total_students) * 100,
    }
}
SPI Calculation
pythonSPI = (
    (academic_excellence * 0.40) +       # 40% - primary goal
    (teacher_quality * 0.30) +           # 30% - resource management
    (operational_efficiency * 0.20) +    # 20% - school management
    (growth_trajectory * 0.10)           # 10% - long-term sustainability
)

# School Rating
if SPI >= 90: rating = "Outstanding - National Excellence"
elif SPI >= 80: rating = "Excellent - Regional Leader"
elif SPI >= 70: rating = "Good - Above Average"
elif SPI >= 60: rating = "Satisfactory - Meets Standards"
else: rating = "Needs Improvement"

4. AI-Powered Predictive Analytics
Using Claude API for Pattern Recognition
python# Daily AI Analysis (runs at midnight)
async def ai_performance_analysis(student_id: str, past_30_days_data: dict):
    prompt = f"""
    Analyze this student's 30-day performance data and predict:
    1. Exam readiness score (0-100)
    2. Topics needing reinforcement
    3. Learning style patterns
    4. Risk of dropout (low/medium/high)
    5. Recommended interventions
    
    Data: {json.dumps(past_30_days_data)}
    
    Return structured JSON with predictions and confidence scores.
    """
    
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return parse_ai_insights(response.content)
Early Warning System
python# Automated daily checks
warning_triggers = {
    "immediate_intervention": [
        (SHS < 30 for 2 days, "Critical - Contact parent immediately"),
        (quiz_score < 30 for 3 consecutive tests, "Subject matter not understood"),
        (video_completion < 20% for 5 days, "Complete disengagement"),
    ],
    
    "schedule_meeting": [
        (SHS declining > 20 points in 7 days, "Sudden performance drop"),
        (attendance < 60% in last 2 weeks, "Chronic absenteeism"),
        (zero homework submissions in 7 days, "Motivational issues"),
    ],
    
    "monitor_closely": [
        (SHS between 40-50 for 10 days, "Borderline performance"),
        (behavioral_health_score declining, "Possible external factors"),
    ]
}

5. Dashboard Visualizations
For Teachers (Daily Use)
┌─────────────────────────────────────────────────┐
│ CLASS 5-A DASHBOARD - Today's Snapshot          │
├─────────────────────────────────────────────────┤
│ Class Health: 72/100 ⚠️ (Down 5 pts from yesterday)│
│                                                 │
│ 🔴 URGENT (3 students)                         │
│ • Ahmed - SHS: 35 ⚠️ Missed last 3 videos     │
│ • Sara - SHS: 42 ⚠️ Quiz scores dropping      │
│ • Ali - SHS: 38 ⚠️ Zero homework this week    │
│                                                 │
│ 🟡 WATCH LIST (7 students)                     │
│ • 5 students below 55 SHS                      │
│ • 2 students declining >10pts this week        │
│                                                 │
│ 🟢 PERFORMING WELL (15 students)               │
│ • Average SHS: 78                              │
│ • Top performer: Fatima (SHS: 94)              │
│                                                 │
│ 📊 TODAY'S TOPIC: "Photosynthesis"            │
│ • Video completion: 68% (class avg)            │
│ • Quiz avg score: 74/100                       │
│ • Questions asked: 23 (high engagement!)       │
└─────────────────────────────────────────────────┘
For Managers (Weekly/Monthly)
┌─────────────────────────────────────────────────┐
│ SCHOOL PERFORMANCE - Weekly Report              │
├─────────────────────────────────────────────────┤
│ Overall SPI: 78/100 ✅ (+3 from last week)     │
│                                                 │
│ 📈 TRENDS                                      │
│ • Student avg SHS: 71 → 73 (↑2.8%)            │
│ • At-risk students: 45 → 38 (↓15.6%)          │
│ • Attendance: 87% → 91% (↑4.6%)               │
│                                                 │
│ 🏆 TOP PERFORMING CLASSES                      │
│ 1. Class 8-B (Teacher: Ms. Khan) - CVI: 89    │
│ 2. Class 6-A (Teacher: Mr. Ahmed) - CVI: 86   │
│ 3. Class 9-C (Teacher: Ms. Ali) - CVI: 84     │
│                                                 │
│ ⚠️ CLASSES NEEDING SUPPORT                     │
│ 1. Class 7-D (Teacher: Mr. Hassan) - CVI: 58  │
│    → Recommendation: Peer mentor from Class 8-B│
│ 2. Class 5-C (Teacher: Ms. Raza) - CVI: 61    │
│    → Recommendation: Content review workshop   │
│                                                 │
│ 🎯 AI PREDICTIONS (Next 30 Days)               │
│ • 12 students at risk of failing midterms      │
│ • 3 teachers may need professional development │
│ • Expected school SPI: 80 (+2.5%)              │
└─────────────────────────────────────────────────┘

6. Database Schema Design
sql-- Daily Performance Snapshots (Time-series data)
CREATE TABLE daily_student_metrics (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id),
    date DATE NOT NULL,
    
    -- Video Engagement
    video_completion_rate DECIMAL(5,2),
    focus_score DECIMAL(5,2),
    video_drops INT,
    
    -- Comprehension
    quiz_score DECIMAL(5,2),
    first_attempt_score DECIMAL(5,2),
    questions_asked INT,
    
    -- Consistency
    attendance BOOLEAN,
    study_duration INT, -- minutes
    homework_submitted BOOLEAN,
    
    -- Calculated Scores
    daily_shs DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- Rolling Averages (Pre-calculated for performance)
CREATE TABLE student_health_scores (
    student_id INT PRIMARY KEY REFERENCES students(id),
    current_shs DECIMAL(5,2),
    weekly_shs DECIMAL(5,2),
    monthly_shs DECIMAL(5,2),
    momentum DECIMAL(5,2), -- % change
    risk_level VARCHAR(20), -- critical/at_risk/stable/excelling
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Class Performance (Aggregated daily)
CREATE TABLE class_vitality_index (
    id SERIAL PRIMARY KEY,
    class_id INT REFERENCES classes(id),
    date DATE NOT NULL,
    
    avg_shs DECIMAL(5,2),
    cvi_score DECIMAL(5,2),
    struggling_count INT,
    excelling_count INT,
    
    engagement_variance DECIMAL(5,2),
    learning_velocity DECIMAL(5,2),
    
    teacher_grade VARCHAR(50),
    alert_message TEXT,
    
    UNIQUE(class_id, date)
);

-- School Performance (Aggregated weekly/monthly)
CREATE TABLE school_performance_index (
    id SERIAL PRIMARY KEY,
    school_id INT REFERENCES schools(id),
    week_start DATE,
    
    spi_score DECIMAL(5,2),
    avg_shs DECIMAL(5,2),
    avg_cvi DECIMAL(5,2),
    
    at_risk_percentage DECIMAL(5,2),
    top_performers_percentage DECIMAL(5,2),
    
    rating VARCHAR(50),
    ai_predictions JSONB,
    
    UNIQUE(school_id, week_start)
);

-- AI Insights Cache
CREATE TABLE ai_performance_insights (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20), -- student/class/school
    entity_id INT,
    analysis_date DATE,
    
    predictions JSONB,
    recommendations JSONB,
    confidence_score DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts Queue
CREATE TABLE performance_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50), -- immediate/meeting/monitor
    severity VARCHAR(20), -- critical/warning/info
    
    student_id INT REFERENCES students(id),
    class_id INT REFERENCES classes(id),
    teacher_id INT REFERENCES teachers(id),
    
    message TEXT,
    action_required TEXT,
    
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

7. Implementation Approach
Phase 1: Data Collection (Week 1-2)
python# FastAPI Background Tasks
@app.on_event("startup")
async def start_metrics_collector():
    # Real-time metric collection
    asyncio.create_task(collect_video_metrics())
    asyncio.create_task(collect_quiz_metrics())
    asyncio.create_task(collect_engagement_metrics())

# Redis for real-time caching
async def cache_live_metrics(student_id: int, metric_type: str, value: float):
    await redis.setex(
        f"live_metric:{student_id}:{metric_type}",
        3600,  # 1 hour TTL
        value
    )
Phase 2: Score Calculation (Week 3)
python# Scheduled job - runs at midnight
@app.post("/cron/calculate-daily-scores")
async def calculate_daily_scores():
    all_students = await db.fetch_all("SELECT id FROM students")
    
    for student in all_students:
        metrics = await get_student_daily_metrics(student.id)
        shs = calculate_shs(metrics)
        
        await db.execute("""
            INSERT INTO daily_student_metrics (student_id, date, daily_shs, ...)
            VALUES ($1, $2, $3, ...)
        """, student.id, date.today(), shs, ...)
        
        # Update rolling averages
        await update_health_scores(student.id)
        
        # Check for alerts
        await check_alert_triggers(student.id, shs)
Phase 3: AI Analysis (Week 4)
python# Weekly AI deep-dive
@app.post("/cron/weekly-ai-analysis")
async def run_ai_analysis():
    # Process in batches of 50 students
    students = await db.fetch_all("SELECT id FROM students")
    
    for batch in chunked(students, 50):
        insights = await asyncio.gather(*[
            analyze_with_claude(student_id)
            for student_id in batch
        ])
        
        await db.executemany("""
            INSERT INTO ai_performance_insights (...)
            VALUES (...)
        """, insights)
Phase 4: Dashboards (Week 5-6)
python# React Components
- StudentHealthCard (live SHS updates)
- ClassVitalityChart (teacher dashboard)
- SchoolPerformanceGrid (manager dashboard)
- AlertCenter (real-time notifications)
- TrendAnalysis (historical charts)
- PredictiveInsights (AI recommendations)

8. Cost Optimization
python# Redis caching strategy
cache_strategy = {
    "live_metrics": "1 hour TTL",     # Real-time data
    "daily_scores": "24 hour TTL",    # Calculated once
    "weekly_reports": "7 day TTL",    # Static historical data
    "ai_insights": "30 day TTL",      # Expensive to regenerate
}

# Claude API usage optimization
api_strategy = {
    "daily_student_analysis": "Only for at-risk students (<60 SHS)",  # ~20% of students
    "weekly_class_analysis": "All classes",                           # ~30 classes
    "monthly_school_analysis": "School-wide trends",                  # 1 per school
}

# Estimated costs (for 1000 students):
# - Redis: $10-20/month (caching layer)
# - Claude API: $50-100/month (selective AI analysis)
# - PostgreSQL: $25-50/month (Supabase free tier covers up to 500MB)

9. Key Benefits
✅ Early Intervention: Catch struggling students 2-3 weeks before they fail
✅ Teacher Accountability: Objective metrics for performance reviews
✅ Data-Driven Decisions: Replace gut feeling with evidence
✅ Personalized Learning: AI identifies individual student needs
✅ Parent Transparency: Share SHS scores for home support
✅ Predictive Planning: Forecast resource needs before problems arise

Next Steps

Review & Refine: Discuss which metrics matter most for your context
Pilot Program: Test with 1-2 classes to validate formulas
Iterate Weights: Adjust scoring weights based on real data
Scale Gradually: Roll out to full school once validated

Would you like me to:

Create the FastAPI endpoints for this system?
Build the database migrations?
Design the React dashboard components?
Implement the AI analysis pipeline?

Let me know which part you'd like to tackle first!