-- ============================================
-- EDUCATION PLATFORM DATABASE SCHEMA
-- PostgreSQL + Supabase Compatible
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'manager', 'admin', 'super_admin');
CREATE TYPE quiz_type AS ENUM ('mcq', 'short_answer', 'long_answer', 'mixed');
CREATE TYPE question_type AS ENUM ('mcq', 'short_answer', 'long_answer');
CREATE TYPE complexity_level AS ENUM ('easy', 'medium', 'hard');

-- ============================================
-- CORE TABLES
-- ============================================

-- Tenants (multi-tenant root)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_by_super_admin_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    password_hash TEXT,                          -- bcrypt hash; NULL falls back to Supabase Auth
    must_change_password BOOLEAN DEFAULT false,
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Schools
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- School Branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Classes
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    grade_level VARCHAR(50),
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Class Enrollments (Student-Class relationship)
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(student_id, class_id)
);

-- ============================================
-- CURRICULUM TABLES
-- ============================================

-- Subjects
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    grade_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Class Subjects (Which subjects are taught in which class)
CREATE TABLE class_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(class_id, subject_id)
);

-- Topics
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VIDEO TABLES
-- ============================================

-- Video Templates (base videos without avatar)
CREATE TABLE video_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    video_url TEXT NOT NULL, -- Cloudflare R2 URL
    duration_seconds INTEGER,
    transcript TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Design Templates (Pre-built presentation templates with slide layouts)
CREATE TABLE design_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100), -- 'science', 'computer', 'math', 'language', 'social_studies', 'arts', 'general', etc.
    description TEXT,
    is_system BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    
    -- Template configuration (JSON schema)
    layout_definitions JSONB NOT NULL, -- Array of slide layout types with styling rules
    -- Example: [
    --   { "id": "title", "name": "Title Slide", "bg": "...", "title_style": {...}, "subtitle_style": {...} },
    --   { "id": "content", "name": "Content Slide", "bg": "...", "title_style": {...}, "content_style": {...} },
    --   ...
    -- ]
    
    preview_image_url TEXT,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Relationship: Topics using a specific template
CREATE TABLE topic_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    design_template_id UUID REFERENCES design_templates(id) ON DELETE SET NULL,
    applied_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(topic_id)
);

-- Avatar Profiles
CREATE TABLE avatar_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_name VARCHAR(255),
    avatar_image_url TEXT, -- Teacher's avatar image
    voice_profile TEXT, -- ElevenLabs voice ID or settings
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Published Videos (template + avatar combination)
CREATE TABLE published_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_template_id UUID REFERENCES video_templates(id) ON DELETE CASCADE,
    class_subject_id UUID REFERENCES class_subjects(id) ON DELETE CASCADE,
    avatar_profile_id UUID REFERENCES avatar_profiles(id),
    final_video_url TEXT NOT NULL, -- Processed video with avatar
    published_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VIDEO ANALYTICS TABLES
-- ============================================

-- Video Watch Sessions
CREATE TABLE video_watch_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    published_video_id UUID REFERENCES published_videos(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    total_watch_time_seconds INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    is_completed BOOLEAN DEFAULT false
);

-- Video Engagement Events (granular tracking)
CREATE TABLE video_engagement_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES video_watch_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50), -- 'play', 'pause', 'seek', 'complete'
    timestamp_in_video INTEGER, -- seconds
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- QUIZ TABLES
-- ============================================

-- Quiz Banks (Pre-generated questions)
CREATE TABLE quiz_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    difficulty complexity_level DEFAULT 'medium',
    correct_answer TEXT, -- For MCQ: option letter, for others: sample answer
    options JSONB, -- For MCQ: {"A": "option1", "B": "option2", ...}
    points INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quiz Instances (Generated tests for students)
CREATE TABLE quiz_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    published_video_id UUID REFERENCES published_videos(id) ON DELETE CASCADE,
    quiz_type quiz_type DEFAULT 'mixed',
    total_points INTEGER DEFAULT 100,
    time_limit_minutes INTEGER DEFAULT 30,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quiz Questions (Specific questions in a quiz instance)
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_instance_id UUID REFERENCES quiz_instances(id) ON DELETE CASCADE,
    question_bank_id UUID REFERENCES quiz_banks(id),
    order_index INTEGER,
    points INTEGER DEFAULT 1
);

-- Student Quiz Attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quiz_instance_id UUID REFERENCES quiz_instances(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    score DECIMAL(5,2),
    total_points INTEGER,
    is_completed BOOLEAN DEFAULT false,
    attempt_number INTEGER DEFAULT 1
);

-- Quiz Answers (Student's answers)
CREATE TABLE quiz_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
    student_answer TEXT,
    points_earned DECIMAL(5,2),
    is_correct BOOLEAN,
    feedback TEXT, -- AI-generated feedback
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Q&A TABLES
-- ============================================

-- Student Questions
CREATE TABLE student_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    published_video_id UUID REFERENCES published_videos(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    asked_at TIMESTAMP DEFAULT NOW()
);

-- Bot Answers
CREATE TABLE bot_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES student_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_cached BOOLEAN DEFAULT false, -- If answer was from cache
    created_at TIMESTAMP DEFAULT NOW()
);

-- Answer Cache (For optimizing Claude API costs)
CREATE TABLE answer_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_hash VARCHAR(64) UNIQUE, -- Hash of normalized question
    topic_id UUID REFERENCES topics(id),
    answer_text TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ATTENDANCE TABLES
-- ============================================

-- Attendance Records
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_present BOOLEAN DEFAULT false,
    marked_by UUID REFERENCES users(id), -- Teacher who marked
    marked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, class_id, date)
);

-- ============================================
-- EXAM GENERATION TABLES
-- ============================================

-- Teacher Generated Exams
CREATE TABLE teacher_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    topics UUID[], -- Array of topic IDs
    complexity complexity_level DEFAULT 'medium',
    exam_format JSONB, -- {"mcq": 10, "short": 5, "long": 3}
    generated_content TEXT, -- AI-generated exam content
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION TABLES
-- ============================================

-- Password Reset Tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE METRICS (Calculated Scores)
-- ============================================

-- Student Performance Summary
CREATE TABLE student_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    video_completion_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
    attendance_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
    average_quiz_score DECIMAL(5,2) DEFAULT 0,
    highest_quiz_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0, -- Calculated weighted score
    ranking INTEGER, -- Position in class
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, class_id, date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Enrollment indexes
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class ON enrollments(class_id);

-- Video indexes
CREATE INDEX idx_published_videos_class_subject ON published_videos(class_subject_id);
CREATE INDEX idx_published_videos_date ON published_videos(published_date);

-- Analytics indexes
CREATE INDEX idx_video_sessions_student ON video_watch_sessions(student_id);
CREATE INDEX idx_video_sessions_video ON video_watch_sessions(published_video_id);

-- Quiz indexes
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_instance_id);

-- Q&A indexes
CREATE INDEX idx_questions_student ON student_questions(student_id);
CREATE INDEX idx_questions_video ON student_questions(published_video_id);
CREATE INDEX idx_answer_cache_hash ON answer_cache(question_hash);

-- Attendance indexes
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, date);

-- Performance indexes
CREATE INDEX idx_performance_student ON student_performance(student_id);
CREATE INDEX idx_performance_class_date ON student_performance(class_id, date);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - For Supabase
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_watch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (Students can only see their own data)
CREATE POLICY "Students can view their own enrollments"
    ON enrollments FOR SELECT
    USING (auth.uid() = student_id);

CREATE POLICY "Students can view their own quiz attempts"
    ON quiz_attempts FOR SELECT
    USING (auth.uid() = student_id);

-- Teachers can view their class data
CREATE POLICY "Teachers can view their class students"
    ON enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = enrollments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

-- ============================================
-- INITIAL DATA / SEED
-- ============================================

-- Insert default admin user (password will be set via Supabase Auth)
-- Admin user is bootstrapped from ADMIN_EMAIL / ADMIN_PASSWORD env vars on application startup.
-- Do not add users here.

COMMENT ON TABLE users IS 'All system users: students, teachers, managers, admins';
COMMENT ON TABLE published_videos IS 'Videos with avatars ready for student viewing';
COMMENT ON TABLE quiz_banks IS 'Pre-generated questions for reuse and cost optimization';
COMMENT ON TABLE answer_cache IS 'Cached Q&A responses to reduce Claude API costs';
COMMENT ON TABLE student_performance IS 'Daily calculated performance metrics for ranking';
