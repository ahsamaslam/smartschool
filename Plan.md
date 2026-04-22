COMPLETE PROJECT PLAN FOR IDE AGENT
I'll give you the complete, detailed plan with every file that needs to be created for both backend and frontend.

📋 MASTER FILE LIST - COMPLETE PROJECT
Total Files to Create: 120+

🔷 PART 1: BACKEND FILES (FastAPI)
Backend Root Files
backend/
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
├── Dockerfile (optional)
└── app/
├── **init**.py
├── main.py
├── config.py
└── [subdirectories below]
File 1: backend/.gitignore
gitignore# Python
**pycache**/
_.py[cod]
_$py.class
\*.so
.Python
venv/
env/
ENV/

# Environment

.env
.env.local

# IDE

.vscode/
.idea/
_.swp
_.swo

# Logs

\*.log

# Database

_.db
_.sqlite

# OS

.DS_Store
Thumbs.db
File 2: backend/requirements.txt ✅ Already created
File 3: backend/.env.example ✅ Already created
File 4: backend/README.md
markdown# Education Platform - Backend API

FastAPI backend with PostgreSQL, Redis, and Claude AI integration.

## Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python -m app.main
```

## API Documentation

http://localhost:8000/api/docs

Backend App Structure
backend/app/
├── **init**.py
├── main.py ✅ Already created
├── config.py ✅ Already created
├── dependencies.py ⚠️ Need to create
├── constants.py ⚠️ Need to create
│
├── models/ ⚠️ Need to create (Pydantic models)
│ ├── **init**.py
│ ├── user.py
│ ├── class_model.py
│ ├── video.py
│ ├── quiz.py
│ ├── analytics.py
│ └── common.py
│
├── schemas/ ⚠️ Need to create (Request/Response schemas)
│ ├── **init**.py
│ ├── auth.py
│ ├── student.py
│ ├── teacher.py
│ ├── manager.py
│ ├── admin.py
│ ├── quiz.py
│ ├── video.py
│ └── common.py
│
├── routers/ ✅ Already created (most files)
│ ├── **init**.py ✅
│ ├── auth.py ✅
│ ├── students.py ✅
│ ├── teachers.py ✅
│ ├── managers.py ✅
│ ├── admins.py ✅
│ ├── quizzes.py ✅
│ ├── videos.py ✅
│ ├── qa.py ✅
│ ├── attendance.py ✅
│ ├── analytics.py ✅
│ └── classes.py ✅
│
├── services/ ⚠️ Need to create (Business logic)
│ ├── **init**.py
│ ├── auth_service.py
│ ├── student_service.py
│ ├── teacher_service.py
│ ├── video_service.py
│ ├── quiz_service.py
│ ├── analytics_service.py
│ └── notification_service.py
│
├── utils/ ✅ Partially created
│ ├── **init**.py
│ ├── database.py ✅
│ ├── cache.py ✅
│ ├── claude_ai.py ✅
│ ├── auth.py ⚠️ Need to create
│ ├── validators.py ⚠️ Need to create
│ ├── helpers.py ⚠️ Need to create
│ └── security.py ⚠️ Need to create
│
├── middleware/ ⚠️ Need to create
│ ├── **init**.py
│ ├── auth.py
│ ├── rate_limit.py
│ └── error_handler.py
│
└── tests/ ⚠️ Need to create
├── **init**.py
├── test_auth.py
├── test_students.py
├── test_teachers.py
└── test_quizzes.py

🔶 PART 2: FRONTEND FILES (React)
Frontend Root Files
frontend/
├── .env.example ✅ Already created
├── .gitignore
├── package.json ✅ Already created
├── vite.config.js ✅ Already created
├── tailwind.config.js ✅ Already created
├── postcss.config.js ⚠️ Need to create
├── index.html ⚠️ Need to create
├── README.md ⚠️ Need to create
└── public/
├── favicon.ico
└── logo.png
File 5: frontend/.gitignore
gitignore# Dependencies
node_modules/
.pnp
.pnp.js

# Testing

coverage/

# Production

build/
dist/

# Environment

.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs

npm-debug.log*
yarn-debug.log*
yarn-error.log\*

# IDE

.vscode/
.idea/
_.swp
_.swo

# OS

.DS_Store
Thumbs.db
File 6: frontend/postcss.config.js
jsexport default {
plugins: {
tailwindcss: {},
autoprefixer: {},
},
}
File 7: frontend/index.html
html<!DOCTYPE html>

<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Education Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

Frontend Source Structure
frontend/src/
├── main.jsx ⚠️ Need to create (Entry point)
├── App.jsx ⚠️ Need to create (Main app)
├── index.css ⚠️ Need to create (Global styles)
│
├── components/ ⚠️ Need to create (Reusable components)
│ ├── common/
│ │ ├── Button.jsx
│ │ ├── Input.jsx
│ │ ├── Card.jsx
│ │ ├── Modal.jsx
│ │ ├── Spinner.jsx
│ │ ├── Alert.jsx
│ │ ├── Dropdown.jsx
│ │ └── Navbar.jsx
│ │
│ ├── layout/
│ │ ├── Header.jsx
│ │ ├── Sidebar.jsx
│ │ ├── Footer.jsx
│ │ └── Layout.jsx
│ │
│ ├── student/
│ │ ├── VideoPlayer.jsx ⚠️ CRITICAL - Video with security
│ │ ├── QuizInterface.jsx ⚠️ CRITICAL - Quiz with timer
│ │ ├── QABot.jsx ⚠️ CRITICAL - AI chat
│ │ ├── SubjectCard.jsx
│ │ ├── TopicList.jsx
│ │ └── PerformanceChart.jsx
│ │
│ ├── teacher/
│ │ ├── ClassCard.jsx
│ │ ├── StudentList.jsx
│ │ ├── AttendanceTable.jsx
│ │ ├── PerformanceTable.jsx
│ │ ├── VideoPublisher.jsx
│ │ ├── ExamGenerator.jsx
│ │ └── ReportViewer.jsx
│ │
│ ├── manager/
│ │ ├── SchoolSelector.jsx
│ │ ├── AnalyticsDashboard.jsx
│ │ ├── ChartCard.jsx
│ │ └── ReportFilters.jsx
│ │
│ └── admin/
│ ├── UserManagement.jsx
│ ├── VideoTemplateManager.jsx
│ ├── AvatarManager.jsx
│ ├── BulkImporter.jsx
│ └── SystemStats.jsx
│
├── pages/ ⚠️ Need to create (Page components)
│ ├── auth/
│ │ ├── Login.jsx
│ │ ├── ForgotPassword.jsx
│ │ └── ResetPassword.jsx
│ │
│ ├── student/
│ │ ├── Dashboard.jsx
│ │ ├── SubjectView.jsx
│ │ ├── VideoLesson.jsx
│ │ ├── QuizPage.jsx
│ │ ├── QuizResults.jsx
│ │ └── Profile.jsx
│ │
│ ├── teacher/
│ │ ├── Dashboard.jsx
│ │ ├── Classes.jsx
│ │ ├── ClassDetail.jsx
│ │ ├── StudentDetail.jsx
│ │ ├── Attendance.jsx
│ │ ├── PublishVideo.jsx
│ │ ├── GenerateExam.jsx
│ │ └── Reports.jsx
│ │
│ ├── manager/
│ │ ├── Dashboard.jsx
│ │ ├── Schools.jsx
│ │ ├── BranchView.jsx
│ │ ├── StudentReports.jsx
│ │ ├── ClassReports.jsx
│ │ └── TeacherReports.jsx
│ │
│ └── admin/
│ ├── Dashboard.jsx
│ ├── Users.jsx
│ ├── Schools.jsx
│ ├── Curriculum.jsx
│ ├── Videos.jsx
│ └── Settings.jsx
│
├── services/ ⚠️ Need to create (API calls)
│ ├── api.js ⚠️ CRITICAL - Axios instance
│ ├── authService.js
│ ├── studentService.js
│ ├── teacherService.js
│ ├── managerService.js
│ ├── adminService.js
│ ├── quizService.js
│ ├── videoService.js
│ └── analyticsService.js
│
├── context/ ⚠️ Need to create (State management)
│ ├── AuthContext.jsx
│ ├── UserContext.jsx
│ ├── ThemeContext.jsx
│ └── NotificationContext.jsx
│
├── hooks/ ⚠️ Need to create (Custom hooks)
│ ├── useAuth.js
│ ├── useApi.js
│ ├── useDebounce.js
│ ├── useLocalStorage.js
│ └── useWebSocket.js
│
├── utils/ ⚠️ Need to create (Helper functions)
│ ├── constants.js
│ ├── helpers.js
│ ├── validators.js
│ ├── formatters.js
│ └── dateUtils.js
│
└── routes/ ⚠️ Need to create (Routing)
├── index.jsx
├── ProtectedRoute.jsx
└── RoleBasedRoute.jsx

📊 COMPLETE FILE CREATION CHECKLIST
✅ Already Created (25 files)
Backend:

requirements.txt
.env.example
app/main.py
app/config.py
app/routers/init.py
app/routers/auth.py
app/routers/students.py
app/routers/teachers.py
app/routers/managers.py
app/routers/admins.py
app/routers/quizzes.py
app/routers/videos.py
app/routers/qa.py
app/routers/attendance.py
app/routers/analytics.py
app/routers/classes.py
app/utils/database.py
app/utils/cache.py
app/utils/claude_ai.py

Frontend:

package.json
vite.config.js
tailwind.config.js
.env.example

Database:

database/schema.sql
database/seed.sql

⚠️ Need to Create (95+ files)
Backend (35 files):

backend/.gitignore
backend/README.md
backend/Dockerfile
app/init.py
app/dependencies.py
app/constants.py
app/models/_ (7 files)
app/schemas/_ (8 files)
app/services/_ (7 files)
app/utils/_ (4 files)
app/middleware/_ (4 files)
app/tests/_ (5 files)

Frontend (60+ files):

frontend/.gitignore
frontend/postcss.config.js
frontend/index.html
frontend/README.md
src/main.jsx
src/App.jsx
src/index.css
src/components/common/_ (8 files)
src/components/layout/_ (4 files)
src/components/student/_ (6 files)
src/components/teacher/_ (7 files)
src/components/manager/_ (4 files)
src/components/admin/_ (5 files)
src/pages/auth/_ (3 files)
src/pages/student/_ (6 files)
src/pages/teacher/_ (8 files)
src/pages/manager/_ (6 files)
src/pages/admin/_ (6 files)
src/services/_ (9 files)
src/context/_ (4 files)
src/hooks/_ (5 files)
src/utils/_ (5 files)
src/routes/_ (3 files)

🎯 PRIORITY IMPLEMENTATION ORDER
Phase 1: Core Backend (Already Done ✅)

Database schema ✅
Authentication ✅
All routers ✅
AI integration ✅

Phase 2: Backend Support Files (1-2 hours)

Dependencies & middleware
Pydantic models
Request/response schemas
Service layer
Tests

Phase 3: Frontend Foundation (2-3 hours)

Main entry point (main.jsx, App.jsx)
Routing setup
API service layer
Auth context
Common components

Phase 4: Student Portal (3-4 hours)

Video Player (with security)
Quiz Interface (with timer)
Q&A Bot
Dashboard
Subject/Topic views

Phase 5: Teacher Portal (3-4 hours)

Class management
Student list & analytics
Attendance
Video publisher
Exam generator
Reports

Phase 6: Manager Portal (2-3 hours)

School/Branch selector
Analytics dashboard
Charts & graphs
Report filters

Phase 7: Admin Portal (2-3 hours)

User management
Video template manager
Curriculum management
System stats

Phase 8: Polish & Testing (2-3 hours)

Error handling
Loading states
Mobile responsive
Security features
Testing

📝 DETAILED IMPLEMENTATION PLAN FOR IDE AGENT
Instructions for Your IDE Agent:
TASK: Build complete Education Platform
STACK: Python FastAPI + React + PostgreSQL + Redis + Claude AI

PHASE 1 (BACKEND - Already 90% complete):
└── Complete remaining utility files
└── Add Pydantic models for validation
└── Create service layer for business logic
└── Add middleware for auth/rate-limiting

PHASE 2 (FRONTEND FOUNDATION):
└── Create src/main.jsx (React entry point)
└── Create src/App.jsx (Router setup)
└── Create src/services/api.js (Axios config)
└── Create src/context/AuthContext.jsx (Auth state)
└── Create src/routes/index.jsx (All routes)

PHASE 3 (CORE COMPONENTS):
└── Create common UI components (Button, Input, Card, Modal)
└── Create Layout components (Header, Sidebar, Footer)
└── Create VideoPlayer.jsx (CRITICAL - with tab detection)
└── Create QuizInterface.jsx (CRITICAL - with timer)
└── Create QABot.jsx (CRITICAL - AI chat)

PHASE 4 (PAGES BY ROLE):
└── Student: Dashboard, VideoLesson, QuizPage, Results
└── Teacher: Dashboard, Classes, Attendance, Reports
└── Manager: Dashboard, Schools, Analytics
└── Admin: Dashboard, Users, Videos, Settings

PHASE 5 (INTEGRATION):
└── Connect all components to API
└── Add error handling
└── Add loading states
└── Test all flows

SECURITY REQUIREMENTS:
└── Video: Pause on tab switch
└── Quiz: Timer + no tab switching
└── Content: Non-copyable
└── Auth: JWT tokens + role checks

🚀 WHAT TO GIVE YOUR IDE AGENT
Option 1: Give Complete File List
Copy this entire document to your IDE agent
Option 2: Step-by-Step Prompts
Prompt 1: Backend Utilities
Create the following backend utility files:

1. app/dependencies.py - FastAPI dependencies for auth
2. app/utils/auth.py - JWT token handling
3. app/utils/security.py - Password hashing, CORS
4. app/utils/validators.py - Input validation
5. app/middleware/auth.py - Auth middleware
   Prompt 2: Frontend Foundation
   Create React frontend foundation:
6. src/main.jsx - App entry with React Router
7. src/App.jsx - Main app with routes
8. src/index.css - Tailwind imports
9. src/services/api.js - Axios instance with interceptors
10. src/context/AuthContext.jsx - Auth state management
    Prompt 3: Student Portal
    Create complete student portal:
11. pages/student/Dashboard.jsx - Subject cards with scores
12. components/student/VideoPlayer.jsx - Video with tab detection
13. components/student/QuizInterface.jsx - Quiz with timer
14. components/student/QABot.jsx - AI chat interface
15. All necessary API service calls
    Prompt 4-7: Repeat for Teacher, Manager, Admin

💾 QUICK REFERENCE: CRITICAL FILES
Must Have for MVP:
Backend:

✅ app/main.py
✅ app/routers/\* (all routers)
✅ app/utils/claude_ai.py
⚠️ app/utils/auth.py (need JWT)
⚠️ app/middleware/auth.py (need auth check)

Frontend:

⚠️ src/main.jsx (entry)
⚠️ src/App.jsx (router)
⚠️ src/services/api.js (API client)
⚠️ src/components/student/VideoPlayer.jsx (CRITICAL)
⚠️ src/components/student/QuizInterface.jsx (CRITICAL)
⚠️ src/components/student/QABot.jsx (CRITICAL)
⚠️ src/pages/student/Dashboard.jsx
⚠️ src/pages/auth/Login.jsx
