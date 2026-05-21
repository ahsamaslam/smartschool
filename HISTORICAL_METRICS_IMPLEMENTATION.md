# Historical Metrics Implementation Guide

## Overview

The Smart School platform now includes a complete historical metrics and snapshot system for tracking student performance over time. This document explains the logic, architecture, and implementation of each feature.

---

## Architecture

### Three-Tier Data Flow

```
Real-Time Events → Daily Snapshots → Rolling Averages → Alerts & Trends
   (Video views)    (Cron job @00:00)  (7/30-day avg)   (Teacher dashboard)
```

---

## 1️⃣ Daily Snapshots (Midnight Cron Job)

### Logic
Every night at 00:00 UTC, a scheduled cron job captures a complete snapshot of each student's performance for that day.

**File**: `backend/app/utils/historical_metrics.py` → `run_daily_metrics_job()`

### What Gets Captured

For each student enrolled in a class:

| Metric | Source | Calculation |
|--------|--------|-------------|
| **Video Completion Rate** | `student_topic_progress` | % of lectures watched ≥75% today |
| **Homework Submission Rate** | `homeworks` / `homework_submissions` | % of assigned homework submitted/graded |
| **Attendance Rate** | `attendance` | 100 if present today, 0 if absent |
| **Homework Retakes Avg** | `homework_submissions.attempt_number` | Average # of attempts per homework |
| **Topic Revisits Avg** | `student_topic_progress.revisit_count` | Average # of times student revisited topic |
| **Study Duration** | `student_session_logs` | Total active minutes today |
| **Daily SHS** | All above + formula | `Video*0.25 + Homework*0.40 + Consistency*0.20 + Behavioral*0.15` |
| **Risk Level** | Daily SHS | Critical(<40), At-Risk(40-59), Stable(60-79), Excelling(≥80) |

### Database Storage

```sql
daily_student_metrics (
  id, student_id, class_id, date,
  video_completion_rate,
  homework_submission_rate,
  attendance_rate,
  homework_retakes_avg,
  topic_revisits_avg,
  study_duration_minutes,
  daily_shs,
  risk_level,
  consistency_score,
  behavioral_score,
  created_at, updated_at
)
```

### Example Flow

```
Day 1 (Student A, Class 1):
├─ Video: Watched 2 of 3 lectures = 66.7%
├─ Homework: Submitted 2/2, 1 graded (15/20), 1 ungraded (75% assumed) = 87.5%
├─ Attendance: Present = 100%
├─ Retakes: 1.0 (only 1 homework, 1 attempt)
├─ Revisits: 0 (no revisits)
├─ Study: 45 minutes
├─ SHS = 66.7*0.25 + 87.5*0.40 + (100+87.5)/2*0.20 + behavioral*0.15
│      = 16.7 + 35.0 + 18.75 + behavioral*0.15 ≈ 75-80 (Stable)
└─ Stored in daily_student_metrics with date=today, shs=78.5, risk_level='stable'
```

---

## 2️⃣ Rolling Averages & Momentum Score

### Logic
After daily snapshots are captured, rolling averages are calculated for trend analysis.

**File**: `backend/app/utils/historical_metrics.py` → `calculate_rolling_averages()`

### Three Time Windows

| Window | Days | Purpose |
|--------|------|---------|
| **Weekly** | Last 7 days | Smooth short-term fluctuations |
| **Monthly** | Last 30 days | Show sustained performance |
| **Momentum** | Week-over-week | Detect trends (↑ improving, ↓ declining) |

### Momentum Calculation

```python
current_week_avg = average(last_7_days_SHS)
previous_week_avg = average(SHS from 7-14 days ago)
momentum = (current_week_avg - previous_week_avg) / previous_week_avg * 100
```

**Examples:**
- If student improves from 50 SHS to 60 SHS: momentum = +20%
- If student drops from 70 SHS to 58 SHS: momentum = -17.1% → **ALERT!**

### Database Storage

```sql
student_health_scores (
  student_id, class_id,
  current_shs,    -- Today's snapshot
  weekly_shs,     -- 7-day average
  monthly_shs,    -- 30-day average
  momentum,       -- % change week-over-week
  risk_level,     -- Based on current_shs
  last_updated
)
```

---

## 3️⃣ Video Focus Metrics

### Logic
Track student engagement quality while watching videos. Captures:
- How many times student paused (suggests concentration loss)
- How many times student rewound (suggests confusion)
- How many times student abandoned video (drops)
- Total active watching time vs video duration
- Playback speed used

### Tracking Implementation

**File**: `frontend/src/pages/shared/TopicLecturePlayer.jsx`

The video player tracks:

```javascript
focusMetricsRef = {
  pauseCount: 0,           // Incremented on video pause
  rewindCount: 0,          // Incremented when position goes backward >0.5s
  dropsCount: 0,           // Incremented if video <95% watched at unmount
  totalWatchSeconds: 0,    // Cumulative time spent watching
  lastPosition: 0,         // Previous position to detect rewind
  watchStartTime: null     // When play started
}
```

**Events Tracked:**

| Event | Logic |
|-------|-------|
| **onPlay** | Set `watchStartTime = now()` |
| **onPause** | `pauseCount++`, add elapsed time to `totalWatchSeconds` |
| **onTimeUpdate** | If `position < lastPosition - 0.5s`, then `rewindCount++` |
| **onEnded** | Add final watch duration, report 100% |
| **onUnmount** | If watch% < 95%, increment `dropsCount` |

### Focus Score Calculation

```python
focus_score = 100 - (pauseCount * 5) - (rewindCount * 10) - (dropsCount * 20) + (speed_bonus)
# Clamped to [0, 100]
```

**Interpretation:**
- 90-100: Highly focused, minimal interruptions
- 70-89: Good focus, some pauses or rewatching
- 50-69: Moderate engagement, multiple interruptions
- <50: Low focus, many pauses/drops

### Database Storage

```sql
video_focus_metrics (
  id, student_id, topic_id, date,
  pause_count,
  rewind_count,
  drops_count,
  avg_watch_speed,        -- 1.0 = normal, 1.5 = 1.5x, etc
  total_watch_seconds,
  video_duration_seconds,
  focus_score,
  created_at, updated_at
)
```

---

## 4️⃣ Alert Generation System

### Logic
Automated alerts flag students at risk before they fail.

**File**: `backend/app/utils/historical_metrics.py` → `generate_alerts()`

### Alert Types

#### 🔴 CRITICAL: Momentum Decline

```
Trigger: momentum < -15%
Severity: Critical
Message: "🔴 Rapid decline in performance (-X% drop) - immediate teacher intervention needed"
Action: Contact student immediately
Timeline: 1 week trend reversal
```

**Example**: Student SHS dropped from 70 (previous week) to 59 (this week) = -15.7% decline

#### 🔴 CRITICAL: Consistent Underperformance

```
Trigger: SHS < 50 for 3+ consecutive days
Severity: Critical
Message: "⚠️ Consistent underperformance for 3+ days (current SHS: X)"
Action: Parent meeting recommended
Timeline: 3+ consecutive days
```

**Example**: 
- Day 1: SHS = 45 (At-risk)
- Day 2: SHS = 48 (At-risk)
- Day 3: SHS = 42 (Critical) → ALERT TRIGGERED

#### 🟡 WARNING: Video Disengagement

```
Trigger: Video completion < 20% for 5+ days
Severity: Warning
Message: "📹 Complete disengagement from videos (< 20% for 5 days)"
Action: Encourage attendance or recorded lecture review
Timeline: 5 consecutive low-engagement days
```

#### 🔴 CRITICAL: Homework Zero

```
Trigger: 0% homework submission for 7+ days
Severity: Critical
Message: "📋 Zero homework submissions for 7+ days"
Action: Check for motivational or external barriers
Timeline: 1 week no homework
```

### Alert Deduplication

Alerts are deduplicated using:
```sql
UNIQUE(alert_type, student_id, class_id, DATE(created_at))
```

This prevents duplicate "momentum_decline" alerts for the same student on the same day.

### Database Storage

```sql
performance_alerts (
  id, alert_type, severity,
  student_id, class_id, teacher_id,
  message, action_required,
  is_resolved, created_at, resolved_at
)
```

---

## 5️⃣ Login/Logout Tracking

### Logic
Track when students log in and out to calculate daily study duration.

**File**: `backend/app/routers/auth.py` (on login/logout endpoints)

### What Gets Tracked

```sql
student_session_logs (
  id, student_id, class_id,
  login_at,         -- When student logged in
  logout_at,        -- When student logged out
  duration_minutes, -- Calculated as (logout_at - login_at) / 60
  created_at
)
```

### Session Duration Calculation

```python
# On logout
session = find_session(student_id, login_at)
duration_minutes = (logout_at - login_at).total_seconds() / 60
update_session_logs(student_id, duration_minutes)

# Used in daily_metrics calculation
study_duration_minutes = SUM(duration_minutes) WHERE login_at >= CURRENT_DATE
```

### Example

```
Student logs in at 14:00, logs out at 15:30
duration_minutes = 90

Next day, cumulative:
- Session 1: 90 min
- Session 2: 120 min
- Session 3: 60 min
Total: 270 minutes for the day

Behavioral score uses: min(100, (270 / 300.0) * 100) = 90%
```

---

## 6️⃣ Revisit Tracking

### Logic
Track how many times a student revisits a topic (indicator of engagement and review habits).

**File**: `backend/app/routers/student_learning.py` → `upsert_learning_progress()`

### What Gets Tracked

```sql
student_topic_progress (
  ...existing columns...,
  revisit_count,         -- Updated each time student opens topic
  last_accessed_at       -- Timestamp of last access
)
```

### Revisit Logic

```python
# When student opens a topic
existing_progress = get_progress(student_id, topic_id)

if existing_progress and existing_progress.last_accessed_at < TODAY:
    # Different day, increment revisit
    revisit_count += 1
else:
    # Same day, don't double-count
    revisit_count unchanged

update last_accessed_at = NOW()
```

### Interpretation

- **1 revisit** = Student reviewed the topic once (normal)
- **2-3 revisits** = Active review, strong learning (80 points)
- **4+ revisits** = Very thorough review (90-100 points)

---

## 7️⃣ API Endpoints for Historical Data

### Teacher/Manager Access

#### Get Student Historical Metrics
```
GET /api/metrics/student/{student_id}/historical?class_id=X&days=30

Returns:
{
  "current_snapshot": {
    "shs": 72.5,
    "weekly_avg": 70.2,
    "monthly_avg": 68.9,
    "momentum": 3.2,        // +3.2% week-over-week
    "risk_level": "stable"
  },
  "daily_history": [
    {
      "date": "2026-05-18",
      "shs": 75,
      "video_rate": 80,
      "homework_rate": 70,
      "attendance": 100,
      "consistency": 85,
      "behavioral": 60,
      "risk_level": "stable"
    },
    ...30 days of history
  ]
}
```

#### Get Class Alerts
```
GET /api/metrics/class/{class_id}/alerts?severity=critical&unresolved_only=true

Returns:
{
  "summary": {
    "critical": 3,
    "warning": 7,
    "info": 2
  },
  "alerts": {
    "critical": [
      {
        "id": "alert-123",
        "student_id": "student-456",
        "type": "momentum_decline",
        "message": "🔴 Rapid decline...",
        "action": "Contact student immediately",
        "triggered_at": "2026-05-18T00:00:00Z"
      }
    ]
  }
}
```

#### Get Class Risk Summary
```
GET /api/metrics/class/{class_id}/risk-summary

Returns:
{
  "risk_distribution": {
    "critical": {
      "count": 2,
      "avg_shs": 35.5,
      "range": "0-40"
    },
    "at_risk": {
      "count": 7,
      "avg_shs": 52.3,
      "range": "40-59"
    },
    "stable": {
      "count": 20,
      "avg_shs": 71.2,
      "range": "60-79"
    },
    "excelling": {
      "count": 5,
      "avg_shs": 87.6,
      "range": "≥80"
    }
  },
  "action_items": [
    {
      "severity": "critical",
      "count": 2,
      "recommendation": "🔴 Immediate interventions needed..."
    }
  ]
}
```

---

## 8️⃣ Cron Job Scheduling

### File
`backend/app/main.py` → startup event

### Implementation

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(run_daily_metrics_job, 'cron', hour=0, minute=0)
scheduler.start()

# On shutdown
scheduler.shutdown()
```

### Execution Timeline

```
23:59 UTC - Job triggers
00:00 UTC - For each enrolled student:
           1. Capture daily metrics
           2. Calculate rolling averages
           3. Generate alerts
01:00 UTC - Completion (typical)

Next day - Teachers see updated dashboard with alerts
```

### Timezone Note

All jobs run on UTC. Adjust via environment if needed:
```python
scheduler.add_job(run_daily_metrics_job, 'cron', hour=18, minute=0)  # 6pm UTC = 11pm PKT
```

---

## 9️⃣ Database Dependencies

### New Tables
- `daily_student_metrics` - Daily snapshots
- `student_health_scores` - Rolling averages
- `performance_alerts` - Alert history
- `video_focus_metrics` - Video engagement details

### Updated Tables
- `student_topic_progress` - Added `revisit_count`, `last_accessed_at`
- `student_session_logs` - Added `login_at`, `logout_at`, `duration_minutes`

### Migrations
All tables are created automatically via the startup migrations in `main.py`.

---

## 🔟 Example: Complete Student Day

### Timeline: Student A, May 18, 2026

```
09:00 - Student logs in (login_at = 09:00)
09:15 - Opens Math Topic 5
        ├─ Watches 15 min of 20 min lecture (75%)
        ├─ Pauses 3 times, rewinds 1 time
        └─ Focus metrics captured

10:00 - Submits homework (15/20 marks)
        └─ Homework marked as submitted

11:00 - Reviews Topic 3 (revisit)
        ├─ Re-watches 80% of lecture
        └─ revisit_count incremented

17:00 - Logs out (logout_at = 17:00)
        └─ duration_minutes = 480 min

MIDNIGHT - Cron Job Runs:

1. Daily Snapshot Captured:
   video_rate = 75%         (Math Topic 5 watched)
   homework_rate = 75%      (15/20 marks = 75%)
   attendance_rate = 100%   (marked present)
   retakes = 1.0            (1 submission, 1 attempt)
   revisits = 1.0           (Topic 3 revisited)
   study_duration = 480 min

2. SHS Calculated:
   consistency = (100 + 75) / 2 = 87.5%
   behavioral = (85 + 80 + 100) / 3 = 88.3%  (good retakes, some revisit, long study)
   SHS = 75*0.25 + 75*0.40 + 87.5*0.20 + 88.3*0.15
       = 18.75 + 30 + 17.5 + 13.2
       = 79.45 → "Stable"

3. Rolling Averages:
   weekly_shs = average(last 7 days)
   momentum = week-over-week change

4. Alerts Checked:
   - No momentum decline? ✓
   - Not 3 days SHS < 50? ✓
   - Video > 20%? ✓
   - Had homework this week? ✓
   → No alerts triggered

NEXT DAY - Dashboard Shows:
├─ Teacher sees: "Student A - SHS 79 (Stable), ↑2% momentum"
├─ 7-day chart shows trend
├─ No alerts in danger zone
└─ Recommendation: "Keep up the good work"
```

---

## Summary Table

| Feature | Trigger | Frequency | Storage | Use Case |
|---------|---------|-----------|---------|----------|
| **Daily Snapshots** | Cron @ midnight | Daily | `daily_student_metrics` | Historical archive |
| **Rolling Averages** | After snapshots | Daily | `student_health_scores` | Trend analysis |
| **Momentum Score** | After averages | Daily | `student_health_scores.momentum` | Detect sudden changes |
| **Video Focus** | On video end | Real-time | `video_focus_metrics` | Engagement quality |
| **Login Tracking** | Auth events | Real-time | `student_session_logs` | Study duration |
| **Revisit Count** | On topic open | Real-time | `student_topic_progress` | Review frequency |
| **Alerts** | After snapshots | Daily | `performance_alerts` | Teacher notifications |

---

## Next Steps

1. ✅ **Database migrations** - Automatic on startup
2. ✅ **Cron scheduler** - Runs daily at 00:00 UTC
3. ✅ **Video tracking** - Pauses, rewinds, drops in player
4. ✅ **Login tracking** - Session logs capture duration
5. ✅ **Alert system** - Triggered during daily job
6. ✅ **API endpoints** - Access historical data
7. 📋 **Frontend dashboard** - Display metrics and alerts (Teacher Daily Dashboard)
8. 📋 **AI analysis** - Optional: Claude API for predictions

---

## Testing

### Manual Test Case

```bash
# 1. Create test student
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"...","role":"student"}'

# 2. Enroll in class
# (via admin UI)

# 3. Simulate activity
- Login to platform
- Watch video (pause 3x, rewind 1x, watch 80%)
- Submit homework
- Logout

# 4. Manually trigger daily job
curl -X POST /api/cron/calculate-daily-scores

# 5. Check metrics
curl -X GET /api/metrics/student/{id}/historical?class_id=X&days=1
  → Should see today's snapshot with all metrics

# 6. Check alerts
curl -X GET /api/metrics/class/{class_id}/alerts
  → Should be empty (student performing well)

# 7. Create alert scenario
- Create student with very low performance
- Trigger cron job
- Check alerts endpoint
  → Should show momentum_decline or consistent_underperformance alerts
```

---

**Implementation Status**: ✅ Complete
**Last Updated**: May 18, 2026
