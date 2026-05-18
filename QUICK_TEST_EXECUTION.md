# 🚀 Quick Test Execution Guide - Run Tests Now!

---

## ⚡ Setup Phase (5 minutes)

### Step 1: Start Backend & Frontend

**Terminal 1 - Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload
# Expected: ✅ Uvicorn running on http://127.0.0.1:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Expected: ✅ Vite dev server running on http://localhost:5173
```

### Step 2: Verify Database Connection

```bash
# Test backend is ready
curl http://localhost:8000/api/auth/health
# Expected: ✅ 200 OK
```

---

## 📝 Create Test Data (10 minutes)

### Step 1: Create Test User Accounts

Use the UI to create or get credentials:
```
Teacher Login: teacher@school.com / password
Student 1: ahmed@school.com / password
Student 2: sara@school.com / password
Student 3: ali@school.com / password
```

### Step 2: Create Test Class

Navigate: **Teacher Dashboard → Classes → Create New**
```
Class Name: "Class 5-A (Test)"
Grade Level: "5"
Section: "A"
```
Note the `class_id` from URL: `/teacher/classes/{CLASS_ID}`

### Step 3: Enroll Test Students

Navigate: **Class Detail → Add Student**
```
Student 1: Ahmed Hassan (ahmed@school.com)
Student 2: Sara Ali (sara@school.com)
Student 3: Ali Khan (ali@school.com)
```

---

## 🧪 Part 1: SHS Calculation Tests

### Test 1A: Create Excelling Student Data (SHS ~82)

**Open Database CLI:**
```sql
-- 1. Get student ID
SELECT id FROM users WHERE email = 'ahmed@school.com';
-- Copy student_id → {STUDENT_ID}

-- 2. Get class ID
SELECT id FROM classes WHERE name = 'Class 5-A (Test)';
-- Copy class_id → {CLASS_ID}

-- 3. Insert attendance (90%)
INSERT INTO attendance (student_id, class_id, date, is_present, marked_by)
VALUES 
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-01', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-02', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-03', false, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-04', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-05', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-06', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-07', false, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-08', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-09', true, 'teacher-123'),
  ('{STUDENT_ID}'::uuid, '{CLASS_ID}'::uuid, '2024-05-10', true, 'teacher-123');
-- Result: 8/10 present = 80%

-- 4. Create homework assignment
INSERT INTO homeworks (id, class_id, teacher_id, title, description, total_marks, status, due_date)
VALUES 
  (gen_random_uuid(), '{CLASS_ID}'::uuid, 'teacher-123', 'Chapter 3 Practice', 'Math homework', 20, 'published', '2024-05-16');
-- Copy homework_id → {HOMEWORK_ID}

-- 5. Submit and grade homework
INSERT INTO homework_submissions (id, homework_id, student_id, submission_status, marks_awarded, graded_at)
VALUES 
  (gen_random_uuid(), '{HOMEWORK_ID}'::uuid, '{STUDENT_ID}'::uuid, 'submitted', 16, NOW());
-- Result: 16/20 = 80%

-- 6. Record video progress (85% watched)
INSERT INTO student_topic_progress (student_id, topic_id, lecture_watch_percent, last_opened_at, updated_at)
VALUES 
  ('{STUDENT_ID}'::uuid, 'topic-123', 85, NOW(), NOW());
-- Result: 85% watched
```

**Verify Data:**
```sql
-- Check attendance
SELECT COUNT(*) as total, SUM(CASE WHEN is_present THEN 1 ELSE 0 END) as present
FROM attendance WHERE student_id = '{STUDENT_ID}'::uuid AND class_id = '{CLASS_ID}'::uuid;
-- Expected: total=10, present=8 → 80% ✅

-- Check homework grade
SELECT marks_awarded, total_marks, (marks_awarded::float / total_marks * 100) as percentage
FROM homework_submissions hs
JOIN homeworks h ON h.id = hs.homework_id
WHERE hs.student_id = '{STUDENT_ID}'::uuid;
-- Expected: 16/20 = 80% ✅

-- Check video progress
SELECT lecture_watch_percent FROM student_topic_progress WHERE student_id = '{STUDENT_ID}'::uuid;
-- Expected: 85 ✅
```

**Test API:**
```bash
curl "http://localhost:8000/api/teachers/students/{STUDENT_ID}/performance?class_id={CLASS_ID}" \
  -H "Authorization: Bearer {TOKEN}"

# Expected response:
{
  "shs": 82.02,
  "risk_level": "excelling",
  "video": { "rate": 85, ... },
  "homework": { "rate": 80, ... },
  "attendance": { "rate": 80, ... },
  "consistency": { "rate": 82.5, ... },
  "behavioral": { "rate": 75.11, ... }
}
```

**Test Frontend:**
1. Navigate: `/teacher/classes/{CLASS_ID}`
2. Verify StudentList shows Ahmed with:
   - ✅ Video %: 85%
   - ✅ Attendance %: 80%
   - ✅ Homework: 80%
   - ✅ Overall: ~82% (blue badge 🔵)
   - ✅ Ranking: #1

3. Click Ahmed's row → Opens StudentDetail
4. Verify StudentDetail shows:
   - ✅ SHS: 82 🔵
   - ✅ Risk Level: "Excelling"
   - ✅ All component breakdowns
   - ✅ Blue badge for all cards

---

### Test 1B: Create Critical Student Data (SHS ~34)

**Repeat above steps for sara@school.com:**

```sql
-- Same structure but with poor values:
-- Attendance: 5/10 = 50%
-- Homework: 7/20 = 35%
-- Video: 20%
-- Study: 80 minutes

-- Expected SHS calculation:
-- Video Engagement = 20
-- Homework = 35
-- Consistency = (50 + 40) / 2 = 45
-- Behavioral = ~34
-- SHS = (20×0.25) + (35×0.40) + (45×0.20) + (34×0.15) ≈ 33.6
```

**Test Frontend:**
1. StudentList should show Sara with:
   - ✅ Red badge 🔴
   - ✅ Overall: ~34% 
   - ✅ Rank: Last or near bottom

2. Daily Dashboard should show Sara in:
   - ✅ 🔴 URGENT section (not WATCH LIST)

3. StudentDetail should show:
   - ✅ Red badge
   - ✅ Alerts: "Attendance critical", "Homework critical", "Video engagement critical"

---

## 🧪 Part 2: Momentum Score Tests

### Test 2A: Positive Momentum

**Setup:**
- Student SHS last week: 68
- Student SHS this week: 75

**Expected:**
```
Momentum = ((75 - 68) / 68) × 100 = 10.29% ✅
Indicator: ↑ +10.29%
Alert: None (positive)
```

**Verify:**
```bash
curl "http://localhost:8000/api/teachers/students/{STUDENT_ID}/performance?class_id={CLASS_ID}"

# Check response for "momentum" field
# Should show: 10.29
```

**Frontend:**
- StudentDetail shows: "↑ +10.29%"
- No alert triggered

---

### Test 2B: Negative Momentum (< -15%)

**Setup:**
- Student SHS last week: 72
- Student SHS this week: 50

**Expected:**
```
Momentum = ((50 - 72) / 72) × 100 = -30.56%
Alert Trigger: momentum < -15% ✅ CRITICAL
Alert Message: "Rapid decline - immediate intervention needed"
```

**Verify in Database:**
```sql
SELECT alert_type, severity, message FROM performance_alerts 
WHERE student_id = '{STUDENT_ID}'::uuid AND alert_type = 'rapid_decline'
ORDER BY created_at DESC LIMIT 1;
-- Expected: rapid_decline, CRITICAL, "Rapid decline..." ✅
```

**Verify in Frontend:**
- Daily Dashboard shows in "Critical Alerts" section
- StudentDetail shows: "↓ -30.56%"
- Alert card visible with recommendation

---

## 🧪 Part 3: Video Engagement & Focus Metrics

### Test 3A: Video Progress Tracking

**Manual Simulation:**
1. Navigate: `/student/learn/topic/topic-123` (as student)
2. Click Play → onPlay fires → watchStartTime = now()
3. Wait 100 seconds
4. Click Pause → pauseCount += 1, totalWatchSeconds += 100
5. Click Resume → watchStartTime = now()
6. Wait 150 seconds
7. Rewind 30 seconds → rewindCount += 1 (detected on next onTimeUpdate)
8. Complete rest of video (250s) → onEnded fires → Report 100%

**Verify Sent Data:**
- Open browser DevTools → Network tab
- Filter: `POST /learning/progress`
- Check payload includes:
```json
{
  "topic_id": "topic-123",
  "lecture_watch_percent": 100,
  "focus_metrics": {
    "pauseCount": 2,
    "rewindCount": 1,
    "dropsCount": 0,
    "totalWatchSeconds": 500
  }
}
```

**Verify in Database:**
```sql
SELECT pause_count, rewind_count, focus_score FROM video_focus_metrics
WHERE student_id = '{STUDENT_ID}'::uuid AND topic_id = 'topic-123';
-- Expected: 2, 1, 80 ✅
```

---

## 🧪 Part 4: Homework Submission & Grading

### Test 4A: Submit Homework

**As Student:**
1. Navigate: `/student/homework`
2. Find homework "Chapter 3 Practice"
3. Click Submit → Upload file
4. System records: `submission_status = 'submitted'`

**Verify in Database:**
```sql
SELECT submission_status, submitted_at FROM homework_submissions 
WHERE homework_id = '{HOMEWORK_ID}'::uuid AND student_id = '{STUDENT_ID}'::uuid
ORDER BY submitted_at DESC LIMIT 1;
-- Expected: submitted, 2024-05-15 14:30 ✅
```

### Test 4B: Teacher Grades

**As Teacher:**
1. Navigate: `/teacher/classes/{CLASS_ID}/homework/{HOMEWORK_ID}/submissions`
2. Find student submission
3. Click "Grade" → Enter marks: 16
4. System records: `marks_awarded = 16`

**Verify in Database:**
```sql
SELECT marks_awarded, graded_at FROM homework_submissions
WHERE homework_id = '{HOMEWORK_ID}'::uuid AND student_id = '{STUDENT_ID}'::uuid;
-- Expected: 16, 2024-05-17 09:00 ✅
```

**Verify StudentList:**
- Navigate: `/teacher/classes/{CLASS_ID}`
- Find student row
- Column "Homework": Should show "80%" (16/20 × 100)

---

## 🧪 Part 5: Attendance Tracking

### Test 5A: Mark Attendance

**As Teacher:**
1. Navigate: `/teacher/attendance`
2. Select class: "Class 5-A (Test)"
3. Select date: "2024-05-01"
4. Check students as present/absent
5. Submit

**Repeat for 10 dates** with pattern:
```
Day 1: Present
Day 2: Present
Day 3: Absent
Day 4: Present
Day 5: Present
Day 6: Present
Day 7: Absent
Day 8: Present
Day 9: Present
Day 10: Present
Result: 8/10 = 80% ✅
```

**Verify in StudentList:**
- Column "Attendance %": Should show "80%"

**Verify Alert Trigger (< 60%):**
- Mark absent 6 more days
- New: 8/16 = 50%
- Check alert appears: "Attendance critical (50%)"

---

## 🧪 Part 6: Alerts System

### Test 6A: All Alert Types

| Alert | Setup | Verify |
|-------|-------|--------|
| **Rapid Decline** | momentum < -15% | `GET /api/metrics/class/{id}/alerts?severity=critical` |
| **Critical SHS** | SHS < 30 for 2 days | Alert appears in daily dashboard |
| **Chronic Absenteeism** | < 60% in 2 weeks | Alert in StudentDetail |
| **Video Disengagement** | < 20% for 5 days | Alert notification |
| **Homework Zero** | 0% submissions for 7 days | Critical alert |
| **Behavioral Decline** | Score ↓10+ week-over-week | Warning alert |

**Test Command:**
```bash
curl "http://localhost:8000/api/metrics/class/{CLASS_ID}/alerts" \
  -H "Authorization: Bearer {TOKEN}"

# Expected: Array of all triggered alerts
[
  {
    "alert_type": "rapid_decline",
    "severity": "critical",
    "student_id": "{STUDENT_ID}",
    "message": "Momentum -30.56% — immediate intervention needed",
    "action_required": "Schedule 1-on-1 meeting"
  },
  ...
]
```

---

## 🧪 Part 7: CVI (Class Vitality Index)

### Test 7A: Calculate CVI

**Setup 5 Students with varying SHS:**
```
Student 1: SHS = 85
Student 2: SHS = 78
Student 3: SHS = 72
Student 4: SHS = 68
Student 5: SHS = 90

Class Avg SHS = (85+78+72+68+90) / 5 = 78.6
Std Dev = 8.76
Learning Velocity (30-day improvement): 45.3
First Attempt Success: 4/5 = 80%
```

**Test API:**
```bash
curl "http://localhost:8000/api/managers/analytics/classes?school_id={SCHOOL_ID}" \
  -H "Authorization: Bearer {TOKEN}"

# Expected for Class 5-A:
{
  "class_id": "{CLASS_ID}",
  "class_name": "Class 5-A (Test)",
  "cvi_score": 70.46,
  "teacher_grade": "Satisfactory",
  "class_avg_shs": 78.6,
  "struggling_students": 0,
  "excelling_students": 2
}
```

**Verify Manager Dashboard:**
1. Navigate: `/manager/dashboard`
2. Find "Class Vitality Index" section
3. Verify Class 5-A shows CVI = 70.46 (Amber badge)

---

## 🧪 Part 8: SPI (School Performance Index)

### Test 8A: Calculate SPI

**Setup School Data:**
- Total students: 100
- Avg SHS: 72
- Top performers (≥80): 25 students = 25%
- At-risk (<50): 20 students = 20%
- Avg teacher CVI: 75
- Excellent teachers (≥85): 2/5 = 40%
- Underperforming (<60): 1/5 = 20%
- Avg attendance: 88%
- Homework submission: 82%
- Month-over-month improvement: +7.14%

**Test API:**
```bash
curl "http://localhost:8000/api/managers/analytics/school?school_id={SCHOOL_ID}" \
  -H "Authorization: Bearer {TOKEN}"

# Expected:
{
  "spi_score": 67.36,
  "rating": "Satisfactory",
  "avg_shs": 72,
  "avg_cvi": 75,
  "top_performers_pct": 25,
  "at_risk_pct": 20,
  "excellent_teachers_pct": 40,
  "avg_attendance": 88,
  "homework_submission_rate": 82
}
```

**Verify Manager Dashboard:**
1. Navigate: `/manager/spi-report`
2. Verify School SPI = 67.36 with "Satisfactory" rating (Amber)

---

## 🧪 Part 9: AI Predictions

### Test 9A: Trigger AI Analysis

**Setup:**
1. Ensure student has 30 days of performance data
2. Set `ANTHROPIC_API_KEY` in `.env`

**Manual Trigger:**
```bash
# Option 1: Call endpoint
curl -X POST http://localhost:8000/api/cron/run-ai-analysis \
  -H "Authorization: Bearer {TOKEN}"

# Option 2: Wait for automatic run
# Runs every Monday 06:00 UTC
```

**Query Prediction:**
```bash
curl "http://localhost:8000/api/metrics/student/{STUDENT_ID}/ai-prediction?class_id={CLASS_ID}" \
  -H "Authorization: Bearer {TOKEN}"

# Expected response:
{
  "exam_readiness": 78,
  "exam_readiness_confidence": 92,
  "dropout_risk": "low",
  "dropout_risk_confidence": 88,
  "topics_needing_help": ["Quadratic Equations", "Graphs"],
  "learning_style": "visual",
  "strengths": ["Strong algebra", "Active learner"],
  "weaknesses": ["Conceptual gaps", "Word problems"],
  "recommended_interventions": [
    "Watch Khan Academy...",
    "Practice 10 problems...",
    "Schedule tutoring..."
  ],
  "expected_next_week_shs": 80,
  "key_insight": "Student has good fundamentals..."
}
```

**Verify Parent Report:**
1. Navigate: `/student/report/{STUDENT_ID}`
2. Verify all 7 predictions display
3. Verify confidence scores show
4. Verify recommendations are specific

---

## 🧪 Part 10: Dashboard Tests

### Test 10A: StudentList Table

**Navigate:** `/teacher/classes/{CLASS_ID}`

**Verify All Columns:**
- ✅ Student Name + Email
- ✅ Video % with progress bar
- ✅ Attendance % with progress bar
- ✅ Homework % 
- ✅ Overall Score (color-coded badge)
- ✅ Rank (1st, 2nd, etc.)
- ✅ Password reset button

**Test Interactions:**
1. Click student row → Opens StudentDetail
2. Click password reset → Confirmation message
3. Sort by "Overall Score" → Re-sorts list
4. Click badge color → Should show risk explanation

---

### Test 10B: StudentDetail Page

**Navigate:** `/teacher/classes/{CLASS_ID}/student/{STUDENT_ID}`

**Verify Sections:**
- ✅ Student Info (name, email, class)
- ✅ SHS Score with color badge + trend
- ✅ Video section (lectures, focus score, watch time)
- ✅ Homework section (submitted, graded, retakes)
- ✅ Attendance section (present, absent days)
- ✅ Consistency score breakdown
- ✅ Behavioral score breakdown
- ✅ Alerts section (if any)

**Test Interaction:**
1. All numbers should match StudentList
2. All colors should match SHS risk level
3. Click on "View History" → Shows 30-day trend

---

### Test 10C: Daily Dashboard

**Navigate:** `/teacher/daily-dashboard/{CLASS_ID}`

**Verify Sections:**
- ✅ Class Health Score (e.g., 72/100)
- ✅ Momentum indicator (↑ +5% or ↓ -5%)
- ✅ Total students count
- ✅ 🔴 URGENT section (critical students)
- ✅ 🟡 WATCH LIST section (at-risk students)
- ✅ 🟢 PERFORMING WELL section (stable/excelling)
- ✅ Performance distribution bars
- ✅ Alerts list (sorted by severity)
- ✅ Recommendations section

**Test Interactions:**
1. Click student name → Opens StudentDetail
2. Class Health = Average of all students' SHS
3. Totals add up: URGENT + WATCH LIST + GOOD = Total students
4. Colors match risk levels

---

### Test 10D: Parent Report

**Navigate:** `/student/report/{STUDENT_ID}`

**Verify Sections:**
- ✅ Current Status (SHS + averages)
- ✅ 30-day trend charts (SHS line + component breakdown)
- ✅ Exam readiness with confidence
- ✅ Topics needing help
- ✅ Strengths
- ✅ Recommended actions (5 items)
- ✅ Dropout risk assessment
- ✅ Learning style
- ✅ Parent note

**Test Interactions:**
1. Charts should be interactive (hover shows values)
2. All recommendations should be specific
3. All predictions should have confidence scores
4. Sharing link works (test with another account)

---

## 📊 Part 11: Database Verification

### Test 11A: Table Structure

```bash
# Connect to DB
psql -U postgres -d smartschool

# Check tables exist
\dt daily_student_metrics
\dt student_health_scores
\dt class_vitality_index
\dt school_performance_index
\dt ai_performance_insights
\dt performance_alerts
\dt video_focus_metrics
\dt student_session_logs
```

### Test 11B: Data Integrity

```sql
-- Check latest daily metrics
SELECT student_id, date, daily_shs, risk_level FROM daily_student_metrics 
ORDER BY date DESC, student_id LIMIT 20;

-- Check health scores updated
SELECT student_id, current_shs, weekly_shs, momentum FROM student_health_scores 
WHERE current_shs IS NOT NULL;

-- Check CVI calculations
SELECT class_id, date, cvi_score, teacher_grade FROM class_vitality_index
ORDER BY date DESC LIMIT 10;

-- Check alerts generated
SELECT alert_type, severity, COUNT(*) FROM performance_alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY alert_type, severity;

-- Check AI insights stored
SELECT entity_type, COUNT(*) FROM ai_performance_insights
GROUP BY entity_type;
```

---

## ✅ Final Checklist

### All Tests Completed? Mark Here:

```
🧪 PART 1: SHS Calculation
  ☐ Test 1A: Excelling student (82/100)
  ☐ Test 1B: Critical student (34/100)
  ☐ Test 1C: At-risk student (54/100)
  ☐ Verify StudentList displays correctly
  ☐ Verify StudentDetail shows all components
  ☐ Verify colors match risk levels

🧪 PART 2: Momentum Score
  ☐ Test 2A: Positive momentum (+10.29%)
  ☐ Test 2B: Negative momentum (-30.56%)
  ☐ Verify alert triggers when < -15%

🧪 PART 3: Video Engagement
  ☐ Test 3A: Track focus metrics
  ☐ Verify pauseCount, rewindCount, focus_score
  ☐ Verify completion rate calculation

🧪 PART 4: Homework Grading
  ☐ Test 4A: Submit homework as student
  ☐ Test 4B: Grade as teacher
  ☐ Verify percentage calculation
  ☐ Verify StudentList shows correct %

🧪 PART 5: Attendance
  ☐ Test 5A: Mark attendance for 10 days
  ☐ Test 5B: Calculate percentage (80%)
  ☐ Verify alert triggers when < 60%

🧪 PART 6: Alerts
  ☐ Test all 7 alert types
  ☐ Verify severity levels
  ☐ Verify alerts appear in dashboard

🧪 PART 7: CVI
  ☐ Test CVI calculation
  ☐ Verify class average
  ☐ Verify teacher grade assignment
  ☐ Verify Manager Dashboard displays

🧪 PART 8: SPI
  ☐ Test SPI calculation
  ☐ Verify school rating
  ☐ Verify SPI Report page

🧪 PART 9: AI Predictions
  ☐ Trigger AI analysis
  ☐ Verify all 7 fields
  ☐ Verify Parent Report displays

🧪 PART 10: Dashboards
  ☐ Test StudentList table
  ☐ Test StudentDetail page
  ☐ Test Daily Dashboard
  ☐ Test Parent Report

🧪 PART 11: Database
  ☐ Verify all tables created
  ☐ Verify data integrity
  ☐ Verify indexes working
```

---

## 🎯 Expected Test Results

If all tests pass, you should see:

✅ **SHS:** 0-100 score with 4 components (Video, Homework, Consistency, Behavioral)
✅ **Momentum:** Week-over-week % change with alerts
✅ **Video Metrics:** Focus score 0-100 with pause/rewind/drop tracking
✅ **Homework:** % based on marks or submissions
✅ **Attendance:** % present / total days
✅ **Alerts:** 7 types triggered correctly
✅ **CVI:** Class average 0-100 with teacher grade
✅ **SPI:** School average 0-100 with rating
✅ **AI:** 7 predictions with confidence scores
✅ **Dashboards:** All sections displaying correctly
✅ **Database:** All tables with data

**Ready to Start?**

Pick one part above and run the tests! Start with Part 1 (SHS) as it's the foundation.

Need help? Tag me with which test you're running.
