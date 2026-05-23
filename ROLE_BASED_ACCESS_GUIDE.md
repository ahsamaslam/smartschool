# 🔐 ROLE-BASED ACCESS GUIDE

**What each user role should see and access**

---

## 👤 ROLE 1: STUDENT

**Can See:**
- ✅ Personal SHS score (only their own)
- ✅ Personal risk level (Critical/At Risk/Stable/Excelling)
- ✅ Personal metrics:
  - Video watch percentage
  - Homework grades
  - Attendance record
- ✅ Personal profile information

**Can Do:**
- ✅ View their own dashboard
- ✅ View their own assignments/homework
- ✅ Download personal report
- ❌ Cannot see other students' data
- ❌ Cannot access class analytics
- ❌ Cannot access school analytics

**Expected Dashboard:**
```
┌─────────────────────────────────────────┐
│        MY PERFORMANCE DASHBOARD          │
├─────────────────────────────────────────┤
│ SHS Score: 86.63                        │
│ Status: 🟢 EXCELLING                    │
│                                         │
│ Video Watched:    85%  ████████░ 85%   │
│ Homework Grade:   82.5% ████████░ 82.5%│
│ Attendance:       100%  ██████████ 100%│
│                                         │
│ Last Updated: 2026-05-19 14:23:45      │
└─────────────────────────────────────────┘
```

---

## 👨‍🏫 ROLE 2: TEACHER

**Can See:**
- ✅ All students in their assigned class(es)
- ✅ Each student's SHS score
- ✅ Each student's risk level
- ✅ Class average SHS
- ✅ Student distribution:
  - How many excelling (80-100)
  - How many stable (60-79)
  - How many at risk (40-59)
  - How many critical (0-39)
- ✅ Class Vitality Index (CVI)
- ✅ Student attendance/homework summaries

**Can Do:**
- ✅ View individual student details
- ✅ Calculate class CVI
- ✅ Download class report
- ✅ Mark attendance
- ✅ Grade homework
- ❌ Cannot see other teachers' classes
- ❌ Cannot see school-wide analytics
- ❌ Cannot access admin functions

**Expected Dashboard:**
```
┌─────────────────────────────────────────────────────┐
│     CLASS 1-A PERFORMANCE DASHBOARD                 │
├─────────────────────────────────────────────────────┤
│ Total Students: 20                                  │
│ Average SHS: 65.4                                   │
│ Class CVI: 62.1 (Satisfactory)                      │
│                                                     │
│ Performance Distribution:                           │
│ 🟢 Excelling (80-100):      3 students (15%)       │
│ 🟢 Stable (60-79):          10 students (50%)       │
│ 🟠 At Risk (40-59):         5 students (25%)        │
│ 🔴 Critical (0-39):         2 students (10%)        │
│                                                     │
│ Student List:                                       │
│ Ahmed Ali      │ 86.63 │ 🟢 Excelling │ 5/5 days  │
│ Fatima Khan    │ 68.13 │ 🟠 At Risk   │ 4/5 days  │
│ Hassan Ali     │ 32.25 │ 🔴 Critical  │ 2/5 days  │
│ ... (15 more)                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📋 ROLE 3: MANAGER/COORDINATOR

**Can See:**
- ✅ Assigned classes
- ✅ Class metrics (CVI, average SHS)
- ✅ Student performance summaries
- ✅ Attendance trends
- ✅ Homework submission rates
- ✅ At-risk student alerts
- ✅ Limited class-level analytics

**Can Do:**
- ✅ View assigned classes
- ✅ View student lists for assigned classes
- ✅ Generate class reports
- ✅ View attendance/homework trends
- ❌ Cannot see other managers' classes
- ❌ Cannot modify grades
- ❌ Cannot access full school analytics
- ❌ Cannot access admin functions

**Expected Dashboard:**
```
┌─────────────────────────────────────────────────┐
│   ASSIGNED CLASSES DASHBOARD                    │
├─────────────────────────────────────────────────┤
│ My Classes: 3                                   │
│                                                 │
│ Class 1-A                                       │
│ ├─ Students: 20                                 │
│ ├─ CVI: 62.1 (Satisfactory)                     │
│ ├─ Average SHS: 65.4                            │
│ └─ At Risk: 7 students                          │
│                                                 │
│ Class 2-B                                       │
│ ├─ Students: 22                                 │
│ ├─ CVI: 71.3 (Good)                             │
│ ├─ Average SHS: 70.2                            │
│ └─ At Risk: 3 students                          │
│                                                 │
│ Class 3-C                                       │
│ ├─ Students: 18                                 │
│ ├─ CVI: 48.2 (Needs Improvement)                │
│ ├─ Average SHS: 55.1                            │
│ └─ At Risk: 10 students                         │
└─────────────────────────────────────────────────┘
```

---

## 🏫 ROLE 4: ADMIN

**Can See:**
- ✅ School-wide analytics
- ✅ All classes and their metrics
- ✅ All students and their SHS scores
- ✅ School Performance Index (SPI)
- ✅ Student distribution charts
- ✅ Class performance rankings
- ✅ At-risk alerts
- ✅ Trends and comparisons
- ✅ All teachers and their CVI

**Can Do:**
- ✅ View all students/classes/teachers
- ✅ Calculate CVI for any class
- ✅ Calculate SPI for school
- ✅ Generate comprehensive reports
- ✅ Export analytics data
- ✅ View teacher performance
- ✅ Manage school settings
- ✅ Create user accounts
- ❌ Cannot see other schools (if multi-school)
- ❌ Cannot access super admin functions

**Expected Dashboard:**
```
┌─────────────────────────────────────────────────────┐
│      SCHOOL ANALYTICS DASHBOARD                     │
├─────────────────────────────────────────────────────┤
│ School: Allied School                               │
│ Academic Session: 2025-2026                         │
│                                                     │
│ OVERALL METRICS:                                    │
│ Total Students: 302                                 │
│ Total Classes: 8                                    │
│ Average SHS: 65.2                                   │
│ Average CVI: 60.1                                   │
│ School SPI: 58.5 (Satisfactory)                     │
│                                                     │
│ CLASS PERFORMANCE:                                  │
│ Class 1-A │ CVI: 62.1 │ SHS: 65.4  │ 20 students   │
│ Class 1-B │ CVI: 55.2 │ SHS: 58.9  │ 18 students   │
│ Class 2-A │ CVI: 71.3 │ SHS: 70.2  │ 22 students   │
│ Class 2-B │ CVI: 48.2 │ SHS: 55.1  │ 21 students   │
│ Class 3-A │ CVI: 68.5 │ SHS: 68.1  │ 25 students   │
│ ... (3 more classes)                                │
│                                                     │
│ STUDENT DISTRIBUTION:                               │
│ 🟢 Excelling (80-100):     45 (15%)                │
│ 🟢 Stable (60-79):         150 (50%)                │
│ 🟠 At Risk (40-59):        90 (30%)                 │
│ 🔴 Critical (0-39):        17 (5%)                  │
│                                                     │
│ HIGH RISK ALERTS:                                   │
│ ⚠️  Class 2-B: 11 at-risk students               │
│ ⚠️  Class 3-C: 8 at-risk students                │
│ ⚠️  Hassan Ali: Critical SHS 32.25                │
└─────────────────────────────────────────────────────┘
```

---

## 👨‍💼 ROLE 5: SUPER ADMIN

**Can See:**
- ✅ **ALL schools** in the system
- ✅ School Performance Index (SPI) for all schools
- ✅ School rankings
- ✅ System-wide analytics
- ✅ All students/teachers/admins globally
- ✅ User management
- ✅ System settings
- ✅ Usage statistics
- ✅ Multi-school comparisons

**Can Do:**
- ✅ View all schools
- ✅ View all users globally
- ✅ Generate system-wide reports
- ✅ Export all data
- ✅ Manage school admins
- ✅ Configure system settings
- ✅ Create new schools
- ✅ Manage global permissions
- ✅ Access audit logs
- ✅ Compare school performance

**Expected Dashboard:**
```
┌──────────────────────────────────────────────────────────┐
│      SYSTEM DASHBOARD (SUPER ADMIN)                      │
├──────────────────────────────────────────────────────────┤
│ SYSTEM OVERVIEW:                                         │
│ Total Schools: 5                                         │
│ Total Students: 1,200+                                   │
│ Total Teachers: 85                                       │
│ Total Admins: 5                                          │
│                                                          │
│ SYSTEM-WIDE METRICS:                                     │
│ Average Student Health (SHS): 64.8                        │
│ Average Teacher Performance (CVI): 59.4                   │
│ Average School Performance (SPI): 58.2                    │
│                                                          │
│ SCHOOL PERFORMANCE RANKING:                              │
│ 1. St. Mary's School      │ SPI: 75.2 │ Good      │      │
│ 2. Allied School          │ SPI: 60.5 │ Satisfactory │   │
│ 3. City Academy          │ SPI: 58.3 │ Satisfactory │   │
│ 4. Public School         │ SPI: 52.1 │ Needs Improvement
│ 5. Central Institute     │ SPI: 45.7 │ Needs Improvement│
│                                                          │
│ SYSTEM ALERTS:                                           │
│ ⚠️  Public School: Declining performance               │
│ ⚠️  Central Institute: 35% at-risk students            │
│ ✅ St. Mary's School: Excellent improvement             │
│                                                          │
│ USER MANAGEMENT:                                         │
│ Super Admins: 1                                          │
│ Admins: 5                                                │
│ Managers: 12                                             │
│ Teachers: 85                                             │
│ Students: 1,200+                                         │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 DATA VISIBILITY MATRIX

| Data | Student | Teacher | Manager | Admin | Super Admin |
|------|---------|---------|---------|-------|-------------|
| Personal SHS | ✅ Own | ✅ Class | ✅ Limited | ✅ School | ✅ System |
| Personal Grades | ✅ Own | ✅ Class | ✅ Limited | ✅ School | ✅ System |
| Personal Attendance | ✅ Own | ✅ Class | ✅ Limited | ✅ School | ✅ System |
| Class Metrics | ❌ | ✅ Own | ✅ Assigned | ✅ All | ✅ All |
| School Analytics | ❌ | ❌ | ✅ Limited | ✅ School | ✅ All |
| Multi-School | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ | ✅ |
| System Settings | ❌ | ❌ | ❌ | Limited | ✅ |

---

## 🔒 ACCESS CONTROL RULES

### Student
```
WHERE user_id = CURRENT_USER
```

### Teacher
```
WHERE class_id IN (
  SELECT class_id FROM teacher_assignments 
  WHERE teacher_id = CURRENT_USER
)
```

### Manager
```
WHERE class_id IN (
  SELECT class_id FROM manager_assignments 
  WHERE manager_id = CURRENT_USER
)
```

### Admin
```
WHERE school_id = CURRENT_USER.school_id
```

### Super Admin
```
-- No restrictions (access to everything)
```

---

## 🧪 TESTING EACH ROLE

### Test Student Access
1. Login as any student
2. Verify sees only personal data
3. Try accessing `/api/classes` (should fail)
4. Try accessing `/api/admin` (should fail)

### Test Teacher Access
1. Login as amna.chaudhry3@alliedschool.edu.pk
2. Verify sees only Class 1-A data
3. Try accessing Class 2-A data (should fail)
4. Try accessing admin panel (should fail)

### Test Manager Access
1. Login as manager (if exists)
2. Verify sees assigned classes only
3. Try accessing unassigned class (should fail)
4. Try accessing admin panel (should fail)

### Test Admin Access
1. Login as admin@alliedschool.edu.pk
2. Verify sees all school data
3. Try accessing admin panel (should succeed)
4. Try accessing other school data (should fail)

### Test Super Admin Access
1. Login as super admin (admin@mail.com or similar)
2. Verify sees all schools
3. Verify can access all data
4. Verify can access system settings

---

## ✅ VERIFICATION CHECKLIST

```
STUDENT:
☑ Sees personal SHS score
☑ Sees personal grades
☑ Cannot see other students' data
☑ Cannot see class analytics
☑ Cannot access admin functions

TEACHER:
☑ Sees all students in their class
☑ Sees class average SHS
☑ Sees individual SHS scores
☑ Can calculate CVI for their class
☑ Cannot see other classes
☑ Cannot see admin functions

MANAGER:
☑ Sees assigned classes
☑ Sees student lists for assigned classes
☑ Cannot see other managers' classes
☑ Cannot modify grades
☑ Cannot access full admin functions

ADMIN:
☑ Sees all students in school
☑ Sees all classes
☑ Can calculate SPI for school
☑ Can access admin dashboard
☑ Cannot see other schools (if multi-school)
☑ Cannot access super admin functions

SUPER ADMIN:
☑ Sees all schools
☑ Sees all students globally
☑ Can compare schools
☑ Can access system settings
☑ Can manage admins
☑ Can manage users globally
```

---

## 🚀 TESTING SEQUENCE

1. **Test Student:** Login → View dashboard → Verify personal data only
2. **Test Teacher:** Login → View class → Verify class data only
3. **Test Manager:** Login → View assigned classes → Verify limited access
4. **Test Admin:** Login → View school analytics → Verify school data
5. **Test Super Admin:** Login → View all schools → Verify global access

---

**Status: Ready to Test Role-Based Access** ✅

