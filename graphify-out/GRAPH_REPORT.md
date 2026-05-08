# Graph Report - .  (2026-05-08)

## Corpus Check
- Large corpus: 212 files · ~746,293 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1348 nodes · 2277 edges · 103 communities (87 shown, 16 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 340 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 102|Community 102]]

## God Nodes (most connected - your core abstractions)
1. `execute_one()` - 92 edges
2. `execute_query()` - 61 edges
3. `execute_write()` - 55 edges
4. `PageSpinner()` - 33 edges
5. `useAuth()` - 32 edges
6. `GenerateSlidesResponse` - 30 edges
7. `GenerateSlidesRequest` - 29 edges
8. `ensure_library_tables()` - 15 edges
9. `ensure_student_data_structures()` - 11 edges
10. `Dataset` - 11 edges

## Surprising Connections (you probably didn't know these)
- `delete_subject()` --calls--> `execute_write()`  [INFERRED]
  backend/app/routers/library.py → backend/app/utils/database.py
- `delete_book()` --calls--> `execute_write()`  [INFERRED]
  backend/app/routers/library.py → backend/app/utils/database.py
- `get_student_profile()` --calls--> `execute_one()`  [INFERRED]
  backend/app/routers/students.py → backend/app/utils/database.py
- `create_class()` --calls--> `execute_one()`  [INFERRED]
  backend/app/routers/teachers.py → backend/app/utils/database.py
- `add_student_to_class()` --calls--> `execute_one()`  [INFERRED]
  backend/app/routers/teachers.py → backend/app/utils/database.py

## Communities (103 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.0
Nodes (54): assign_role(), composite_topic_video(), create_avatar_profile(), create_branch(), create_class(), create_design_template(), create_school(), create_subject() (+46 more)

### Community 1 - "Community 1"
Cohesion: 0.0
Nodes (46): generate_slides_ai(), parse_curriculum_book(), AI-assisted slide authoring. Payload: topic, content, audience, tone, slide_coun, Upload a curriculum book (PDF or text) and parse it with Claude AI., generate_quiz(), GenerateQuizRequest, get_quiz_instance(), get_quiz_results() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.0
Nodes (27): datagen(), face_detect(), get_smoothened_boxes(), _load(), load_model(), main(), datagen(), face_detect() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.0
Nodes (47): add_subject_to_class(), create_book(), create_library_class(), create_library_topic(), create_subject(), CreateBookRequest, CreateClassRequest, CreateLibraryTopicRequest (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.0
Nodes (28): Enum, FaceAlignment, LandmarksType, NetworkSize, Enum class defining the type of landmarks to detect.      ``_2D`` - the detect, Bottleneck, conv3x3(), ConvBlock (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.0
Nodes (19): FaceDetector, An abstract class representing a face detector.      Any other face detection, Detects faces in a given image.          This function detects the faces prese, Detects faces from all the images present in a given directory.          Argum, FaceDetector, object, batch_decode(), decode() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.0
Nodes (23): CLASS_PRESETS, openLibraryPresentNewTabWithFallback(), TopicDetailView(), TopicSlidesInlinePreview(), LibraryTopicPresent(), AdminRecordLecture(), recorderSupportsPause(), SLIDE_ANIMATIONS (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.0
Nodes (39): AdminAIParser, AdminCurriculum, AdminDashboard, AdminLibrary, AdminLibraryTopicPresent, AdminRecordLecture, AdminSchools, AdminSettings (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.0
Nodes (18): cosine_loss(), Dataset, eval_model(), _load(), load_checkpoint(), save_checkpoint(), train(), get_image_list() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.0
Nodes (4): PageSpinner(), StudentDashboard(), StudentProfile(), TeacherReports()

### Community 10 - "Community 10"
Cohesion: 0.0
Nodes (35): add_student_to_class(), AddStudentRequest, AttendanceRequest, create_class(), CreateClassRequest, ExamGenerationRequest, get_attendance(), get_class_report() (+27 more)

### Community 11 - "Community 11"
Cohesion: 0.0
Nodes (33): BaseModel, AssignRoleRequest, BulkImportRequest, ChangeSectionRequest, ChapterItem, CompositeVideoRequest, CreateBranchRequest, CreateClassRequest (+25 more)

### Community 12 - "Community 12"
Cohesion: 0.0
Nodes (7): ROLES, COUNTRY_CODES, EMPTY_FORM, ROLE_OPT2, ROLE_OPTS, ROLE_COLORS, Input

### Community 13 - "Community 13"
Cohesion: 0.0
Nodes (16): useAuth(), ProtectedRoute(), QABot(), QuizPage(), SubjectView(), VideoLesson(), AvatarVideos(), STATUS_LABEL (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.0
Nodes (32): _activate_enrollment(), archive_student(), _assigned_classes_text(), bulk_import_data(), change_student_section(), create_student(), create_user(), deactivate_user() (+24 more)

### Community 15 - "Community 15"
Cohesion: 0.0
Nodes (30): main(), get_all_avatars(), get_all_classes(), get_all_school_data(), get_all_schools(), get_all_subjects(), get_all_video_templates(), get_branch_classes() (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.0
Nodes (17): adminService, api, baseURL, token, examService, managerService, quizService, studentService (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.0
Nodes (28): add_question(), AddQuestionRequest, _build_syllabus_context(), create_exam(), CreateExamRequest, delete_question(), _fetch_exam_with_questions(), _fetch_previous_questions() (+20 more)

### Community 18 - "Community 18"
Cohesion: 0.0
Nodes (7): SCOPE_OPTIONS, sizes, variants, QUESTION_LABELS, COMPLEXITY_BADGE, ExamsPage(), STATUS_BADGE

### Community 19 - "Community 19"
Cohesion: 0.0
Nodes (24): Cloudflare R2 (Video Storage), FastAPI Backend, JWT Authentication, FastAPI (Python Framework), Pydantic v2 (Data Validation), pytest + pytest-asyncio (Testing), Uvicorn (ASGI Server), Railway / Render (Backend Hosting) (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.0
Nodes (14): _amp_to_db(), _build_mel_basis(), get_hop_size(), _linear_to_mel(), linearspectrogram(), _lws_processor(), melspectrogram(), _normalize() (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.0
Nodes (19): get_all_schools(), get_branch_overview(), get_class_wise_report(), get_dashboard_analytics(), get_school_branches(), get_student_wise_report(), get_system_overview(), get_teacher_wise_report() (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.0
Nodes (6): AdminVideos(), TopicRow(), TeacherAttendance(), AttendanceForm(), formatDate(), formatSmartDate()

### Community 23 - "Community 23"
Cohesion: 0.0
Nodes (9): cosine_loss(), Dataset, eval_model(), get_sync_loss(), _load(), load_checkpoint(), save_checkpoint(), save_sample_images() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.0
Nodes (16): database_health(), Check database connectivity, check_db_health(), execute_scalar(), get_class_students(), get_db(), get_student_classes(), get_teacher_classes() (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.0
Nodes (5): CONFIG, COLUMNS, COLUMNS, COLUMNS, REPORT_PERIODS

### Community 26 - "Community 26"
Cohesion: 0.0
Nodes (12): DESIGNATIONS, EMPLOYMENT_STATUS, EMPTY_FORM, normalizePhone(), normalizeStringArray(), onlyDigits(), toFormState(), AdminTeachers() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.0
Nodes (14): ChangePasswordRequest, LoginRequest, PasswordResetConfirm, PasswordResetRequest, Authentication routes — Login, Logout, Password Reset, Profile., # TODO: Send email in production. In DEBUG mode expose the link for testing., Update display name and/or profile picture URL for a user., # TODO: In production, verify password with Supabase Auth (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.0
Nodes (15): Admin, Attendance Tracking, Class Management, Manager Portal, Manager, Multi-School & Branch Management, Password Reset via Email, Reports & Analytics (Daily/Weekly/Monthly/Quarterly/Yearly) (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.0
Nodes (13): get_available_quiz(), get_student_profile(), get_video_details(), QuestionRequest, Student Portal Routes, Get video details for viewing, Track video engagement events, Get available quiz for a video (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.0
Nodes (13): cache_delete(), cache_exists(), clear_buffered_events(), delete_user_session(), get_buffered_events(), get_redis(), init_cache(), Redis cache utilities for performance optimization (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.0
Nodes (13): format_date(), format_datetime(), generate_uuid(), paginate(), General-purpose helper utilities shared across the application., Return a new UUID4 string., Slice *items* and return pagination metadata.      Args:         items:, Format a datetime object to a string. Returns '' for None. (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.0
Nodes (8): COMPLEXITY_BADGE, ExamEditor(), groupByType(), PrintView(), STATUS_BADGE, TYPE_LABEL, TYPE_ORDER, EXAM_FONT_SIZE_OPTIONS

### Community 33 - "Community 33"
Cohesion: 0.0
Nodes (5): ALPHA, BranchPanel(), getRange(), NUM, PRESET_SECTIONS

### Community 34 - "Community 34"
Cohesion: 0.0
Nodes (7): Navbar(), ROLE_LABELS, SubjectCard(), SCORE_THRESHOLDS, capitalise(), getInitials(), scoreColor()

### Community 35 - "Community 35"
Cohesion: 0.0
Nodes (3): TopicStudio(), pickTheme(), SLIDE_THEMES

### Community 36 - "Community 36"
Cohesion: 0.0
Nodes (9): add_process_time_header(), general_exception_handler(), health_check(), Main FastAPI application entry point, Health check endpoint, Add processing time to response headers, Handle validation errors, Handle all other exceptions (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.0
Nodes (7): Config, get_settings(), Configuration settings for the Education Platform, Application settings loaded from environment variables, Get cached settings instance     Using lru_cache ensures we only load settings, Settings, BaseSettings

### Community 38 - "Community 38"
Cohesion: 0.0
Nodes (6): Login(), AuthContext, AuthProvider(), ROLE_DASHBOARDS, RoleBasedRedirect(), root

### Community 39 - "Community 39"
Cohesion: 0.0
Nodes (10): generate_topic_audio(), generate_whiteboard_for_topic(), Update the transcript of a topic's video template.     If regenerate=true in bo, Generate audio narration for a topic's script using Microsoft Edge TTS (free)., Render a whiteboard-style animation video from the saved script (Pillow + imagei, update_topic_script(), generate_audio_edge_tts(), Convert an AI-generated explainer script to MP3 audio using Microsoft Edge TTS. (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.0
Nodes (9): _composite_pip_sync(), _composite_sync(), composite_teacher_pip(), composite_video(), _get_ffmpeg(), FFmpeg video compositor. Uses the FFmpeg binary bundled inside imageio-ffmpeg —, Overlay teacher's recorded face-cam as a circular PiP on the whiteboard animatio, Return path to FFmpeg: system binary first, then imageio-ffmpeg bundle. (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.0
Nodes (10): change_password(), confirm_password_reset(), Apply a new password using a valid, unused, unexpired reset token., Change password for a logged-in user. Requires valid old password., Confirm password reset with token, Change password for logged-in user, Return True if plain_password matches hashed_password., verify_password() (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.0
Nodes (10): cache_get(), get_cached_answer(), get_user_session(), hash_question(), normalize_question(), Normalize question for caching     - Convert to lowercase     - Remove extra spa, Create hash for question caching          Args:         question: Question text, Get cached answer for a question          Args:         question: Question text (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.0
Nodes (3): PORTAL_NAMES, Layout(), NAV_BY_ROLE

### Community 44 - "Community 44"
Cohesion: 0.0
Nodes (10): Bulk Data Import (Schools/Classes/Students), Docker Compose (Local Infra), Alembic (DB Migrations), PostgreSQL Container (smart_school_db), PostgreSQL Database, Redis Container (smart_school_redis), Row-Level Security (Supabase RLS), Database Schema (30+ Tables) (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.0
Nodes (7): generate_avatar_for_topic(), Generate a Wav2Lip talking-teacher avatar video for a topic (local GPU, free)., Teacher uploads their own photo → Wav2Lip regenerates the avatar video for this, regenerate_avatar_with_photo(), generate_wav2lip_avatar(), Local Wav2Lip avatar generator. Replaces D-ID API with fully local, free GPU in, Generate a lip-synced talking-head video using local Wav2Lip on the RTX 3070.

### Community 46 - "Community 46"
Cohesion: 0.0
Nodes (7): Input validators used across request handlers. These are called at the applicat, Validate that *filename* has an allowed extension for *file_type*.      Args:, Return True if *value* is a valid UUID4 string., Return error message if pagination params are out of range, else None., validate_file_extension(), validate_pagination(), validate_uuid()

### Community 47 - "Community 47"
Cohesion: 0.0
Nodes (7): get_user_from_token(), FastAPI dependency — extracts and verifies the Bearer JWT from the     Authoriza, get_token_subject(), Authentication utilities — JWT token creation/verification and password hashing., Decode and verify a JWT token.      Args:         token: JWT string.      R, Return the 'sub' (user_id) from a valid token, or None., verify_token()

### Community 48 - "Community 48"
Cohesion: 0.0
Nodes (7): constant_time_compare(), generate_numeric_otp(), generate_secure_token(), Security helpers — secure random tokens and input sanitisation. Password hashin, Generate a cryptographically secure URL-safe token.     Used for password-reset, Generate a numeric OTP of *digits* length., Compare two strings in constant time to prevent timing attacks.     Wraps secre

### Community 49 - "Community 49"
Cohesion: 0.0
Nodes (7): ask_question(), QuestionRequest, Ask question to AI bot, ask_question(), Ask question and get AI-powered answer, answer_student_question(), Answer student question using Claude AI with caching          Args:         q

### Community 50 - "Community 50"
Cohesion: 0.0
Nodes (7): _check_face_detected(), _get_ffmpeg(), Wav2Lip inference wrapper. Generates a talking-head MP4 from a face photo + aud, Return path to bundled ffmpeg binary (from imageio-ffmpeg in the wav2lip_env)., Quick OpenCV Haar-cascade check before sending to Wav2Lip., Run Wav2Lip inference.      Args:         face_path:   Path to teacher photo, run_wav2lip()

### Community 51 - "Community 51"
Cohesion: 0.0
Nodes (8): Admin Portal, Teacher Avatar Integration, httpx (Async HTTP), Role Assignment & User Permissions, D-ID Client Utility, Wav2Lip Client Utility, Video Management (Upload/Edit/Transform), Wav2Lip Environment (Lip Sync Video)

### Community 52 - "Community 52"
Cohesion: 0.0
Nodes (5): _get_ffmpeg(), _parse_sections(), Animated interactive slide video generator. Per-frame animation with Pillow:, Extract sections from the 7-section prompt structure., _render_whiteboard_sync()

### Community 54 - "Community 54"
Cohesion: 0.0
Nodes (7): Performance Dashboard, Profile Management (Picture + Password), Student Portal, Student, Tab Switch Security, Topic / Video Publisher, Video Player (Avatar-based)

### Community 55 - "Community 55"
Cohesion: 0.0
Nodes (7): Claude Haiku (Quiz Grading, Cost-Optimised), Claude Sonnet (Q&A), anthropic SDK (Claude Client), Automated Quiz Grading (Claude Haiku), Quiz Anti-Cheat Security, Quiz / Test System, Claude AI Utility

### Community 56 - "Community 56"
Cohesion: 0.0
Nodes (6): Initialize services on startup, startup_event(), hash_password(), Return bcrypt hash of plain_password., init_db(), Initialize database connection pool

### Community 57 - "Community 57"
Cohesion: 0.0
Nodes (6): login(), LoginResponse, Login endpoint          NOTE: For development, we're using Supabase Auth.     In, Authenticate a user and return a signed JWT access token.      - Looks up the us, create_access_token(), Create a signed JWT access token.      Args:         data:           Payload

### Community 58 - "Community 58"
Cohesion: 0.0
Nodes (6): cache_answer(), cache_set(), Set value in cache          Args:         key: Cache key         value: Value to, Cache answer for a question          Args:         question: Question text, Store user session data          Args:         user_id: User ID         session_, set_user_session()

### Community 59 - "Community 59"
Cohesion: 0.0
Nodes (6): Answer Caching (80% Cost Reduction), Claude AI API (Anthropic), AI Exam Generator (Printable), AI Q&A Bot, Redis Cache, Upstash Redis (Serverless Cache)

### Community 60 - "Community 60"
Cohesion: 0.0
Nodes (6): Axios HTTP Client, React Context + Hooks (State Management), React 18 Frontend, Tailwind CSS, Vercel / Netlify (Frontend Hosting), Vite Build Tool

### Community 61 - "Community 61"
Cohesion: 0.0
Nodes (5): Generate a password-reset token and (in production) email it to the user., Request password reset - generates token and sends email, request_password_reset(), get_user_by_email(), Get user by email (includes password_hash for authentication).

### Community 62 - "Community 62"
Cohesion: 0.0
Nodes (5): shutdown_event(), close_cache(), Close Redis connection, close_db(), Close database connection pool

### Community 64 - "Community 64"
Cohesion: 0.0
Nodes (4): main(), mp_handler(), process_audio_file(), process_video_file()

### Community 65 - "Community 65"
Cohesion: 0.0
Nodes (4): apply_template_to_topic(), convert_slides_to_template(), Apply a design template to a topic - converts existing slides to template design, Convert existing slides to match template design.     Applies template styling

### Community 66 - "Community 66"
Cohesion: 0.0
Nodes (3): get_student_performance(), Analytics & Reporting Routes, Get student performance analytics

### Community 67 - "Community 67"
Cohesion: 0.0
Nodes (3): get_video_analytics(), Video Management Routes, Get video watch analytics

### Community 68 - "Community 68"
Cohesion: 0.0
Nodes (4): generate_exam(), Generate printable exam using Claude AI, generate_teacher_exam(), Generate a complete printable exam for teachers          Args:         topics

### Community 69 - "Community 69"
Cohesion: 0.0
Nodes (4): cache_health(), Check Redis cache connectivity, check_cache_health(), Check if Redis is accessible

### Community 70 - "Community 70"
Cohesion: 0.0
Nodes (3): generate_did_avatar(), D-ID Talking Avatar API client. Docs: https://docs.d-id.com/reference/talks Pr, Generate a talking-head avatar video via D-ID.     - Strips [VISUAL: ...] marke

### Community 72 - "Community 72"
Cohesion: 0.0
Nodes (4): Pillow (Image Processing), pypdf / pdfplumber / pymupdf (PDF Extraction), Slides AI Schema, AI Slide Deck Generator

### Community 73 - "Community 73"
Cohesion: 0.0
Nodes (4): asyncpg (Async PostgreSQL Driver), psycopg2 (PostgreSQL Driver), SQLAlchemy ORM, Database Utility (Connection Pooling)

### Community 75 - "Community 75"
Cohesion: 0.0
Nodes (3): logout(), Invalidate cached session. Frontend should discard the JWT., Logout and clear session

### Community 76 - "Community 76"
Cohesion: 0.0
Nodes (3): get_current_user(), Return profile for *user_id* (passed as query param by the frontend)., Get current user information

### Community 79 - "Community 79"
Cohesion: 0.0
Nodes (3): passlib[bcrypt] (Password Hashing), python-jose (JWT), Auth Utility

### Community 80 - "Community 80"
Cohesion: 0.0
Nodes (3): aiocache (Async Caching), redis-py (Redis Client), Cache Utility (Redis Layer)

### Community 81 - "Community 81"
Cohesion: 0.0
Nodes (3): edge-tts (Microsoft Neural TTS), imageio + imageio-ffmpeg (Slide Video), Slide Generator Utility

## Knowledge Gaps
- **359 isolated node(s):** `Config`, `Configuration settings for the Education Platform`, `Application settings loaded from environment variables`, `Convert CORS_ORIGINS string to list`, `Convert video extensions string to list` (+354 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.