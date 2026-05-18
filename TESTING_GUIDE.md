# 🧪 Complete Testing Guide - Smart School Analytics System

---

## Part 1️⃣: STUDENT HEALTH SCORE (SHS) - Individual Level

### 📊 SHS Calculation Formula

```
SHS = (Video_Engagement × 0.25) + (Homework_Comprehension × 0.40) + (Consistency × 0.20) + (Behavioral_Health × 0.15)
```

**Sub-Score Calculations:**

1. **Video Engagement (0-100)**
   - video_completion_rate: % of video watched (0-100)
   - Example: Student watched 85% of lecture → 85

2. **Homework Comprehension (0-100)**
   - marks_awarded / total_marks × 100
   - Example: Student got 16/20 marks → 80%

3. **Consistency (0-100)**
   - = (Attendance_Rate + Homework_Submission_Rate) / 2
   - Example: 90% attendance + 85% submission = (90+85)/2 = 87.5

4. **Behavioral Health (0-100)**
   - Retakes Score: 100 - (avg_attempts × 15)
   - Revisits Score: min(100, avg_revisits × 40)
   - Duration Score: min(100, (minutes / 300) × 100)
   - Final: Average of all three
   - Example: Retakes=80, Revisits=60, Duration=90 → (80+60+90)/3 = 76.67

### 📍 Where SHS is Displayed

| Location | Component | Shows |
|----------|-----------|-------|
| `/teacher/classes/{classId}` | **StudentList Table** | Overall SHS with risk badge + ranking |
| `/teacher/classes/{classId}/student/{studentId}` | **StudentDetail Card** | Current SHS, Weekly, Monthly + components |
| `/student/dashboard` | **SHS Health Card** | Current score + trend indicator |
| `/student/report/{studentId}` | **Parent Report** | Current SHS + 7/30-day avg + risk level |
| `/teacher/daily-dashboard/{classId}` | **Segmented List** | 🔴 URGENT (critical) / 🟡 WATCH LIST (at-risk) / 🟢 GOOD |

### 🧪 Test Case 1: Calculate SHS for Single Student

**Test Data:**
```json
{
  "student_id": "student-123",
  "class_id": "class-5a",
  "video_completion_rate": 85,
  "homework_rate": 80,
  "attendance_rate": 90,
  "homework_submission_rate": 85,
  "homework_retakes_avg": 1.2,
  "topic_revisits_avg": 1.5,
  "study_duration_minutes": 250
}
```

**Expected Calculation:**
```
Video Engagement = 85

Homework Comprehension = 80

Consistency = (90 + 85) / 2 = 87.5

Behavioral Health:
  - Retakes Score = 100 - (1.2 × 15) = 82
  - Revisits Score = min(100, 1.5 × 40) = 60
  - Duration Score = min(100, (250/300) × 100) = 83.33
  - Behavioral = (82 + 60 + 83.33) / 3 = 75.11

SHS = (85 × 0.25) + (80 × 0.40) + (87.5 × 0.20) + (75.11 × 0.15)
    = 21.25 + 32 + 17.5 + 11.27
    = 82.02

Risk Level: "Excelling" (SHS ≥ 80) ✅ BLUE badge
```

**Test Steps:**
1. Open DB, manually insert test data into video_focus_metrics, attendance, homework_submissions
2. Call: `GET /api/teachers/students/student-123/performance?class_id=class-5a`
3. Verify response contains:
   - ✅ `shs: 82.02`
   - ✅ `risk_level: "excelling"`
   - ✅ `video: { rate: 85, ... }`
   - ✅ `homework: { rate: 80, ... }`
   - ✅ `consistency: { rate: 87.5, ... }`
   - ✅ `behavioral: { rate: 75.11, ... }`

**Frontend Verification:**
- Navigate to `/teacher/classes/class-5a/student/student-123`
- Verify StudentDetail page shows all components
- Verify color badge is BLUE (excelling)

---

### 🧪 Test Case 2: Critical Student (SHS < 40)

**Test Data:**
```json
{
  "student_id": "student-456",
  "video_completion_rate": 20,
  "homework_rate": 35,
  "attendance_rate": 55,
  "homework_submission_rate": 40,
  "homework_retakes_avg": 3.0,
  "topic_revisits_avg": 0.5,
  "study_duration_minutes": 80
}
```

**Expected Calculation:**
```
Video Engagement = 20

Homework Comprehension = 35

Consistency = (55 + 40) / 2 = 47.5

Behavioral Health:
  - Retakes Score = 100 - (3.0 × 15) = 55
  - Revisits Score = min(100, 0.5 × 40) = 20
  - Duration Score = min(100, (80/300) × 100) = 26.67
  - Behavioral = (55 + 20 + 26.67) / 3 = 33.89

SHS = (20 × 0.25) + (35 × 0.40) + (47.5 × 0.20) + (33.89 × 0.15)
    = 5 + 14 + 9.5 + 5.08
    = 33.58

Risk Level: "critical" (SHS < 40) ✅ RED badge
```

**Test Steps:**
1. Create test student with poor metrics
2. Open `/teacher/daily-dashboard/class-5a`
3. Verify student appears in **🔴 URGENT** section (not WATCH LIST)
4. Click on student name
5. Verify StudentDetail shows RED badge
6. Verify alerts section shows:
   - "Video engagement very low (20%)"
   - "Homework performance below 50%"
   - "Attendance critical (55%)"

---

### 🧪 Test Case 3: At-Risk Student (40 ≤ SHS < 60)

**Test Data:**
```json
{
  "video_completion_rate": 60,
  "homework_rate": 50,
  "attendance_rate": 70,
  "homework_submission_rate": 55,
  "homework_retakes_avg": 2.0,
  "topic_revisits_avg": 0.8,
  "study_duration_minutes": 150
}
```

**Expected Result: SHS ≈ 54.5** (At-Risk) → **AMBER badge**
- Appears in **🟡 WATCH LIST** section on daily dashboard
- Flagged for monitoring but not immediate intervention

---

## Part 2️⃣: MOMENTUM SCORE - Trending

### 📊 Momentum Calculation Formula

```
Momentum = ((Current_Week_SHS - Previous_Week_SHS) / Previous_Week_SHS) × 100
```

### 🧪 Test Case: Calculate Momentum

**Test Data:**
```json
{
  "current_week_shs": 75,
  "previous_week_shs": 68
}
```

**Expected Calculation:**
```
Momentum = ((75 - 68) / 68) × 100
        = (7 / 68) × 100
        = 10.29%

Interpretation: Student improving ↑
Alert Trigger: None (positive momentum)
```

**Test Data 2 (Negative Momentum):**
```json
{
  "current_week_shs": 50,
  "previous_week_shs": 72
}
```

**Expected Calculation:**
```
Momentum = ((50 - 72) / 72) × 100
        = (-22 / 72) × 100
        = -30.56%

Interpretation: Student declining ↓↓ CRITICAL
Alert Trigger: "Rapid decline - immediate intervention needed" ✅ ALERT
```

### 📍 Where Momentum is Displayed

| Location | Shows |
|----------|-------|
| StudentDetail Card | ↑ +10.29% or ↓ -30.56% |
| Daily Dashboard | Overall class momentum |
| Trend Charts | 30-day trend line with momentum indicator |

---

## Part 3️⃣: VIDEO ENGAGEMENT METRICS

### 📊 Video Metrics Tracked

```
Video Engagement = Completion Rate

Components Stored in video_focus_metrics:
- pauseCount: How many times student paused
- rewindCount: How many times student rewound
- dropsCount: Times student left before 95% complete
- totalWatchSeconds: Total time video was playing
- avgWatchSpeed: Playback speed (1.0x = normal)

Focus Score = 100 - (pauses × 5) - (rewinds × 10) - (drops × 20)
            (Clamped to 0-100)
```

### 🧪 Test Case: Video Focus Metrics

**Test Scenario: Student watching 10-minute (600s) lecture**

**Actions Taken:**
```
1. Student starts video (plays for 100s) → paused
2. Student resumes (plays for 150s) → paused
3. Student goes back 2 mins (rewind detected)
4. Student continues (plays remaining 350s until end)

Final: pauseCount = 2, rewindCount = 1, totalWatchSeconds = 600
```

**Expected Calculation:**
```
Focus Score = 100 - (2 × 5) - (1 × 10) - (0 × 20)
           = 100 - 10 - 10 - 0
           = 80 ✅ Good focus

Completion Rate = 100% (watched entire video)
```

**Test Steps:**

1. **Setup Video in Database:**
   ```sql
   INSERT INTO library_topics (id, title, chapter_id) 
   VALUES ('topic-123', 'Photosynthesis', 'chapter-1');
   ```

2. **Start Video and Track Events:**
   - Open `/student/learn/topic/topic-123`
   - Click Play → `watchStartTime = now()`
   - Wait 100s → Click Pause → `pauseCount += 1`
   - Click Resume → `watchStartTime = now()`
   - Wait 150s → Click Pause → `pauseCount += 1`
   - Rewind 2 mins → `rewindCount += 1` (detected on next onTimeUpdate)
   - Wait for rest of video → Video ends → Report 100%

3. **Verify Database:**
   ```sql
   SELECT * FROM video_focus_metrics 
   WHERE student_id = 'student-123' AND topic_id = 'topic-123';
   ```

   Expected result:
   ```
   | pause_count | rewind_count | drops_count | focus_score |
   |      2      |      1       |      0      |     80      |
   ```

4. **Verify Frontend:**
   - Open StudentDetail for this student
   - Navigate to "Video Performance" section
   - Verify it shows: "Focus Score: 80/100"

---

## Part 4️⃣: HOMEWORK SUBMISSION & GRADING

### 📊 Homework Score Calculation

```
Homework Rate = (Marks Earned / Total Marks) × 100

Formula:
- If marks_awarded IS NOT NULL: (marks_awarded / total_marks) × 100
- If submitted but not graded: 75 (placeholder)
- If not submitted: 0
```

### 🧪 Test Case: Homework Grading

**Test Data:**
```json
{
  "homework_id": "hw-101",
  "student_id": "student-123",
  "total_marks": 20,
  "actions": [
    {"attempt": 1, "submission_status": "submitted", "submitted_at": "2024-05-15 14:30"},
    {"attempt": 2, "submission_status": "submitted", "submitted_at": "2024-05-16 10:00"},
    {"attempt": 3, "submission_status": "submitted", "marks_awarded": 16, "graded_at": "2024-05-17 09:00"}
  ]
}
```

**Expected Calculation:**
```
For this homework:
- Attempts: 3 (avg 2.5 attempts)
- Final Grade: 16/20 = 80%

Homework Submission Rate (for class):
- Total published homeworks: 5
- Student submitted: 5
- Submission Rate: 5/5 = 100%

Homework Grade Rate (for class):
- Total published: 5
- Graded: 5
- Final Grade: (80 + 85 + 90 + 75 + 88) / 5 = 83.6%
```

**Test Steps:**

1. **Create Homework in UI:**
   - Navigate: `/teacher/classes/class-5a/homework/new`
   - Fill form:
     - Title: "Chapter 3 Practice Problems"
     - Total Marks: 20
     - Due Date: 2024-05-16
     - Status: "published"

2. **Student Submits (3 attempts):**
   - Student opens: `/student/homework/hw-101`
   - Submits attempt 1 → System records: `submission_status: "submitted"`
   - Teacher marks: Incomplete
   - Student submits attempt 2 → System records: `attempt_number: 2`
   - Teacher marks: Incomplete
   - Student submits attempt 3 → System records: `attempt_number: 3`

3. **Teacher Grades:**
   - Open: `/teacher/classes/class-5a/homework/hw-101/submissions`
   - Find student submission
   - Click "Grade" → Enter: marks_awarded = 16
   - System records: `marks_awarded: 16, graded_at: now()`

4. **Verify StudentList:**
   - Open: `/teacher/classes/class-5a`
   - Find student row
   - Verify: "Homework: 80%" (calculated from final attempt)

5. **Verify Database:**
   ```sql
   SELECT 
       COUNT(*) as total_attempts,
       AVG(marks_awarded) as avg_marks,
       (AVG(marks_awarded) / 20 * 100) as homework_rate
   FROM homework_submissions 
   WHERE homework_id = 'hw-101' AND student_id = 'student-123';
   ```

---

## Part 5️⃣: ATTENDANCE TRACKING

### 📊 Attendance Calculation

```
Attendance Rate = (Days Present / Total Days Recorded) × 100

Risk Triggers:
- < 60% in 2 weeks → Alert: "Chronic Absenteeism"
- < 75% overall → Warning in StudentDetail
```

### 🧪 Test Case: Attendance Tracking

**Test Data: Last 15 Days**
```
Day 1 (May 1):  ✅ Present
Day 2 (May 2):  ✅ Present
Day 3 (May 3):  ❌ Absent
Day 4 (May 4):  ✅ Present
Day 5 (May 5):  ✅ Present
Day 6 (May 6):  ✅ Present
Day 7 (May 7):  ❌ Absent
Day 8 (May 8):  ✅ Present
Day 9 (May 9):  ✅ Present
Day 10 (May 10): ✅ Present
Day 11 (May 11): ❌ Absent
Day 12 (May 12): ✅ Present
Day 13 (May 13): ✅ Present
Day 14 (May 14): ✅ Present
Day 15 (May 15): ✅ Present

Total Present: 12/15 = 80% ✅
```

**Test Steps:**

1. **Mark Attendance:**
   - Navigate: `/teacher/attendance`
   - Select class: "Class 5-A"
   - Select date: "May 1"
   - Check students as present/absent
   - Submit

2. **Repeat for 15 days**

3. **Verify in StudentList:**
   - Open: `/teacher/classes/class-5a`
   - Find student row
   - Verify: "Attendance %: 80%"

4. **Verify in StudentDetail:**
   - Click student name
   - Verify attendance card shows: "12/15 days"
   - Verify no warning (80% > 75%)

5. **Test Alert Trigger (< 60%):**
   - Mark student absent for 6 more days
   - New attendance: 12/21 = 57%
   - Verify alert appears: "Attendance critical (57%)"

---

## Part 6️⃣: ALERTS & EARLY WARNING SYSTEM

### 📊 Alert Types & Triggers

| Alert Type | Trigger | Severity | Action |
|-----------|---------|----------|--------|
| **Critical State** | SHS < 30 for 2 days | 🔴 CRITICAL | Contact parent immediately |
| **Chronic Absenteeism** | < 60% attendance in 2 weeks | 🟡 WARNING | Check for transport/health issues |
| **Behavioral Decline** | Behavioral score ↓10+ points week-over-week | 🟡 WARNING | Check external stressors |
| **Rapid Decline** | Momentum < -15% | 🔴 CRITICAL | Immediate intervention |
| **Consistent Underperformance** | SHS < 50 for 3+ days | 🔴 CRITICAL | Parent meeting |
| **Video Disengagement** | Video completion < 20% for 5 days | 🟡 WARNING | Encourage lecture review |
| **Homework Zero** | 0% submissions for 7 days | 🔴 CRITICAL | Check motivational barriers |

### 🧪 Test Case: Generate Alerts

**Test Scenario 1: Rapid Decline Alert**
```
Day 1 (Week 1): SHS = 78
Day 7 (Week 2): SHS = 62

Momentum = ((62 - 78) / 78) × 100 = -20.5%

Trigger: momentum < -15% ✅
Alert Generated: "Rapid decline - immediate intervention needed"
Severity: CRITICAL (🔴)
```

**Test Steps:**

1. **Create Student with Good then Bad Performance:**
   - Student 1: Initial SHS = 78

2. **Day 7 Update:**
   - Run cron: `POST /api/cron/calculate-daily-scores`
   - Insert poor metrics for Week 2
   - New SHS = 62

3. **Check Alerts:**
   - Query: `GET /api/metrics/class/class-5a/alerts`
   - Verify response contains:
     ```json
     {
       "alert_type": "rapid_decline",
       "severity": "critical",
       "message": "Momentum -20.5% — immediate intervention needed",
       "action_required": "Schedule 1-on-1 meeting with student"
     }
     ```

4. **Verify in Dashboard:**
   - Open: `/teacher/daily-dashboard/class-5a`
   - Find alert in "Critical Alerts" section
   - Verify message and action recommendation

**Test Scenario 2: Chronic Absenteeism Alert**
```
Last 14 days: 8/14 = 57% attendance
Trigger: < 60% ✅
Alert: "Chronic absenteeism - check for transport/health issues"
```

**Test Steps:**
1. Mark student absent 6 out of 14 days
2. Run daily metrics cron
3. Verify alert appears in daily dashboard

---

## Part 7️⃣: CLASS VITALITY INDEX (CVI) - Teacher Effectiveness

### 📊 CVI Calculation Formula

```
CVI = (Class_Avg_SHS × 0.35) + (Learning_Velocity × 0.25) + (Engagement_Variance_Score × 0.20) + (Content_Effectiveness × 0.20)

Where:
- Class_Avg_SHS = Average of all students' SHS
- Learning_Velocity = (Current_Avg - Baseline_Avg) / Days
- Engagement_Variance_Score = 100 - (std_dev / 40 × 100)
- Content_Effectiveness = % of students passing on first attempt

Teacher Grade:
- CVI ≥ 85: Excellent (Blue)
- CVI ≥ 75: Good (Green)
- CVI ≥ 60: Satisfactory (Amber)
- CVI < 60: Needs Improvement (Red)
```

### 🧪 Test Case: Calculate CVI

**Test Data: Class 5-A with 5 students**

```json
{
  "class_id": "class-5a",
  "students": [
    { "student_id": "s1", "shs": 85 },
    { "student_id": "s2", "shs": 78 },
    { "student_id": "s3", "shs": 72 },
    { "student_id": "s4", "shs": 68 },
    { "student_id": "s5", "shs": 90 }
  ],
  "baseline_avg_shs": 65,
  "current_avg_shs": 78.6,
  "days_elapsed": 30,
  "first_attempt_success": 4 // out of 5 students scored ≥70 on first quiz
}
```

**Expected Calculation:**

```
Step 1: Class Average SHS
Class_Avg_SHS = (85 + 78 + 72 + 68 + 90) / 5 = 78.6

Step 2: Learning Velocity
Learning_Velocity = (78.6 - 65) / 30 = 13.6 / 30 = 0.453
Normalize to 0-100: 0.453 × 100 = 45.3

Step 3: Engagement Variance
Std Dev of SHS = 8.76 (sample std dev)
Variance_Score = max(0, 100 - (8.76 / 40 × 100)) = 100 - 21.9 = 78.1

Step 4: Content Effectiveness
First_Attempt_Success = 4/5 = 80%

Step 5: CVI Calculation
CVI = (78.6 × 0.35) + (45.3 × 0.25) + (78.1 × 0.20) + (80 × 0.20)
    = 27.51 + 11.33 + 15.62 + 16
    = 70.46

Teacher Grade: "Satisfactory" (Amber) ✅
```

### 📍 Where CVI is Displayed

| Location | Shows |
|----------|-------|
| `/manager/dashboard` | Top & bottom performing classes |
| `/manager/class-reports` | CVI chart per class |
| Teacher individual report | Their own CVI score |

### 🧪 Test Case: Verify CVI Calculation

**Test Steps:**

1. **Create Test Data:**
   - Insert 5 students in class-5a
   - Each student gets different SHS
   - Insert historical SHS data (baseline 30 days ago)

2. **Run CVI Calculation:**
   - Call: `GET /api/managers/analytics/classes?school_id=school-1`
   - Or call: `GET /api/analytics/class/{class_id}`

3. **Verify Response:**
   ```json
   {
     "class_id": "class-5a",
     "cvi_score": 70.46,
     "teacher_grade": "Satisfactory",
     "class_avg_shs": 78.6,
     "learning_velocity": 45.3,
     "engagement_variance": 78.1,
     "content_effectiveness": 80,
     "struggling_students": 2,
     "excelling_students": 2,
     "recommendations": "Improve content clarity..."
   }
   ```

4. **Verify Manager Dashboard:**
   - Open: `/manager/dashboard`
   - Navigate to "Class Vitality" section
   - Find Class 5-A
   - Verify CVI = 70.46 with "Satisfactory" grade (Amber)
   - Verify it appears in middle section (not top/bottom)

---

## Part 8️⃣: SCHOOL PERFORMANCE INDEX (SPI) - Principal Effectiveness

### 📊 SPI Calculation Formula

```
SPI = (Academic_Excellence × 0.40) + (Teacher_Quality × 0.30) + (Operational_Efficiency × 0.20) + (Growth_Trajectory × 0.10)

Where:
- Academic_Excellence = (School_Avg_SHS × 0.50) + (Top_Performers_Pct × 0.30) + ((100 - At_Risk_Pct) × 0.20)
- Teacher_Quality = (School_Avg_CVI × 0.50) + (Excellent_Teachers_Pct × 0.30) + ((100 - Underperforming_Pct) × 0.20)
- Operational_Efficiency = (Avg_Attendance × 0.60) + (Homework_Submission_Rate × 0.40)
- Growth_Trajectory = Month-over-month improvement

School Rating:
- SPI ≥ 90: Outstanding (Gold)
- SPI ≥ 80: Excellent (Blue)
- SPI ≥ 70: Good (Green)
- SPI ≥ 60: Satisfactory (Amber)
- SPI < 60: Needs Improvement (Red)
```

### 🧪 Test Case: Calculate SPI

**Test Data: School with 100 students, 5 classes, 5 teachers**

```json
{
  "school_id": "school-1",
  "total_students": 100,
  "total_teachers": 5,
  
  "students": {
    "avg_shs": 72,
    "excelling_count": 25,  // SHS ≥ 80
    "at_risk_count": 20     // SHS < 50
  },
  
  "teachers": {
    "avg_cvi": 75,
    "excellent_count": 2,   // CVI ≥ 85
    "underperforming_count": 1  // CVI < 60
  },
  
  "operations": {
    "avg_attendance": 88,
    "homework_submission_rate": 82
  },
  
  "growth": {
    "prev_month_spi": 70,
    "current_month_spi": 75
  }
}
```

**Expected Calculation:**

```
Step 1: Academic Excellence
top_performers_pct = 25/100 × 100 = 25%
at_risk_pct = 20/100 × 100 = 20%

Academic_Excellence = (72 × 0.50) + (25 × 0.30) + ((100-20) × 0.20)
                    = 36 + 7.5 + 16
                    = 59.5

Step 2: Teacher Quality
excellent_teachers_pct = 2/5 × 100 = 40%
underperforming_pct = 1/5 × 100 = 20%

Teacher_Quality = (75 × 0.50) + (40 × 0.30) + ((100-20) × 0.20)
                = 37.5 + 12 + 16
                = 65.5

Step 3: Operational Efficiency
Operational_Efficiency = (88 × 0.60) + (82 × 0.40)
                       = 52.8 + 32.8
                       = 85.6

Step 4: Growth Trajectory
mom_improvement = ((75 - 70) / 70) × 100 = 7.14%
growth_score = min(max((7.14 + 20) / 40 × 100, 0), 100) = 67.85

Step 5: SPI Calculation
SPI = (59.5 × 0.40) + (65.5 × 0.30) + (85.6 × 0.20) + (67.85 × 0.10)
    = 23.8 + 19.65 + 17.12 + 6.785
    = 67.355

School Rating: "Satisfactory" (Amber) ✅
```

### 📍 Where SPI is Displayed

| Location | Shows |
|----------|-------|
| `/manager/dashboard` | Overall SPI with trend |
| `/manager/spi-report` | Detailed SPI breakdown |
| Principal analytics | School rating and metrics |

---

## Part 9️⃣: AI PREDICTIONS (Claude API)

### 📊 What AI Analyzes

```
Input: 30-day student performance data
Output: 7 predictions per student

Predictions Generated:
1. exam_readiness: 0-100 (prediction confidence: 0-100%)
2. dropout_risk: low|medium|high (confidence: 0-100%)
3. topics_needing_help: [list of 2-4 topics]
4. learning_style: visual|auditory|kinesthetic|mixed
5. strengths: [list of 2-3 areas of excellence]
6. weaknesses: [list of 2-3 areas for improvement]
7. recommended_interventions: [list of 3-5 specific actions]
```

### 📍 Where AI Predictions are Displayed

| Location | Shows |
|----------|-------|
| `/student/report/{studentId}` | All 7 predictions (parent view) |
| `/teacher/classes/{id}/student/{id}` | Exam readiness + interventions |
| `/manager/dashboard` | School-wide predictions summary |
| API: `GET /api/metrics/student/{id}/ai-prediction` | JSON response |

### 🧪 Test Case: AI Prediction Generation

**Test Data: 30-day history for student**

```json
{
  "student_id": "student-123",
  "past_30_days": {
    "video_engagement": [85, 80, 88, 75, 82, 90, 78, 88, 85, 82, 78, 81, 84, 87, 80],
    "quiz_scores": [70, 75, 80, 72, 78, 82, 77, 81, 79, 74],
    "homework_grades": [75, 78, 82, 80, 76, 79, 81, 83, 80, 77],
    "topics_viewed": ["Algebra", "Quadratic Equations", "Functions", "Graphs"],
    "questions_asked": ["Why does x² = 9 have 2 solutions?", "How to complete the square?"],
    "study_hours": [2.5, 2.0, 3.0, 1.5, 2.5, 2.0, 2.5, 3.0, 2.0, 2.5],
    "attendance": [1, 1, 1, 1, 1, 1, 0, 1, 1, 1]  // 9/10 present
  }
}
```

**Expected AI Response:**

```json
{
  "exam_readiness": 78,
  "exam_readiness_confidence": 92,
  "dropout_risk": "low",
  "dropout_risk_confidence": 88,
  "topics_needing_help": [
    "Quadratic Equations - inconsistent performance on parabola problems",
    "Graph Interpretation - mixed success on coordinate transformations"
  ],
  "learning_style": "visual",
  "strengths": [
    "Strong algebraic foundation - consistent 75%+ on linear equations",
    "High engagement - actively asks clarifying questions"
  ],
  "weaknesses": [
    "Struggles with conceptual understanding of quadratic roots",
    "Needs practice with word problems and real-world applications"
  ],
  "recommended_interventions": [
    "Watch Khan Academy 'Solving Quadratic Equations by Factoring' (10 min)",
    "Complete 10 practice problems on parabola vertex form",
    "Schedule 30-min 1-on-1 tutoring session on completing the square",
    "Review graphing transformation rules with flashcards",
    "Take practice quiz on quadratics before next exam"
  ],
  "expected_next_week_shs": 80,
  "key_insight": "Student has strong fundamentals but needs targeted practice on quadratic concepts before mid-term exam. Visual learning style suggests graphical approach would help."
}
```

### 🧪 Test Case: Trigger AI Analysis

**Test Steps:**

1. **Create Student with 30 Days of Data:**
   - Insert daily_student_metrics entries for last 30 days
   - Vary the scores to create realistic pattern

2. **Trigger Weekly AI Job (Manual for Testing):**
   ```bash
   curl -X POST http://localhost:8000/api/cron/run-ai-analysis
   ```
   
   Or wait for automatic run: Monday 06:00 UTC

3. **Query AI Predictions:**
   ```bash
   curl http://localhost:8000/api/metrics/student/student-123/ai-prediction?class_id=class-5a
   ```

4. **Verify Response:**
   - ✅ Contains all 7 fields
   - ✅ Confidence scores present and reasonable (70-95%)
   - ✅ Interventions are specific and actionable
   - ✅ Topics match what student struggled with

5. **Verify in Parent Report:**
   - Open: `/student/report/student-123`
   - Verify AI section shows:
     - Exam Readiness: 78% with confidence
     - Dropout Risk: Low ✅
     - Topics for review: Quadratic Equations, Graph Interpretation
     - Action items: 5 specific recommendations

---

## Part 🔟: DASHBOARDS & UI COMPONENTS

### 📍 Component 1: StudentList Table

**Location:** `/teacher/classes/{classId}`

**Columns Displayed:**
```
| Student Name | Video % | Attendance % | Homework % | Overall Score | Rank | Actions |
|---|---|---|---|---|---|---|
| Ahmed Hassan | 85% ▮▮▮▮▮ | 90% ▮▮▮▮▮ | 80% ▮▮▮▮ | 🔵 82 | 1 | 🔑 |
| Sara Ali | 72% ▮▮▮▮ | 78% ▮▮▮ | 75% ▮▮▮ | 🟢 75 | 3 | 🔑 |
| Ali Khan | 45% ▮▮ | 55% ▮ | 40% ▮ | 🔴 45 | 15 | 🔑 |
```

**Risk Color Coding:**
- 🔵 Blue: SHS ≥ 80 (Excelling)
- 🟢 Green: 60 ≤ SHS < 80 (Stable)
- 🟡 Amber: 40 ≤ SHS < 60 (At-Risk)
- 🔴 Red: SHS < 40 (Critical)

**Test Case:**

1. Navigate to `/teacher/classes/class-5a`
2. Verify table displays all students
3. Click on student row → Opens StudentDetail
4. Verify sorting by "Overall Score" shows highest to lowest
5. Verify risk colors match SHS values

---

### 📍 Component 2: StudentDetail Card

**Location:** `/teacher/classes/{classId}/student/{studentId}`

**Displays:**
```
┌─────────────────────────────────────────┐
│ Ahmed Hassan                            │
│ Class: 5-A | Email: ahmed@school.com   │
├─────────────────────────────────────────┤
│ SHS Score: 82 ↑ +8.5%                  │
│ 7-Day Avg: 79 | 30-Day Avg: 76         │
│ Risk Level: Excelling 🔵               │
│ Rank: 1st of 25 students               │
├─────────────────────────────────────────┤
│ Video Engagement: 85%                   │
│ ├─ Lectures watched: 17/20 (≥75%)      │
│ ├─ Focus score: 78/100                  │
│ └─ Total watch time: 450 minutes        │
│                                         │
│ Homework: 80/100                        │
│ ├─ Submitted: 8/10                      │
│ ├─ Graded: 8 assignments                │
│ ├─ Avg marks: 16/20                     │
│ └─ Retakes: 1.2 avg per homework        │
│                                         │
│ Attendance: 90%                         │
│ ├─ Present: 18/20 days                  │
│ └─ Absences: 2 days                     │
│                                         │
│ Consistency Score: 87.5/100              │
│ ├─ Submission rate: 85%                 │
│ └─ Study sessions: 20 (avg 22.5 min)    │
│                                         │
│ Behavioral Score: 75/100                │
│ ├─ Topic revisits: 1.5 avg              │
│ ├─ Homework retakes: 1.2 avg            │
│ └─ Study duration: 250 minutes total     │
└─────────────────────────────────────────┘
```

**Test Case:**

1. Navigate to `/teacher/classes/class-5a/student/student-123`
2. Verify all components display correctly
3. Verify calculations match StudentList values
4. Verify color badge matches risk level
5. Click on each metric section to expand/collapse

---

### 📍 Component 3: Daily Dashboard

**Location:** `/teacher/daily-dashboard/{classId}`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ CLASS 5-A · Daily Dashboard                      │
│ Friday, May 18, 2026                             │
├──────────────────────────────────────────────────┤
│ Class Health: 72/100  ↓ -5%  (Yesterday: 77)    │
│ Total Students: 25                               │
├──────────────────────────────────────────────────┤
│                                                  │
│ 🔴 URGENT (3 students) - Immediate Action       │
│ ├─ Ahmed: SHS 35 ⚠️ Missed 4 consecutive videos│
│ ├─ Sara: SHS 38 ⚠️ Quiz: 25%                   │
│ └─ Ali: SHS 30 ⚠️ Zero homework this week      │
│                                                  │
│ 🟡 WATCH LIST (7 students) - Monitor Closely    │
│ ├─ Fatima: SHS 52 (↓8% this week)              │
│ ├─ Hassan: SHS 48 (Attendance: 55%)            │
│ └─ ... 5 more students                          │
│                                                  │
│ 🟢 PERFORMING WELL (15 students) - On Track     │
│ ├─ Mariam: SHS 92 (Top performer)              │
│ ├─ Omar: SHS 88                                 │
│ └─ ... 13 more students                         │
│                                                  │
│ 📊 Performance Distribution                      │
│ Critical (0-40):   ▓▓ 2         8%              │
│ At-Risk (40-60):   ▓▓▓▓ 5      20%              │
│ Stable (60-80):    ▓▓▓▓▓▓ 10   40%              │
│ Excelling (80+):   ▓▓▓ 8       32%              │
│                                                  │
│ 📋 Today's Alerts (5)                           │
│ 1. [CRITICAL] Ahmed - Rapid Decline (-25%)     │
│ 2. [WARNING] Fatima - Attendance Alert (55%)   │
│ 3. [WARNING] Hassan - Homework Alert           │
│ 4. [INFO] Class avg video: 68%                 │
│ 5. [INFO] New student enrolled: Zainab         │
│                                                  │
│ 💡 Recommendations                              │
│ 1. Immediate: Schedule 1-on-1 with critical   │
│    students within 24 hours                     │
│ 2. Monitor: Check in with watch-list students │
│    this week                                    │
│ 3. Celebrate: 8 students excelling - consider │
│    peer mentoring opportunity                   │
└──────────────────────────────────────────────────┘
```

**Test Case:**

1. Navigate to `/teacher/daily-dashboard/class-5a`
2. Verify all 3 segments load: URGENT, WATCH LIST, GOOD
3. Verify totals add up: 2 + 5 + 18 = 25 ✅
4. Verify class health = average of all student SHS
5. Verify momentum = current vs yesterday
6. Click on student name → Should navigate to StudentDetail
7. Verify alerts section shows all critical items
8. Verify recommendations are actionable

---

### 📍 Component 4: Parent Student Report

**Location:** `/student/report/{studentId}`

**Displays:**
```
┌──────────────────────────────────────────────────┐
│ Student Academic Report                          │
│ Ahmed Hassan                                     │
│ Class: 5-A | Generated: May 18, 2026            │
├──────────────────────────────────────────────────┤
│                                                  │
│ 📊 CURRENT STATUS                               │
│ Overall Score: 82/100 🔵 EXCELLING              │
│ 7-Day Average: 79                               │
│ 30-Day Average: 76                              │
│ Trend: ↑ +8.5% (improving)                      │
│                                                  │
│ 📈 30-DAY TREND CHARTS                          │
│ [Line Chart - SHS daily values]                 │
│ [Stacked Area - Video/Homework/etc]             │
│                                                  │
│ 📚 EXAM READINESS                               │
│ Prediction: 78/100                              │
│ Confidence: 92%                                 │
│ Status: Preparing Well 📖                       │
│ Expected Score on Midterm: 75-82                │
│                                                  │
│ ⚠️ TOPICS NEEDING REVIEW                        │
│ • Quadratic Equations (60% mastery)             │
│ • Graph Transformations (65% mastery)           │
│ Recommendation: Extra practice on parabolas     │
│                                                  │
│ ✨ STRENGTHS & TALENTS                          │
│ ✓ Strong algebraic foundation (85% avg)         │
│ ✓ Active learner - asks good questions          │
│ ✓ Consistent homework submission (100%)         │
│                                                  │
│ ✅ RECOMMENDED ACTIONS                          │
│ □ Watch Khan Academy "Solving Quadratics" (10m)│
│ □ Practice 10 problems on vertex form daily     │
│ □ Schedule 30-min tutoring on completing square│
│ □ Review transformation rules with flashcards   │
│ □ Take practice exam before midterm             │
│                                                  │
│ 📊 DROPOUT RISK ASSESSMENT                      │
│ Risk Level: LOW ✅ (Student highly engaged)     │
│ Engagement: 85% video + 80% homework + 90% att. │
│ Confidence: 88%                                 │
│                                                  │
│ 🎓 LEARNING STYLE DETECTED                      │
│ Visual Learner - Benefits from diagrams, charts │
│ Suggestion: Use GeoGebra for graphing practice  │
│                                                  │
│ 📝 Note for Parents:                            │
│ This report is auto-generated daily using AI    │
│ analysis of Ahmed's 30-day performance data.    │
│ He's performing well overall and on track for   │
│ midterm success. The recommended actions are    │
│ specific to his learning style and weak areas.  │
│ Share this report with Ahmed for motivation!    │
└──────────────────────────────────────────────────┘
```

**Test Case:**

1. Navigate to `/student/report/student-123`
2. Verify all sections load
3. Verify SHS matches StudentDetail
4. Verify trend charts display correctly
5. Verify AI predictions appear with confidence scores
6. Verify recommendations are specific
7. Share link with parent via email/portal

---

## Part 🔞: DATABASE VERIFICATION

### 🧪 Test Case: Verify Database Tables

**Test Steps:**

1. **Check Table Existence:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

   Expected tables:
   - ✅ daily_student_metrics
   - ✅ student_health_scores
   - ✅ class_vitality_index
   - ✅ school_performance_index
   - ✅ ai_performance_insights
   - ✅ performance_alerts
   - ✅ video_focus_metrics
   - ✅ student_session_logs

2. **Check daily_student_metrics Structure:**
   ```sql
   \d daily_student_metrics
   ```

   Expected columns:
   - ✅ id, student_id, class_id, date
   - ✅ video_completion_rate, focus_score, drops_count
   - ✅ homework_submission_rate, attendance_rate
   - ✅ consistency_score, behavioral_score
   - ✅ daily_shs, risk_level
   - ✅ created_at, updated_at

3. **Check Data Insertion:**
   ```sql
   SELECT COUNT(*) FROM daily_student_metrics WHERE date = CURRENT_DATE;
   ```

   Should return: > 0 (if cron ran today)

4. **Check Indexes:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'daily_student_metrics';
   ```

   Expected:
   - ✅ idx_daily_metrics_student_date
   - ✅ idx_daily_metrics_class_date

---

## Summary: Complete Testing Checklist

```
✅ PART 1: SHS Calculation
  ✅ Test case 1: Excelling student (82/100)
  ✅ Test case 2: Critical student (33/100)
  ✅ Test case 3: At-risk student (54/100)
  ✅ Verify StudentList displays with colors
  ✅ Verify StudentDetail shows components

✅ PART 2: Momentum Score
  ✅ Positive momentum: +10.29%
  ✅ Negative momentum: -30.56%
  ✅ Alert trigger: < -15%

✅ PART 3: Video Engagement
  ✅ Focus score calculation
  ✅ Progress tracking (pauseCount, rewindCount)
  ✅ Completion rate

✅ PART 4: Homework Grading
  ✅ Marks-based grading
  ✅ Retake handling
  ✅ Submission rate calculation

✅ PART 5: Attendance
  ✅ Track present/absent
  ✅ Calculate percentage
  ✅ Alert trigger: < 60% in 2 weeks

✅ PART 6: Alerts
  ✅ All 7 alert types trigger correctly
  ✅ Alert severity levels
  ✅ Alert resolution

✅ PART 7: CVI (Teacher Effectiveness)
  ✅ Calculate class average
  ✅ Calculate learning velocity
  ✅ Calculate engagement variance
  ✅ Assign teacher grade

✅ PART 8: SPI (School Effectiveness)
  ✅ Calculate academic excellence
  ✅ Calculate teacher quality
  ✅ Calculate operational efficiency
  ✅ Calculate growth trajectory
  ✅ Assign school rating

✅ PART 9: AI Predictions
  ✅ Generate predictions weekly
  ✅ All 7 fields present
  ✅ Confidence scores reasonable

✅ PART 10: Dashboards
  ✅ StudentList table displays
  ✅ StudentDetail card loads
  ✅ Daily Dashboard segments correctly
  ✅ Parent Report shows all sections
  ✅ Trend charts display

✅ PART 11: Database
  ✅ All tables created
  ✅ Correct column structure
  ✅ Indexes created
  ✅ Data persists
```

---

## Next: Run Tests!

Ready to run all tests? Start with:

1. **Setup test data** (30 days of student activity)
2. **Run cron jobs** manually
3. **Open dashboards** and verify displays
4. **Check database** for correct values
5. **Review API responses** for correctness

Need help with any specific test?
