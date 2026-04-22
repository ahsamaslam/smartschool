# 🎓 Education Platform - AI-Powered Learning Management System

A comprehensive educational platform with video learning, AI-powered Q&A, automated quiz grading, and advanced analytics.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Cost Analysis](#cost-analysis)

---

## ✨ Features

### 👨‍🎓 Student Portal
- **Video Learning**: Watch lessons with teacher avatars and full playback controls
- **Video Analytics**: Track watch time and engagement (sent to teachers)
- **AI Q&A Bot**: Ask questions and get instant answers from Claude AI
- **Automated Quizzes**: Take tests with automatic grading
- **Multiple Test Attempts**: Take up to 5 mock tests per topic
- **Performance Dashboard**: See latest scores and averages
- **Profile Management**: Update profile picture and password
- **Tab Security**: Video pauses when switching tabs

### 👨‍🏫 Teacher Portal
- **Class Management**: Create and manage classes, add students
- **Student Analytics**: View detailed performance metrics
  - Video completion rates
  - Attendance records
  - Quiz scores and averages
  - Overall rankings
- **Attendance Tracking**: Mark daily attendance
- **Video Publishing**: Select topics, change avatars, publish videos
- **Lecture Viewer**: Preview videos without tracking
- **AI Exam Generator**: Create printable tests with customizable formats
- **Comprehensive Reports**: Daily/Weekly/Monthly/Quarterly/Yearly analytics
- **Password Reset**: Send reset links to students via email

### 👔 Manager Portal
- **Multi-School Management**: Access multiple schools and branches
- **Advanced Reports**: Student-wise, Class-wise, Teacher-wise analytics
- **Graphical Dashboards**: Visual data representation
- **Teacher Capabilities**: Full access to teacher features
- **User Management**: Reset passwords for teachers and students

### 🔧 Admin Portal
- **Full System Access**: All manager and teacher capabilities
- **Video Management**: Upload, edit, and transform videos
- **Avatar Integration**: Manage avatar profiles for teachers
- **Data Loading**: Bulk import school/class/student data
- **Model Training**: Train AI on curriculum datasets
- **Role Assignment**: Assign manager roles and user permissions
- **User Dashboard**: Comprehensive user access control

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Database**: PostgreSQL (via Supabase)
- **Caching**: Redis (Upstash - serverless)
- **AI**: Claude API (Anthropic)
- **Authentication**: Supabase Auth

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context + Hooks
- **HTTP Client**: Axios

### Infrastructure
- **Database Hosting**: Supabase (Free tier: 500MB)
- **Video Storage**: Cloudflare R2 (Free tier: 10GB)
- **Cache**: Upstash Redis (Free tier: 10K commands/day)
- **Backend Hosting**: Railway / Render
- **Frontend Hosting**: Vercel / Netlify

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐      │
│  │ Student │  │ Teacher │  │ Manager │  │  Admin   │      │
│  │ Portal  │  │ Portal  │  │ Portal  │  │  Portal  │      │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘      │
│       │            │             │             │             │
└───────┼────────────┼─────────────┼─────────────┼────────────┘
        │            │             │             │
        └────────────┴─────────────┴─────────────┘
                     │
        ┌────────────▼─────────────────────────────────────────┐
        │           FastAPI Backend                            │
        │  ┌──────────────────────────────────────────────┐   │
        │  │  Routers: Auth, Students, Teachers, etc.     │   │
        │  └──────────────────────────────────────────────┘   │
        │  ┌──────────────────────────────────────────────┐   │
        │  │  Services: Claude AI, Video, Quiz Grading    │   │
        │  └──────────────────────────────────────────────┘   │
        └──────┬─────────────┬────────────────┬───────────────┘
               │             │                │
     ┌─────────▼──┐   ┌─────▼─────┐   ┌─────▼──────┐
     │ PostgreSQL │   │   Redis   │   │ Claude API │
     │ (Supabase) │   │ (Upstash) │   │            │
     └────────────┘   └───────────┘   └────────────┘
```

### Data Flow

```
Student Question → Cache Check → Claude API → Cache Store → Response
                      ↓ HIT              ↓ MISS
                   Return Cached      Generate New Answer
```

---

## 📋 Prerequisites

- **Python**: 3.9 or higher
- **Node.js**: 16+ and npm/yarn
- **Git**: For version control
- **Accounts** (Free tiers):
  - [Supabase](https://supabase.com) - Database + Auth
  - [Cloudflare](https://cloudflare.com) - R2 Storage
  - [Upstash](https://upstash.com) - Redis
  - [Anthropic](https://anthropic.com) - Claude API

---

## 🚀 Quick Start

### 1. Clone/Download Project

```bash
# If using git
git clone <repository-url>
cd education-platform

# Or extract the downloaded ZIP file
```

### 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run:
   - `database/schema.sql`
   - `database/seed.sql`
4. Copy these values from **Project Settings > API**:
   - Project URL
   - anon/public key
   - service_role key

### 3. Setup Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → Create bucket: `education-videos`
3. Create API tokens under **Manage R2 API Tokens**
4. Save Account ID, Access Key ID, and Secret Access Key

### 4. Setup Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (select a free region)
3. Copy the Redis URL

### 5. Get Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key from API Keys section
3. Copy the key (starts with `sk-ant-`)

### 6. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your credentials:
# - SUPABASE_URL, SUPABASE_KEY, DATABASE_URL
# - REDIS_URL
# - ANTHROPIC_API_KEY
# - R2 credentials

# Run migrations (if using Alembic)
# alembic upgrade head

# Start server
python -m app.main
# OR
uvicorn app.main:app --reload
```

Backend will run at: `http://localhost:8000`
API Docs: `http://localhost:8000/api/docs`

### 7. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
# OR
yarn install

# Create .env file
cp .env.example .env

# Edit .env and add:
# VITE_API_URL=http://localhost:8000/api

# Start development server
npm run dev
# OR
yarn dev
```

Frontend will run at: `http://localhost:5173`

### 8. Test Login

**Default Accounts** (from seed data):

```
Admin:
  Email: admin@education.com
  Password: Admin@123

Teacher:
  Email: teacher1@education.com
  Password: Teacher@123

Student:
  Email: student1@education.com
  Password: Student@123
```

> **Note**: Set passwords via Supabase Auth Dashboard first!

---

## 💻 Development Guide

### Project Structure

```
education-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Configuration settings
│   │   ├── models/              # Database models
│   │   ├── routers/             # API endpoints
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── students.py      # Student endpoints
│   │   │   ├── teachers.py      # Teacher endpoints
│   │   │   ├── managers.py      # Manager endpoints
│   │   │   ├── admins.py        # Admin endpoints
│   │   │   ├── videos.py        # Video management
│   │   │   ├── quizzes.py       # Quiz system
│   │   │   ├── qa.py            # Q&A bot
│   │   │   ├── attendance.py    # Attendance tracking
│   │   │   └── analytics.py     # Reports & analytics
│   │   ├── services/            # Business logic
│   │   ├── utils/               # Utilities
│   │   │   ├── database.py      # DB connections
│   │   │   ├── cache.py         # Redis cache
│   │   │   └── claude_ai.py     # Claude integration
│   │   └── schemas/             # Pydantic models
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── QuizInterface.jsx
│   │   │   ├── QABot.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── pages/               # Route pages
│   │   │   ├── Student/
│   │   │   ├── Teacher/
│   │   │   ├── Manager/
│   │   │   └── Admin/
│   │   ├── services/            # API calls
│   │   │   └── api.js
│   │   ├── hooks/               # Custom React hooks
│   │   ├── context/             # State management
│   │   └── App.jsx
│   ├── package.json
│   └── .env
│
└── database/
    ├── schema.sql               # Database schema
    └── seed.sql                 # Sample data
```

### Adding New Features

#### 1. Add Database Tables

Edit `database/schema.sql`:

```sql
CREATE TABLE new_feature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Create API Endpoint

In `backend/app/routers/new_feature.py`:

```python
from fastapi import APIRouter
from app.utils.database import execute_query

router = APIRouter()

@router.get("/")
async def get_all():
    query = "SELECT * FROM new_feature"
    return await execute_query(query)
```

#### 3. Add to Main App

In `backend/app/main.py`:

```python
from app.routers import new_feature

app.include_router(
    new_feature.router,
    prefix="/api/new-feature",
    tags=["New Feature"]
)
```

#### 4. Create Frontend Component

In `frontend/src/pages/NewFeature.jsx`:

```jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function NewFeature() {
    const [data, setData] = useState([]);

    useEffect(() => {
        api.get('/new-feature')
            .then(res => setData(res.data));
    }, []);

    return (
        <div>
            {data.map(item => (
                <div key={item.id}>{item.name}</div>
            ))}
        </div>
    );
}
```

---

## 📊 Cost Analysis (5000 Students)

### Infrastructure (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Supabase Pro | 8GB DB | $25 |
| Cloudflare R2 | 100GB storage | $15 |
| Upstash Redis | Pay-as-you-go | $15 |
| Railway/Render | Backend hosting | $20 |
| Vercel | Frontend | $0 |
| **Total Infrastructure** | | **$75/month** |

### AI Costs (Optimized)

| Service | Usage | Cost |
|---------|-------|------|
| Q&A (80% cached) | 10K questions/day | $300 |
| Quiz Grading (Haiku) | 5K quizzes/day | $150 |
| Quiz Generation | Pre-generated | $50 |
| **Total AI** | | **$500/month** |

### **Total Operating Cost**: ~$575/month

### Revenue Model

- 5000 students × $15/month = **$75,000/month**
- Operating costs: $575/month
- **Profit margin: 99.2%** 🚀

---

## 🔒 Security Features

### Video Security
- Tab switching pauses video
- Watch time tracking
- Unique session IDs
- Watermarking support

### Quiz Security
- Timer enforcement
- Tab switch detection
- Non-copyable content
- Shuffled questions
- One-time submission

### Authentication
- JWT tokens
- Role-based access control (RBAC)
- Password reset tokens with expiry
- Session management via Redis

---

## 📚 API Documentation

Access interactive API docs at:
- **Swagger UI**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`

### Key Endpoints

```
Authentication:
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/password-reset/request
GET    /api/auth/me

Students:
GET    /api/students/dashboard
GET    /api/students/subjects
GET    /api/students/videos/{video_id}
POST   /api/students/quiz/submit

Teachers:
GET    /api/teachers/classes
POST   /api/teachers/classes
GET    /api/teachers/students
POST   /api/teachers/attendance
POST   /api/teachers/publish-video

Videos:
POST   /api/videos/upload
GET    /api/videos/{video_id}/analytics

Quizzes:
POST   /api/quizzes/generate
POST   /api/quizzes/grade
GET    /api/quizzes/results

Q&A:
POST   /api/qa/ask
GET    /api/qa/history
```

---

## 🚀 Deployment

### Backend (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add environment variables via Railway dashboard
# Deploy
railway up
```

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel

# Set environment variables in Vercel dashboard
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/
```

### Frontend Tests

```bash
cd frontend
npm test
```

---

## 📝 License

MIT License - See LICENSE file

---

## 👥 Contributors

Your Name - Developer

---

## 📞 Support

For issues and questions:
- Email: support@education.com
- GitHub Issues: [Link to issues]

---

## 🗺 Roadmap

- [ ] Mobile app (React Native)
- [ ] Live video streaming
- [ ] Parent portal
- [ ] Certificate generation
- [ ] Gamification features
- [ ] WhatsApp integration
- [ ] Offline mode support

---

**Built with ❤️ using Claude AI, FastAPI, and React**
