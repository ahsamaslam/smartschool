"""
Admin Portal Routes - Full System Access
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import json
import os

from app.utils.database import execute_query, execute_one, execute_write
from app.config import settings

router = APIRouter()


# ============================================
# REQUEST MODELS
# ============================================

class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str  # student, teacher, manager, admin


class AssignRoleRequest(BaseModel):
    user_id: str
    new_role: str


class CreateSchoolRequest(BaseModel):
    name: str
    address: Optional[str] = None


class CreateBranchRequest(BaseModel):
    school_id: str
    name: str
    address: Optional[str] = None


class CreateSubjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    grade_level: str


class CreateTopicRequest(BaseModel):
    subject_id: str
    title: str
    description: Optional[str] = None
    order_index: int


class TopicItem(BaseModel):
    title: str
    description: Optional[str] = None


class ChapterItem(BaseModel):
    number: int
    name: str
    topics: List[TopicItem]


class SubjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    chapters: List[ChapterItem]


class SaveParsedCurriculumRequest(BaseModel):
    book_title: str
    grade_level: str
    subjects: List[SubjectItem]


class GenerateVideoRequest(BaseModel):
    topic_id: str
    topic_title: str
    subject_name: str
    chapter_name: str
    grade_level: str
    topic_description: Optional[str] = None


class GenerateAudioRequest(BaseModel):
    template_id: str
    voice: Optional[str] = "en-US-AriaNeural"


class GenerateWhiteboardRequest(BaseModel):
    template_id: str


class GenerateAvatarRequest(BaseModel):
    template_id: str
    voice_id: Optional[str] = "en-US-JennyNeural"
    presenter_url: Optional[str] = None


class CompositeVideoRequest(BaseModel):
    template_id: str


# ============================================
# USER MANAGEMENT
# ============================================

@router.get("/users")
async def get_all_users(role: Optional[str] = None):
    """Get all system users with optional role filter"""
    
    query = """
        SELECT id, email, full_name, role, is_active, created_at, profile_picture_url
        FROM users
        WHERE ($1::text IS NULL OR role = $1::user_role)
        ORDER BY role, full_name
    """
    
    users = await execute_query(query, role)
    return [dict(user) for user in users]


@router.post("/users")
async def create_user(user_data: CreateUserRequest):
    """Create new user account"""
    
    query = """
        INSERT INTO users (email, full_name, role)
        VALUES ($1, $2, $3)
        RETURNING id, email, full_name, role
    """
    
    user = await execute_one(
        query,
        user_data.email,
        user_data.full_name,
        user_data.role
    )
    
    return {
        "message": "User created successfully",
        "user": dict(user)
    }


@router.put("/users/{user_id}/role")
async def assign_role(user_id: str, role_data: AssignRoleRequest):
    """Assign or change user role"""
    
    query = """
        UPDATE users
        SET role = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, full_name, role
    """
    
    user = await execute_one(query, role_data.new_role, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": "Role updated successfully",
        "user": dict(user)
    }


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str):
    """Deactivate user account"""
    
    query = "UPDATE users SET is_active = false WHERE id = $1"
    await execute_write(query, user_id)
    
    return {"message": "User deactivated successfully"}


# ============================================
# SCHOOL & BRANCH MANAGEMENT
# ============================================

@router.post("/schools")
async def create_school(school_data: CreateSchoolRequest):
    """Create new school"""
    
    query = """
        INSERT INTO schools (name, address)
        VALUES ($1, $2)
        RETURNING id, name, address
    """
    
    school = await execute_one(query, school_data.name, school_data.address)
    
    return {
        "message": "School created successfully",
        "school": dict(school)
    }


@router.post("/branches")
async def create_branch(branch_data: CreateBranchRequest):
    """Create new branch"""
    
    query = """
        INSERT INTO branches (school_id, name, address)
        VALUES ($1, $2, $3)
        RETURNING id, school_id, name, address
    """
    
    branch = await execute_one(
        query,
        branch_data.school_id,
        branch_data.name,
        branch_data.address
    )
    
    return {
        "message": "Branch created successfully",
        "branch": dict(branch)
    }


# ============================================
# CURRICULUM MANAGEMENT
# ============================================

@router.get("/subjects")
async def get_all_subjects():
    """Get all subjects"""
    query = """
        SELECT id, name, description, grade_level
        FROM subjects
        ORDER BY grade_level, name
    """
    subjects = await execute_query(query)
    return [dict(s) for s in subjects]


@router.post("/subjects")
async def create_subject(subject_data: CreateSubjectRequest):
    """Create new subject"""
    
    query = """
        INSERT INTO subjects (name, description, grade_level)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, grade_level
    """
    
    subject = await execute_one(
        query,
        subject_data.name,
        subject_data.description,
        subject_data.grade_level
    )
    
    return {
        "message": "Subject created successfully",
        "subject": dict(subject)
    }


@router.post("/topics")
async def create_topic(topic_data: CreateTopicRequest):
    """Create new topic"""
    
    query = """
        INSERT INTO topics (subject_id, title, description, order_index)
        VALUES ($1, $2, $3, $4)
        RETURNING id, subject_id, title, description, order_index
    """
    
    topic = await execute_one(
        query,
        topic_data.subject_id,
        topic_data.title,
        topic_data.description,
        topic_data.order_index
    )
    
    return {
        "message": "Topic created successfully",
        "topic": dict(topic)
    }


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """Delete a subject and all its topics (+ any associated video templates)."""
    subject = await execute_one("SELECT id, name FROM subjects WHERE id = $1", subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Delete in dependency order: video_templates → topics → subject
    await execute_write(
        "DELETE FROM video_templates WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = $1)",
        subject_id,
    )
    await execute_write("DELETE FROM topics WHERE subject_id = $1", subject_id)
    await execute_write("DELETE FROM subjects WHERE id = $1", subject_id)

    return {"message": f"Subject '{subject['name']}' and all its topics deleted"}


@router.get("/subjects/{subject_id}/topics")
async def get_subject_topics(subject_id: str):
    """Get all topics for a subject"""
    query = """
        SELECT id, subject_id, title, description, order_index, chapter_name, chapter_number
        FROM topics
        WHERE subject_id = $1
        ORDER BY COALESCE(chapter_number, 0), order_index, title
    """
    topics = await execute_query(query, subject_id)
    return [dict(t) for t in topics]


@router.get("/topics/{topic_id}/template")
async def get_topic_template(topic_id: str):
    """Get the video template (script + video URLs) for a topic, if it exists."""
    row = await execute_one(
        """
        SELECT
            vt.id, vt.title, vt.transcript, vt.key_points, vt.visual_elements,
            vt.duration_seconds, vt.status,
            vt.audio_url, vt.whiteboard_url, vt.avatar_url,
            vt.final_video_url, vt.video_url,
            t.title as topic_title
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        WHERE vt.topic_id = $1
        ORDER BY vt.created_at DESC
        LIMIT 1
        """,
        topic_id,
    )
    if not row:
        return {"template": None}
    import json as _json
    data = dict(row)
    for field in ("key_points", "visual_elements"):
        if data.get(field) and isinstance(data[field], str):
            try:
                data[field] = _json.loads(data[field])
            except Exception:
                data[field] = []
    return {"template": data}


@router.put("/topics/{topic_id}/template/script")
async def update_topic_script(topic_id: str, body: dict):
    """
    Update the transcript of a topic's video template.
    If regenerate=true in body, also re-runs audio + whiteboard steps.
    """
    transcript = body.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="transcript is required")

    template = await execute_one(
        "SELECT id FROM video_templates WHERE topic_id = $1 ORDER BY created_at DESC LIMIT 1",
        topic_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="No video template for this topic yet")

    template_id = str(template["id"])

    await execute_write(
        "UPDATE video_templates SET transcript = $1, status = 'ai_script', updated_at = NOW() WHERE id = $2",
        transcript,
        template_id,
    )

    if body.get("regenerate"):
        # Re-run audio
        try:
            from app.utils.claude_ai import generate_audio_edge_tts
            audio_url = await generate_audio_edge_tts(transcript, topic_id)
            await execute_write(
                "UPDATE video_templates SET audio_url = $1, video_url = $1, status = 'audio_ready' WHERE id = $2",
                audio_url, template_id,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Audio regeneration failed: {e}")

        # Re-run whiteboard (pass the freshly generated audio to mux in)
        try:
            from app.utils.slide_generator import generate_whiteboard_video
            topic = await execute_one("SELECT title FROM topics WHERE id = $1", topic_id)
            audio_row = await execute_one(
                "SELECT audio_url FROM video_templates WHERE id = $1", template_id
            )
            audio_local = None
            if audio_row and audio_row["audio_url"]:
                candidate = audio_row["audio_url"].lstrip("/")
                if os.path.exists(candidate):
                    audio_local = candidate
            whiteboard_url = await generate_whiteboard_video(
                script=transcript,
                visual_elements=[],
                topic_title=topic["title"] if topic else "",
                topic_id=topic_id,
                audio_path=audio_local,
            )
            await execute_write(
                "UPDATE video_templates SET whiteboard_url = $1, status = 'whiteboard_ready' WHERE id = $2",
                whiteboard_url, template_id,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Whiteboard regeneration failed: {e}")

    updated = await execute_one(
        """
        SELECT id, transcript, status, audio_url, whiteboard_url, avatar_url,
               final_video_url, video_url
        FROM video_templates WHERE id = $1
        """,
        template_id,
    )
    return {"message": "Script updated", "template": dict(updated)}


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    """Get a single topic with its content and slides."""
    topic = await execute_one(
        "SELECT id, subject_id, title, description, content, slides_json, chapter_name, chapter_number, order_index FROM topics WHERE id = $1",
        topic_id,
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    import json as _json
    data = dict(topic)
    if data.get("slides_json"):
        try:
            data["slides"] = _json.loads(data["slides_json"])
        except Exception:
            data["slides"] = None
    else:
        data["slides"] = None
    del data["slides_json"]
    return {"topic": data}


@router.put("/topics/{topic_id}")
async def update_topic_content(topic_id: str, body: dict):
    """Update topic title, description, and/or text content."""
    updates, params = [], []
    for field in ("title", "description", "content"):
        if field in body and body[field] is not None:
            params.append(body[field])
            updates.append(f"{field} = ${len(params)}")
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    params.append(topic_id)
    await execute_write(
        f"UPDATE topics SET {', '.join(updates)}, updated_at = NOW() WHERE id = ${len(params)}",
        *params,
    )
    topic = await execute_one(
        "SELECT id, title, description, content FROM topics WHERE id = $1", topic_id
    )
    return {"topic": dict(topic)}


@router.get("/topics/{topic_id}/slides")
async def get_topic_slides(topic_id: str):
    """Get saved slide deck for a topic."""
    row = await execute_one(
        "SELECT slides_json FROM topics WHERE id = $1", topic_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")
    import json as _json
    slides = None
    if row["slides_json"]:
        try:
            slides = _json.loads(row["slides_json"])
        except Exception:
            pass
    return {"slides": slides}


@router.put("/topics/{topic_id}/slides")
async def save_topic_slides(topic_id: str, body: dict):
    """Save a slide deck (JSON array) to a topic."""
    import json as _json
    slides = body.get("slides")
    if slides is None:
        raise HTTPException(status_code=400, detail="slides field required")
    await execute_write(
        "UPDATE topics SET slides_json = $1, updated_at = NOW() WHERE id = $2",
        _json.dumps(slides),
        topic_id,
    )
    return {"success": True}


@router.post("/topics/{topic_id}/generate-content")
async def generate_topic_content_ai(topic_id: str):
    """Use Claude AI to generate full lesson content for a topic and save it."""
    row = await execute_one(
        """
        SELECT t.id, t.title, t.description, t.chapter_name,
               s.name AS subject_name, s.grade_level
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE t.id = $1
        """,
        topic_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Topic not found")

    from app.utils.claude_ai import generate_topic_explainer_script

    try:
        result = await generate_topic_explainer_script(
            topic_title=row["title"],
            subject_name=row["subject_name"] or "",
            chapter_name=row["chapter_name"] or "",
            grade_level=row["grade_level"] or "High School",
            topic_description=row["description"] or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    script = result.get("script", "")
    await execute_write(
        "UPDATE topics SET content = $1, updated_at = NOW() WHERE id = $2",
        script,
        topic_id,
    )
    return {
        "content": script,
        "key_points": result.get("key_points", []),
        "title": result.get("title", row["title"]),
    }


# ============================================
# AI CURRICULUM MANAGEMENT
# ============================================

@router.post("/curriculum/parse-book")
async def parse_curriculum_book(file: UploadFile = File(...)):
    """Upload a curriculum book (PDF or text) and parse it with Claude AI."""
    from app.utils.claude_ai import parse_curriculum_document

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    allowed_types = {"application/pdf", "text/plain", "text/markdown", "application/octet-stream"}
    if file.content_type not in allowed_types and not file.filename.lower().endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload PDF or text file.")

    try:
        result = await parse_curriculum_document(content, file.filename, file.content_type or "")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")


@router.post("/curriculum/save-parsed")
async def save_parsed_curriculum(data: SaveParsedCurriculumRequest):
    """Save AI-parsed curriculum structure (subjects + chapters + topics) to the database."""
    created = {"subjects": 0, "topics": 0}

    for subject_item in data.subjects:
        # Upsert subject
        subject = await execute_one(
            """
            INSERT INTO subjects (name, description, grade_level)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            subject_item.name,
            subject_item.description,
            data.grade_level,
        )
        if not subject:
            subject = await execute_one(
                "SELECT id FROM subjects WHERE name = $1 AND grade_level = $2",
                subject_item.name,
                data.grade_level,
            )
        if not subject:
            continue

        subject_id = subject["id"]
        created["subjects"] += 1
        order = 1

        for chapter in subject_item.chapters:
            for topic in chapter.topics:
                await execute_write(
                    """
                    INSERT INTO topics (subject_id, title, description, order_index, chapter_name, chapter_number)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT DO NOTHING
                    """,
                    subject_id,
                    topic.title,
                    topic.description,
                    order,
                    chapter.name,
                    chapter.number,
                )
                order += 1
                created["topics"] += 1

    return {"message": "Curriculum saved successfully", "created": created}


@router.post("/curriculum/generate-video")
async def generate_video_for_topic(data: GenerateVideoRequest):
    """Generate an AI explainer video script for a single topic and store it as a video template."""
    from app.utils.claude_ai import generate_topic_explainer_script
    import json as _json

    # Check topic exists
    topic = await execute_one("SELECT id, subject_id FROM topics WHERE id = $1", data.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    try:
        result = await generate_topic_explainer_script(
            topic_title=data.topic_title,
            subject_name=data.subject_name,
            chapter_name=data.chapter_name,
            grade_level=data.grade_level,
            topic_description=data.topic_description or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

    # Store as video template
    template = await execute_one(
        """
        INSERT INTO video_templates
            (topic_id, title, transcript, duration_seconds, status, key_points, visual_elements)
        VALUES ($1, $2, $3, $4, 'ai_script', $5, $6)
        RETURNING id, topic_id, title, duration_seconds, status
        """,
        data.topic_id,
        result.get("title", data.topic_title),
        result.get("script", ""),
        result.get("duration_estimate", 300),
        _json.dumps(result.get("key_points", [])),
        _json.dumps(result.get("visual_elements", [])),
    )

    return {
        "message": "Video script generated",
        "template": dict(template),
        "script": result.get("script", ""),
        "key_points": result.get("key_points", []),
        "visual_elements": result.get("visual_elements", []),
        "duration_estimate": result.get("duration_estimate", 300),
    }


@router.post("/curriculum/generate-audio")
async def generate_topic_audio(data: GenerateAudioRequest):
    """Generate audio narration for a topic's script using Microsoft Edge TTS (free)."""
    from app.utils.claude_ai import generate_audio_edge_tts

    template = await execute_one(
        "SELECT id, transcript, topic_id FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    try:
        audio_url = await generate_audio_edge_tts(
            template["transcript"],
            str(template["topic_id"]),
            data.voice or "en-US-AriaNeural",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET audio_url = $1, video_url = $1, status = 'audio_ready' WHERE id = $2",
        audio_url,
        data.template_id,
    )

    return {"audio_url": audio_url, "template_id": data.template_id}


@router.post("/curriculum/generate-whiteboard")
async def generate_whiteboard_for_topic(data: GenerateWhiteboardRequest):
    """Render a whiteboard-style animation video from the saved script (Pillow + imageio-ffmpeg)."""
    from app.utils.slide_generator import generate_whiteboard_video
    import json as _json

    template = await execute_one(
        "SELECT id, transcript, topic_id, visual_elements, audio_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    topic = await execute_one("SELECT title FROM topics WHERE id = $1", template["topic_id"])
    topic_title = topic["title"] if topic else "Topic"

    visual_elements = []
    if template["visual_elements"]:
        try:
            visual_elements = _json.loads(template["visual_elements"]) if isinstance(template["visual_elements"], str) else list(template["visual_elements"])
        except Exception:
            pass

    # Resolve audio URL → local path so FFmpeg can mux it in
    audio_local = None
    if template["audio_url"]:
        candidate = template["audio_url"].lstrip("/")   # e.g. static/audio/topic_xxx.mp3
        if os.path.exists(candidate):
            audio_local = candidate

    try:
        whiteboard_url = await generate_whiteboard_video(
            script=template["transcript"],
            visual_elements=visual_elements,
            topic_title=topic_title,
            topic_id=str(template["topic_id"]),
            audio_path=audio_local,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whiteboard generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET whiteboard_url = $1, status = 'whiteboard_ready' WHERE id = $2",
        whiteboard_url,
        data.template_id,
    )

    return {"whiteboard_url": whiteboard_url, "template_id": data.template_id}


@router.post("/curriculum/generate-avatar")
async def generate_avatar_for_topic(data: GenerateAvatarRequest):
    """Generate a Wav2Lip talking-teacher avatar video for a topic (local GPU, free)."""
    from app.utils.wav2lip_client import generate_wav2lip_avatar

    template = await execute_one(
        "SELECT id, topic_id, audio_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    audio_url = template["audio_url"]
    if not audio_url:
        raise HTTPException(status_code=400, detail="Audio not generated yet. Run generate-script first.")

    # Convert URL path → local filesystem path
    audio_local = audio_url.lstrip("/")  # e.g. "static/audio/topic_123.mp3"

    face_path = data.presenter_url if data.presenter_url and os.path.exists(data.presenter_url) else None

    try:
        avatar_url = await generate_wav2lip_avatar(
            audio_local_path=audio_local,
            topic_id=str(template["topic_id"]),
            face_path=face_path,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Avatar generation failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET avatar_url = $1, status = 'avatar_ready' WHERE id = $2",
        avatar_url,
        data.template_id,
    )

    return {"avatar_url": avatar_url, "template_id": data.template_id}


@router.post("/curriculum/composite-video")
async def composite_topic_video(data: CompositeVideoRequest):
    """Composite whiteboard + D-ID avatar into a final MP4 using bundled FFmpeg."""
    from app.utils.video_compositor import composite_video

    template = await execute_one(
        "SELECT id, topic_id, whiteboard_url, avatar_url FROM video_templates WHERE id = $1",
        data.template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    whiteboard_url = template["whiteboard_url"]
    avatar_url = template["avatar_url"]

    if not whiteboard_url:
        raise HTTPException(status_code=400, detail="Whiteboard video not generated yet. Run generate-whiteboard first.")
    if not avatar_url:
        raise HTTPException(status_code=400, detail="Avatar video not generated yet. Run generate-avatar first.")

    # Convert URL paths to local filesystem paths
    whiteboard_local = whiteboard_url.lstrip("/")   # e.g. static/videos/whiteboard_xxx.mp4
    avatar_local     = avatar_url.lstrip("/")

    try:
        final_url = await composite_video(
            whiteboard_local=whiteboard_local,
            avatar_local=avatar_local,
            topic_id=str(template["topic_id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compositing failed: {str(e)}")

    await execute_write(
        "UPDATE video_templates SET final_video_url = $1, video_url = $1, status = 'video_ready' WHERE id = $2",
        final_url,
        data.template_id,
    )

    return {"final_video_url": final_url, "template_id": data.template_id}


@router.post("/curriculum/composite-teacher-pip")
async def composite_with_teacher_pip(
    template_id: str = Form(...),
    teacher_video: UploadFile = File(...),
):
    """
    Upload a teacher's face-cam recording and composite it as a circular PiP
    over the generated whiteboard animation. Teacher's own audio becomes the
    final soundtrack — no AI/GPU required.
    """
    from app.utils.video_compositor import composite_teacher_pip

    template = await execute_one(
        "SELECT id, topic_id, whiteboard_url FROM video_templates WHERE id = $1",
        template_id,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Video template not found")

    whiteboard_url = template["whiteboard_url"]
    if not whiteboard_url:
        raise HTTPException(
            status_code=400,
            detail="Whiteboard animation not generated yet. Run generate-whiteboard first.",
        )

    whiteboard_local = whiteboard_url.lstrip("/")
    if not os.path.exists(whiteboard_local):
        raise HTTPException(status_code=404, detail=f"Whiteboard file missing: {whiteboard_local}")

    # Save uploaded teacher video to a temp file
    os.makedirs("static/tmp", exist_ok=True)
    ext = (teacher_video.filename or "video.mp4").rsplit(".", 1)[-1].lower()
    if ext not in {"mp4", "webm", "mov", "avi", "mkv"}:
        ext = "mp4"
    tmp_path = f"static/tmp/teacher_{template_id}.{ext}"
    try:
        content = await teacher_video.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded video: {e}")

    try:
        final_url = await composite_teacher_pip(
            whiteboard_local=whiteboard_local,
            teacher_video_local=tmp_path,
            topic_id=str(template["topic_id"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compositing failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    await execute_write(
        "UPDATE video_templates SET final_video_url = $1, status = 'video_ready' WHERE id = $2",
        final_url,
        template_id,
    )

    return {"final_video_url": final_url, "template_id": template_id}


# ============================================
# VIDEO MANAGEMENT
# ============================================

@router.get("/videos/templates")
async def get_all_video_templates():
    """Get all video templates"""
    
    query = """
        SELECT 
            vt.*,
            t.title as topic_title,
            s.name as subject_name,
            u.full_name as created_by_name
        FROM video_templates vt
        JOIN topics t ON vt.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN users u ON vt.created_by = u.id
        ORDER BY s.name, t.order_index
    """
    
    templates = await execute_query(query)
    return [dict(template) for template in templates]


@router.post("/videos/templates")
async def create_video_template(
    topic_id: str,
    title: str,
    video_url: str,
    duration_seconds: int,
    admin_id: str
):
    """Create new video template (without avatar)"""
    
    query = """
        INSERT INTO video_templates (topic_id, title, video_url, duration_seconds, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, topic_id, title, video_url, duration_seconds
    """
    
    template = await execute_one(
        query,
        topic_id,
        title,
        video_url,
        duration_seconds,
        admin_id
    )
    
    return {
        "message": "Video template created successfully",
        "template": dict(template)
    }


@router.put("/videos/templates/{template_id}")
async def update_video_template(
    template_id: str,
    title: Optional[str] = None,
    video_url: Optional[str] = None,
    duration_seconds: Optional[int] = None
):
    """Update video template"""
    
    updates = []
    params = []
    param_count = 1
    
    if title:
        updates.append(f"title = ${param_count}")
        params.append(title)
        param_count += 1
    
    if video_url:
        updates.append(f"video_url = ${param_count}")
        params.append(video_url)
        param_count += 1
    
    if duration_seconds:
        updates.append(f"duration_seconds = ${param_count}")
        params.append(duration_seconds)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    params.append(template_id)
    
    query = f"""
        UPDATE video_templates
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING id, title, video_url, duration_seconds
    """
    
    template = await execute_one(query, *params)
    
    return {
        "message": "Video template updated successfully",
        "template": dict(template)
    }


@router.delete("/videos/templates/{template_id}")
async def delete_video_template(template_id: str):
    """Delete video template"""
    
    query = "DELETE FROM video_templates WHERE id = $1"
    await execute_write(query, template_id)
    
    return {"message": "Video template deleted successfully"}


# ============================================
# AVATAR MANAGEMENT
# ============================================

@router.get("/avatars")
async def get_all_avatars():
    """Get all avatar profiles"""
    
    query = """
        SELECT 
            ap.*,
            u.full_name as teacher_name,
            u.email as teacher_email
        FROM avatar_profiles ap
        JOIN users u ON ap.teacher_id = u.id
        ORDER BY u.full_name
    """
    
    avatars = await execute_query(query)
    return [dict(avatar) for avatar in avatars]


@router.post("/avatars")
async def create_avatar_profile(
    teacher_id: str,
    avatar_name: str,
    avatar_image_url: str,
    voice_profile: Optional[str] = None
):
    """Create avatar profile for teacher"""
    
    query = """
        INSERT INTO avatar_profiles (teacher_id, avatar_name, avatar_image_url, voice_profile)
        VALUES ($1, $2, $3, $4)
        RETURNING id, teacher_id, avatar_name, avatar_image_url
    """
    
    avatar = await execute_one(
        query,
        teacher_id,
        avatar_name,
        avatar_image_url,
        voice_profile
    )
    
    return {
        "message": "Avatar profile created successfully",
        "avatar": dict(avatar)
    }


# ============================================
# BULK DATA IMPORT
# ============================================

class BulkImportRequest(BaseModel):
    schools: Optional[List[dict]] = None
    branches: Optional[List[dict]] = None
    classes: Optional[List[dict]] = None
    students: Optional[List[dict]] = None
    subjects: Optional[List[dict]] = None
    topics: Optional[List[dict]] = None


@router.post("/import/bulk")
async def bulk_import_data(import_data: BulkImportRequest):
    """
    Bulk import schools, branches, classes, students, subjects, and topics
    """
    
    results = {
        "schools": 0,
        "branches": 0,
        "classes": 0,
        "students": 0,
        "subjects": 0,
        "topics": 0
    }
    
    # Import schools
    if import_data.schools:
        for school in import_data.schools:
            query = """
                INSERT INTO schools (name, address)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            """
            await execute_write(query, school.get("name"), school.get("address"))
            results["schools"] += 1
    
    # Import branches
    if import_data.branches:
        for branch in import_data.branches:
            query = """
                INSERT INTO branches (school_id, name, address)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                branch.get("school_id"),
                branch.get("name"),
                branch.get("address")
            )
            results["branches"] += 1
    
    # Import classes
    if import_data.classes:
        for cls in import_data.classes:
            query = """
                INSERT INTO classes (branch_id, name, grade_level, teacher_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                cls.get("branch_id"),
                cls.get("name"),
                cls.get("grade_level"),
                cls.get("teacher_id")
            )
            results["classes"] += 1
    
    # Import students
    if import_data.students:
        for student in import_data.students:
            query = """
                INSERT INTO users (email, full_name, role)
                VALUES ($1, $2, 'student')
                ON CONFLICT (email) DO NOTHING
            """
            await execute_write(
                query,
                student.get("email"),
                student.get("full_name")
            )
            results["students"] += 1
    
    # Import subjects
    if import_data.subjects:
        for subject in import_data.subjects:
            query = """
                INSERT INTO subjects (name, description, grade_level)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                subject.get("name"),
                subject.get("description"),
                subject.get("grade_level")
            )
            results["subjects"] += 1
    
    # Import topics
    if import_data.topics:
        for topic in import_data.topics:
            query = """
                INSERT INTO topics (subject_id, title, description, order_index)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """
            await execute_write(
                query,
                topic.get("subject_id"),
                topic.get("title"),
                topic.get("description"),
                topic.get("order_index")
            )
            results["topics"] += 1
    
    return {
        "message": "Bulk import completed",
        "imported_counts": results
    }


# ============================================
# SYSTEM CONFIGURATION
# ============================================

@router.get("/config/models")
async def get_model_configuration():
    """Get AI model configuration"""
    
    return {
        "qa_model": "claude-sonnet-4-20250514",
        "grading_model": "claude-haiku-4-20250514",
        "exam_generation_model": "claude-sonnet-4-20250514",
        "cache_enabled": True,
        "cache_timeout": 86400
    }


@router.get("/stats/system")
async def get_system_stats():
    """Get overall system statistics"""
    
    stats_query = """
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = true) as total_students,
            (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true) as total_teachers,
            (SELECT COUNT(*) FROM users WHERE role = 'manager' AND is_active = true) as total_managers,
            (SELECT COUNT(*) FROM schools) as total_schools,
            (SELECT COUNT(*) FROM branches) as total_branches,
            (SELECT COUNT(*) FROM classes) as total_classes,
            (SELECT COUNT(*) FROM subjects) as total_subjects,
            (SELECT COUNT(*) FROM topics) as total_topics,
            (SELECT COUNT(*) FROM video_templates) as total_video_templates,
            (SELECT COUNT(*) FROM published_videos) as total_published_videos,
            (SELECT COUNT(*) FROM quiz_banks) as total_questions,
            (SELECT COUNT(*) FROM quiz_attempts WHERE is_completed = true) as total_completed_quizzes,
            (SELECT COUNT(*) FROM student_questions) as total_student_questions
    """
    
    stats = await execute_one(stats_query)
    
    return dict(stats) if stats else {}


# ============================================
# AI CONTEXT TRAINING
# ============================================

class TrainModelRequest(BaseModel):
    scope: str = "all"  # all, subjects, topics, videos


@router.post("/ai/train")
async def train_model_context(request: TrainModelRequest):
    """
    Push curriculum data as context to Claude AI.
    This seeds the AI with school-specific knowledge (Option A: context injection).
    Does not fine-tune the underlying model.
    """

    scope = request.scope
    context_parts = []

    if scope in ("all", "subjects"):
        subjects = await execute_query(
            "SELECT name, description, grade_level FROM subjects ORDER BY grade_level, name"
        )
        if subjects:
            lines = "\n".join(
                f"- {s['name']} (Grade {s['grade_level']}): {s['description'] or ''}"
                for s in subjects
            )
            context_parts.append(f"## Subjects\n{lines}")

    if scope in ("all", "topics"):
        topics = await execute_query(
            """
            SELECT t.title, t.description, s.name as subject_name
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            ORDER BY s.name, t.order_index
            """
        )
        if topics:
            lines = "\n".join(
                f"- {t['title']} ({t['subject_name']}): {t['description'] or ''}"
                for t in topics
            )
            context_parts.append(f"## Topics\n{lines}")

    if scope in ("all", "videos"):
        videos = await execute_query(
            """
            SELECT vt.title, t.title as topic_title, s.name as subject_name
            FROM video_templates vt
            JOIN topics t ON vt.topic_id = t.id
            JOIN subjects s ON t.subject_id = s.id
            ORDER BY s.name, t.order_index
            """
        )
        if videos:
            lines = "\n".join(
                f"- {v['title']} | Topic: {v['topic_title']} | Subject: {v['subject_name']}"
                for v in videos
            )
            context_parts.append(f"## Video Lessons\n{lines}")

    if not context_parts:
        return {"message": "No curriculum data found to push.", "items_pushed": 0}

    full_context = "# School Curriculum Context\n\n" + "\n\n".join(context_parts)

    # Store the prepared context in cache so Claude AI functions can reference it
    from app.utils.cache import get_redis
    r = await get_redis()
    if r:
        await r.set("curriculum_context", full_context, ex=86400 * 30)  # 30 days

    return {
        "message": "Curriculum context pushed to AI successfully.",
        "scope": scope,
        "items_pushed": sum(len(p.split("\n")) for p in context_parts),
    }


# Admin has access to all teacher and manager routes
# The frontend should include those menu items for admin role
