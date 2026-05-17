"""
Academic Chat System Router
- WebSocket for real-time messaging
- REST endpoints for conversations, messages, announcements
- Teacher-controlled, role-based, section-aware communication
"""

import os
import uuid
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Body, status
from fastapi.responses import JSONResponse
import magic
import bleach
from decimal import Decimal

from pydantic import BaseModel

from app.routers.auth import get_user_from_token
from app.utils.auth import verify_token
from app.utils.database import execute_query, execute_one, execute_write
from app.utils.socket_manager import (
    sio,
    register_sid,
    unregister_sid,
    sids_for_user,
    cancel_offline_task,
    set_offline_task,
    get_user_for_sid,
)
from app.config import settings

# ============================================
# PYDANTIC MODELS
# ============================================

class MessageRequest(BaseModel):
    content: str

router = APIRouter()

# ============================================
# CONSTANTS & CONFIG
# ============================================

CONVERSATION_STATUS = {"pending", "active", "rejected", "blocked", "archived", "closed"}
ANNOUNCEMENT_PRIORITY = {"normal", "important", "urgent"}
ATTACHMENT_CATEGORY = {"image", "pdf", "document", "voice", "generic_file"}
EXAM_CHAT_MODE = {"strict", "moderated", "emergency_only"}

DEFAULT_PAGE_SIZE = 30
MAX_PAGE_SIZE = 100

MAX_MESSAGE_LENGTH = 2000
MAX_REQUEST_MESSAGE_LENGTH = 300
MAX_ANNOUNCEMENT_LENGTH = 5000

MAX_BURST_MESSAGES = 5
BURST_WINDOW_SECONDS = 10

ALLOWED_EXTENSIONS = {
    "image": {"jpg", "jpeg", "png", "gif", "webp"},
    "document": {"pdf", "doc", "docx", "txt", "ppt", "pptx"},
    "voice": {"webm", "ogg", "mp3", "wav"},
}
MAX_FILE_SIZE = {
    "image": 5_000_000,
    "document": 20_000_000,
    "voice": 10_000_000,
}

# ============================================
# HELPERS
# ============================================

async def get_school_chat_settings(school_id: str) -> dict:
    """Load or create default school_chat_settings"""
    settings = await execute_one(
        "SELECT * FROM school_chat_settings WHERE school_id = $1",
        school_id
    )
    if not settings:
        # Insert defaults
        await execute_write(
            """INSERT INTO school_chat_settings (school_id, exam_chat_mode, student_monthly_upload_limit,
               student_voice_monthly_limit, max_voice_seconds, allow_manager_student_chat,
               allow_admin_student_chat, enable_read_receipts, enable_typing_indicators, message_retention_days)
               VALUES ($1, 'moderated', 100, 50, 180, false, true, true, true, 30)""",
            school_id
        )
        settings = await execute_one(
            "SELECT * FROM school_chat_settings WHERE school_id = $1",
            school_id
        )
    return dict(settings) if settings else {}

async def student_can_contact_teacher(student_id: str, teacher_id: str) -> bool:
    """Check if student is enrolled in teacher's class"""
    result = await execute_one(
        """
        SELECT 1
        FROM enrollments e
        JOIN classes c ON e.class_id = c.id
        WHERE e.student_id = $1 AND c.teacher_id = $2
        LIMIT 1
        """,
        student_id, teacher_id
    )
    return result is not None

async def validate_teacher_can_broadcast(teacher_id: str, class_id: Optional[str], subject_id: Optional[str]) -> bool:
    """Check if teacher can broadcast to this class"""
    if not class_id:
        return True  # No scope restriction

    # Check if teacher teaches this class
    result = await execute_one(
        """
        SELECT 1 FROM classes
        WHERE id = $1 AND teacher_id = $2
        LIMIT 1
        """,
        class_id, teacher_id
    )
    return result is not None

def get_file_category(mime_type: str, filename: str) -> str:
    """Determine attachment category from MIME type"""
    mime_lower = mime_type.lower()
    if mime_lower.startswith("image/"):
        return "image"
    elif mime_lower == "application/pdf":
        return "pdf"
    elif mime_lower in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                         "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                         "text/plain"]:
        return "document"
    elif mime_lower.startswith("audio/"):
        return "voice"
    else:
        return "generic_file"

async def log_audit(actor_id: str, school_id: str, action_type: str, entity_type: Optional[str] = None, entity_id: Optional[str] = None, metadata: Optional[dict] = None):
    """Log moderation action to audit_logs"""
    try:
        await execute_write(
            """INSERT INTO audit_logs (actor_id, school_id, action_type, entity_type, entity_id, metadata)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            actor_id, school_id, action_type, entity_type, entity_id,
            json.dumps(metadata or {})
        )
    except:
        pass

# ============================================
# SOCKET.IO EVENT HANDLERS
# ============================================

@sio.event
async def connect(sid, environ, auth):
    """Authenticate via JWT in auth payload, join user room, mark online."""
    token = (auth or {}).get("token")
    if not token:
        raise ConnectionRefusedError("auth_failed")

    payload = verify_token(token)
    if not payload or not payload.get("sub"):
        raise ConnectionRefusedError("auth_failed")

    user_id = str(payload["sub"])
    user_info = {
        "user_id": user_id,
        "role": payload.get("role"),
        "school_id": payload.get("school_id"),
    }

    # Cancel any pending offline task (reconnect scenario)
    cancel_offline_task(user_id)

    register_sid(sid, user_info)
    await sio.enter_room(sid, f"user_{user_id}")

    try:
        await execute_write(
            "UPDATE users SET is_online = true WHERE id = $1",
            user_id,
        )
    except Exception:
        pass

    print(f"[SIO] connect sid={sid} user={user_id}")


@sio.event
async def disconnect(sid):
    """Remove sid from registry; debounce offline update if no more connections."""
    user_info = unregister_sid(sid)
    if not user_info:
        return

    user_id = user_info["user_id"]
    print(f"[SIO] disconnect sid={sid} user={user_id}")

    # Only start offline timer if user has no other connected sessions
    if not sids_for_user(user_id):
        async def delayed_offline():
            await asyncio.sleep(7)
            try:
                await execute_write(
                    "UPDATE users SET is_online = false, last_seen_at = NOW() WHERE id = $1",
                    user_id,
                )
            except Exception:
                pass

        set_offline_task(user_id, asyncio.create_task(delayed_offline()))


@sio.event
async def typing_start(sid, data):
    user_info = get_user_for_sid(sid)
    if not user_info:
        return
    user_id = user_info["user_id"]
    conversation_id = (data or {}).get("conversation_id")
    if not conversation_id:
        return

    conv = await execute_one(
        "SELECT participant_a_id, participant_b_id FROM chat_conversations WHERE id = $1",
        conversation_id,
    )
    if conv:
        other_id = (
            str(conv["participant_b_id"])
            if str(conv["participant_a_id"]) == user_id
            else str(conv["participant_a_id"])
        )
        await sio.emit(
            "typing",
            {"conversation_id": conversation_id, "user_id": user_id},
            room=f"user_{other_id}",
        )


@sio.event
async def typing_stop(sid, data):
    user_info = get_user_for_sid(sid)
    if not user_info:
        return
    user_id = user_info["user_id"]
    conversation_id = (data or {}).get("conversation_id")
    if not conversation_id:
        return

    conv = await execute_one(
        "SELECT participant_a_id, participant_b_id FROM chat_conversations WHERE id = $1",
        conversation_id,
    )
    if conv:
        other_id = (
            str(conv["participant_b_id"])
            if str(conv["participant_a_id"]) == user_id
            else str(conv["participant_a_id"])
        )
        await sio.emit(
            "typing_stop",
            {"conversation_id": conversation_id, "user_id": user_id},
            room=f"user_{other_id}",
        )


@sio.event
async def mark_read(sid, data):
    user_info = get_user_for_sid(sid)
    if not user_info:
        return
    user_id = user_info["user_id"]
    message_id = (data or {}).get("message_id")
    if message_id:
        try:
            await execute_write(
                "UPDATE chat_messages SET is_read = true, delivery_status = 'read' WHERE id = $1 AND sender_id != $2",
                message_id,
                user_id,
            )
        except Exception:
            pass

# ============================================
# REST ENDPOINTS
# ============================================

@router.get("/conversations")
async def list_conversations(
    user: dict = Depends(get_user_from_token),
    page: int = 1,
    page_size: int = 30
):
    """List conversations for user"""
    try:
        user_id = user["user_id"]

        # Get user's school_id and role
        user_data = await execute_one(
            "SELECT school_id, role FROM users WHERE id = $1",
            user_id
        )
        school_id = user_data.get("school_id") if user_data else None
        user_role = user_data.get("role") if user_data else user.get("role", "")

        # Only students may derive school_id from enrollments;
        # admin/super_admin intentionally have NULL school_id — don't try the fallback
        if not school_id and user_role == "student":
            enrollment = await execute_one(
                """SELECT s.id AS school_id
                   FROM enrollments e
                   JOIN classes c ON e.class_id = c.id
                   JOIN branches b ON c.branch_id = b.id
                   JOIN schools s ON b.school_id = s.id
                   WHERE e.student_id = $1 LIMIT 1""",
                user_id
            )
            if enrollment:
                school_id = enrollment.get("school_id")

        # Query conversations where user is a participant
        offset = (page - 1) * page_size
        # Admin/super_admin have school_id=NULL — skip school filter so they see all their convos
        if not school_id:
            conversations = await execute_query(
                """SELECT
                    cc.id, cc.status, cc.last_message_at, cc.last_message_preview,
                    cc.participant_a_id, cc.participant_b_id,
                    (CASE
                        WHEN cc.participant_a_id = $1 THEN cc.participant_b_id
                        ELSE cc.participant_a_id
                    END) as other_user_id,
                    (CASE
                        WHEN cc.participant_a_id = $1 THEN (SELECT full_name FROM users WHERE id = cc.participant_b_id)
                        ELSE (SELECT full_name FROM users WHERE id = cc.participant_a_id)
                    END) as full_name,
                    (CASE
                        WHEN cc.participant_a_id = $1 THEN (SELECT role FROM users WHERE id = cc.participant_b_id)
                        ELSE (SELECT role FROM users WHERE id = cc.participant_a_id)
                    END) as other_user_role,
                    (SELECT COUNT(*) FROM chat_messages cm
                     WHERE cm.conversation_id = cc.id
                     AND cm.is_read = false
                     AND cm.sender_id != $1) as unread_count
                   FROM chat_conversations cc
                   WHERE (cc.participant_a_id = $1 OR cc.participant_b_id = $1)
                   ORDER BY cc.last_message_at DESC NULLS LAST
                   LIMIT $2 OFFSET $3""",
                user_id, page_size, offset
            )
        else:
            conversations = await execute_query(
                """SELECT
                    cc.id, cc.status, cc.last_message_at, cc.last_message_preview,
                    cc.participant_a_id, cc.participant_b_id,
                    (CASE
                        WHEN cc.participant_a_id = $2 THEN cc.participant_b_id
                        ELSE cc.participant_a_id
                    END) as other_user_id,
                    (CASE
                        WHEN cc.participant_a_id = $2 THEN (SELECT full_name FROM users WHERE id = cc.participant_b_id)
                        ELSE (SELECT full_name FROM users WHERE id = cc.participant_a_id)
                    END) as full_name,
                    (CASE
                        WHEN cc.participant_a_id = $2 THEN (SELECT role FROM users WHERE id = cc.participant_b_id)
                        ELSE (SELECT role FROM users WHERE id = cc.participant_a_id)
                    END) as other_user_role,
                    (SELECT COUNT(*) FROM chat_messages cm
                     WHERE cm.conversation_id = cc.id
                     AND cm.is_read = false
                     AND cm.sender_id != $2) as unread_count
                   FROM chat_conversations cc
                   WHERE cc.school_id = $1
                   AND (cc.participant_a_id = $2 OR cc.participant_b_id = $2)
                   ORDER BY cc.last_message_at DESC NULLS LAST
                   LIMIT $3 OFFSET $4""",
                school_id, user_id, page_size, offset
            )

        # Convert to simple format
        result = [
            {
                'id': conv.get('id'),
                'status': conv.get('status'),
                'last_message_at': conv.get('last_message_at').isoformat() if conv.get('last_message_at') else None,
                'last_message_preview': conv.get('last_message_preview'),
                'full_name': conv.get('full_name') or 'Unknown',
                'other_user_id': str(conv.get('other_user_id')) if conv.get('other_user_id') else None,
                'other_user_role': conv.get('other_user_role'),
                'unread_count': int(conv.get('unread_count') or 0)
            }
            for conv in conversations
        ]

        return {
            "data": result,
            "page": page,
            "page_size": page_size,
            "total": len(result)
        }
    except Exception as e:
        print(f"ERROR in list_conversations: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error listing conversations: {str(e)}")

@router.post("/conversations")
async def create_conversation(
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Create or find conversation"""
    user_id = user["user_id"]
    role = user["role"]
    recipient_id = body.get("recipient_id")
    request_message = body.get("request_message", "")[:MAX_REQUEST_MESSAGE_LENGTH]

    # Fetch user's current school_id from database (ensures it's not NULL from stale JWT)
    user_data = await execute_one(
        "SELECT school_id, role FROM users WHERE id = $1",
        user_id
    )
    school_id = user_data.get("school_id") if user_data else None
    role = user_data.get("role", role) if user_data else role
    print(f"DEBUG [create_conversation]: User {user_id} has school_id from DB: {school_id}")

    # If user doesn't have school_id and is a student, derive from enrollment
    if not school_id and role == "student":
        print(f"DEBUG [create_conversation]: Student has no school_id, checking enrollments...")
        enrollment = await execute_one(
            """SELECT s.id AS school_id
               FROM enrollments e
               JOIN classes c ON e.class_id = c.id
               JOIN branches b ON c.branch_id = b.id
               JOIN schools s ON b.school_id = s.id
               WHERE e.student_id = $1 LIMIT 1""",
            user_id
        )
        if enrollment:
            school_id = enrollment.get("school_id")
            print(f"DEBUG [create_conversation]: Found enrollment with school_id: {school_id}")

    # If still no school_id (admin/super_admin), use recipient's school_id
    if not school_id:
        recipient_data = await execute_one(
            "SELECT school_id FROM users WHERE id = $1",
            recipient_id
        )
        if recipient_data:
            school_id = recipient_data.get("school_id")
            print(f"DEBUG [create_conversation]: Using recipient school_id: {school_id}")

    # Student-to-student block
    recipient = await execute_one("SELECT role FROM users WHERE id = $1", recipient_id)
    if not recipient:
        raise HTTPException(403, "User not found")

    if role == "student" and recipient["role"] == "student":
        raise HTTPException(403, "Students cannot message other students")

    # No eligibility restriction — any school member can message any other school member
    # (student→student is already blocked above)

    # Create conversation_key
    conv_key = f"{min(user_id, recipient_id)}:{max(user_id, recipient_id)}"

    # Try to find existing conversation
    existing = await execute_one(
        "SELECT * FROM chat_conversations WHERE conversation_key = $1",
        conv_key
    )

    if existing:
        # If existing conversation has NULL school_id, update it
        if existing.get("school_id") is None and school_id:
            print(f"DEBUG [create_conversation]: Updating existing conversation {existing['id']} with school_id={school_id}")
            await execute_write(
                "UPDATE chat_conversations SET school_id = $1 WHERE id = $2",
                school_id, existing["id"]
            )
            existing["school_id"] = school_id
        return dict(existing)

    # Create new conversation
    conv_id = str(uuid.uuid4())
    # Only student→teacher requires a request/accept step
    recipient_role = recipient["role"]
    needs_request = (role == "student" and recipient_role == "teacher")
    status = "pending" if needs_request else "active"

    print(f"DEBUG [create_conversation]: Inserting conversation {conv_id} with school_id={school_id}, initiator={user_id}, recipient={recipient_id}")
    await execute_write(
        """INSERT INTO chat_conversations
           (id, school_id, participant_a_id, participant_b_id, conversation_key, initiator_id, status, request_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        conv_id, school_id, min(user_id, recipient_id), max(user_id, recipient_id),
        conv_key, user_id, status, request_message
    )
    print(f"DEBUG [create_conversation]: Conversation inserted successfully")

    # Insert notification for teacher
    if role == "student":
        # Fetch student's full_name for notification
        student_data = await execute_one(
            "SELECT full_name FROM users WHERE id = $1",
            user_id
        )
        student_name = student_data["full_name"] if student_data else "Student"

        await execute_write(
            """INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
               VALUES ($1, 'chat_request', 'New chat request', $2, 'conversation', $3)""",
            recipient_id, f"New message from {student_name}", conv_id
        )

    # Fetch and return full conversation object with participant's full_name
    new_conv = await execute_one(
        """SELECT cc.*,
                  (CASE
                    WHEN cc.participant_a_id = $2 THEN (SELECT full_name FROM users WHERE id = cc.participant_b_id)
                    ELSE (SELECT full_name FROM users WHERE id = cc.participant_a_id)
                   END) as full_name
           FROM chat_conversations cc
           WHERE cc.id = $1""",
        conv_id, user_id
    )
    if new_conv:
        result = dict(new_conv)
        result['unread_count'] = 0
        return result
    else:
        return {
            "id": conv_id,
            "conversation_key": conv_key,
            "status": status,
            "school_id": school_id,
            "full_name": "Unknown",
            "unread_count": 0
        }

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    user: dict = Depends(get_user_from_token),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
):
    """Get paginated messages from conversation"""
    user_id = user["user_id"]

    # Verify user is in conversation
    conv = await execute_one(
        "SELECT * FROM chat_conversations WHERE id = $1 AND (participant_a_id = $2 OR participant_b_id = $2)",
        conversation_id, user_id
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Mark messages as read
    await execute_write(
        "UPDATE chat_messages SET is_read = true, delivery_status = 'read' WHERE conversation_id = $1 AND sender_id != $2",
        conversation_id, user_id
    )

    # Get messages (exclude hard-deleted ones, but respect soft-delete per participant)
    offset = (page - 1) * page_size
    messages = await execute_query(f"""
        SELECT * FROM chat_messages
        WHERE conversation_id = $1 AND is_deleted = false
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
    """, conversation_id, page_size, offset)

    # Update conversation_reads
    if messages:
        last_msg = messages[0]["id"]
        await execute_write(
            """INSERT INTO chat_conversation_reads (conversation_id, user_id, last_seen_message_id, updated_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (conversation_id, user_id) DO UPDATE SET
               last_seen_message_id = $3, updated_at = NOW()""",
            conversation_id, user_id, last_msg
        )

    return {"data": [dict(m) for m in messages], "page": page, "page_size": page_size}

@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    request: MessageRequest,
    user: dict = Depends(get_user_from_token),
):
    """Send text message"""
    user_id = user["user_id"]
    content = request.content[:MAX_MESSAGE_LENGTH]

    # Sanitize content
    content = bleach.clean(content, tags=[], strip=True)
    if not content:
        raise HTTPException(400, "Message cannot be empty")

    # Verify user in conversation
    conv = await execute_one(
        """SELECT * FROM chat_conversations WHERE id = $1
           AND (participant_a_id = $2 OR participant_b_id = $2)""",
        conversation_id, user_id
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Check blocking
    if conv["blocked_by_teacher"]:
        raise HTTPException(403, "You are blocked in this conversation")

    # Check muted
    if conv["is_muted"]:
        raise HTTPException(403, "This conversation is muted")

    # Check pending + student
    if conv["status"] == "pending" and user["role"] == "student":
        raise HTTPException(403, "Waiting for teacher to accept")

    # Check burst rate limit (students only)
    if user["role"] == "student":
        recent_count = await execute_one(
            """SELECT COUNT(*) as cnt FROM chat_messages
               WHERE conversation_id = $1 AND sender_id = $2
               AND created_at > NOW() - INTERVAL '10 seconds'""",
            conversation_id, user_id
        )
        if recent_count and recent_count["cnt"] >= MAX_BURST_MESSAGES:
            raise HTTPException(429, "Message rate limit exceeded")

    # Create message
    msg_id = str(uuid.uuid4())
    try:
        await execute_write(
            """INSERT INTO chat_messages
               (id, conversation_id, sender_id, message_type, content, delivery_status)
               VALUES ($1, $2, $3, 'text', $4, 'sent')""",
            msg_id, conversation_id, user_id, content
        )
        print(f"[OK] Message inserted: {msg_id}")
    except Exception as e:
        print(f"[ERROR] Failed to insert message: {str(e)}")
        raise

    # Update conversation metadata
    try:
        await execute_write(
            """UPDATE chat_conversations
               SET last_message_at = NOW(), last_message_preview = $2, last_message_sender_id = $3
               WHERE id = $1""",
            conversation_id, content[:100], user_id
        )
        print(f"[OK] Conversation updated")
    except Exception as e:
        print(f"[ERROR] Failed to update conversation: {str(e)}")
        raise

    # Insert notification for recipient
    recipient_id = (
        str(conv["participant_b_id"])
        if str(conv["participant_a_id"]) == user_id
        else str(conv["participant_a_id"])
    )

    # Fetch sender's full_name from database
    sender = await execute_one("SELECT full_name FROM users WHERE id = $1", user_id)
    sender_name = sender.get("full_name") if sender else "Unknown"

    await execute_write(
        """INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
           VALUES ($1, 'chat_message', 'New message', $2, 'message', $3)""",
        recipient_id, f"Message from {sender_name}", msg_id
    )

    # Send via Socket.IO to both recipient AND sender
    message_data = {
        "type": "new_message",
        "message_id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "sender_name": sender_name,
        "content": content,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Send to recipient
    await sio.emit("new_message", message_data, room=f"user_{recipient_id}")

    # Send to sender (so they see it immediately)
    await sio.emit("new_message", message_data, room=f"user_{user_id}")

    return {
        "id": msg_id,
        "status": "sent",
        "message": {
            "id": msg_id,
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "content": content,
            "created_at": datetime.utcnow().isoformat(),
            "delivery_status": "sent"
        }
    }

@router.post("/conversations/{conversation_id}/upload")
async def upload_file(
    conversation_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_user_from_token),
):
    """Upload file attachment"""
    user_id = user["user_id"]
    school_id = user["school_id"]

    # Verify conversation
    conv = await execute_one(
        """SELECT * FROM chat_conversations WHERE id = $1
           AND (participant_a_id = $2 OR participant_b_id = $2)""",
        conversation_id, user_id
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    if conv["blocked_by_teacher"]:
        raise HTTPException(403, "You are blocked")

    if not conv["attachments_allowed"]:
        raise HTTPException(403, "Attachments not allowed in this conversation")

    # File validation
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""

    # Read file
    contents = await file.read()
    file_size = len(contents)

    # Detect MIME type
    try:
        mime = magic.from_buffer(contents, mime=True)
    except:
        mime = "application/octet-stream"

    # Determine category and validate
    category = get_file_category(mime, filename)

    if category not in ["image", "pdf", "document", "voice"]:
        raise HTTPException(400, "File type not allowed")

    if file_size > MAX_FILE_SIZE.get(category, 10_000_000):
        raise HTTPException(413, f"File too large (max {MAX_FILE_SIZE[category]} bytes)")

    # Check quotas (students only)
    if user["role"] == "student":
        settings = await get_school_chat_settings(school_id)

        if category == "voice":
            monthly_count = await execute_one(
                """SELECT COUNT(*) as cnt FROM chat_messages
                   WHERE sender_id = $1 AND attachment_category = 'voice'
                   AND created_at > NOW() - INTERVAL '30 days'""",
                user_id
            )
            if monthly_count and monthly_count["cnt"] >= settings.get("student_voice_monthly_limit", 50):
                raise HTTPException(429, "Voice note monthly limit exceeded")
        else:
            monthly_count = await execute_one(
                """SELECT COUNT(*) as cnt FROM chat_messages
                   WHERE sender_id = $1 AND file_url IS NOT NULL
                   AND created_at > NOW() - INTERVAL '30 days'""",
                user_id
            )
            if monthly_count and monthly_count["cnt"] >= settings.get("student_monthly_upload_limit", 100):
                raise HTTPException(429, "Upload monthly limit exceeded")

    # Store file with UUID name
    safe_filename = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
    category_dir = "images" if category == "image" else ("voice" if category == "voice" else "files")
    file_path = os.path.join("static", "chat_uploads", category_dir, safe_filename)

    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(contents)

    file_url = f"/static/chat_uploads/{category_dir}/{safe_filename}"

    # Create message with attachment
    msg_id = str(uuid.uuid4())
    await execute_write(
        """INSERT INTO chat_messages
           (id, conversation_id, sender_id, message_type, file_url, file_name, file_size_bytes,
            mime_type, attachment_category, delivery_status)
           VALUES ($1, $2, $3, 'file', $4, $5, $6, $7, $8, 'sent')""",
        msg_id, conversation_id, user_id, file_url, filename, file_size,
        mime, category
    )

    # Update conversation
    await execute_write(
        """UPDATE chat_conversations
           SET last_message_at = NOW(), last_message_preview = $2, last_message_sender_id = $3
           WHERE id = $1""",
        conversation_id, f"📎 {filename}", user_id
    )

    # Notify recipient
    recipient_id = (
        str(conv["participant_b_id"])
        if str(conv["participant_a_id"]) == user_id
        else str(conv["participant_a_id"])
    )
    await sio.emit(
        "new_message",
        {
            "type": "new_message",
            "message_id": msg_id,
            "conversation_id": conversation_id,
            "sender_id": user_id,
            "file_url": file_url,
            "file_name": filename,
            "attachment_category": category,
            "created_at": datetime.utcnow().isoformat(),
        },
        room=f"user_{recipient_id}",
    )

    return {"id": msg_id, "file_url": file_url, "category": category}

@router.patch("/conversations/{conversation_id}/request")
async def respond_to_request(
    conversation_id: str,
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Teacher responds to pending chat request"""
    user_id = user["user_id"]
    action = body.get("action")  # accept, reject, block

    if user["role"] != "teacher":
        raise HTTPException(403, "Only teachers can respond to requests")

    if action not in ["accept", "reject", "block"]:
        raise HTTPException(400, "Invalid action")

    # Verify teacher is recipient
    conv = await execute_one(
        """SELECT * FROM chat_conversations WHERE id = $1
           AND (participant_a_id = $2 OR participant_b_id = $2)""",
        conversation_id, user_id
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    if conv["status"] != "pending":
        raise HTTPException(400, "Conversation is not pending")

    new_status = "active" if action == "accept" else ("rejected" if action == "reject" else "blocked")

    await execute_write(
        """UPDATE chat_conversations
           SET status = $2, request_responded_at = NOW(), blocked_by_teacher = $3
           WHERE id = $1""",
        conversation_id, new_status, action == "block"
    )

    # Log action
    await log_audit(
        user_id, user["school_id"], "teacher_responded_to_request",
        "conversation", conversation_id, {"action": action}
    )

    return {"status": new_status}

@router.patch("/conversations/{conversation_id}/controls")
async def update_conversation_controls(
    conversation_id: str,
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Teacher controls: mute, restrict, slow mode, archive, block"""
    user_id = user["user_id"]

    if user["role"] != "teacher":
        raise HTTPException(403, "Only teachers can control conversations")

    conv = await execute_one(
        """SELECT * FROM chat_conversations WHERE id = $1
           AND (participant_a_id = $2 OR participant_b_id = $2)""",
        conversation_id, user_id
    )
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Build update
    updates = []
    params = [conversation_id]
    param_idx = 2

    if "is_muted" in body:
        updates.append(f"is_muted = ${param_idx}")
        params.append(body["is_muted"])
        param_idx += 1

    if "is_restricted" in body:
        updates.append(f"is_restricted = ${param_idx}")
        params.append(body["is_restricted"])
        param_idx += 1

    if "slow_mode_seconds" in body:
        updates.append(f"slow_mode_seconds = ${param_idx}")
        params.append(body["slow_mode_seconds"])
        param_idx += 1

    if "archived_by_teacher" in body:
        updates.append(f"archived_by_teacher = ${param_idx}")
        params.append(body["archived_by_teacher"])
        param_idx += 1

    if "blocked_by_teacher" in body:
        updates.append(f"blocked_by_teacher = ${param_idx}")
        params.append(body["blocked_by_teacher"])
        param_idx += 1
        if body["blocked_by_teacher"]:
            updates.append(f"blocked_at = NOW()")

    if updates:
        await execute_write(
            f"UPDATE chat_conversations SET {', '.join(updates)} WHERE id = $1",
            *params
        )

        # Log
        await log_audit(
            user_id, user["school_id"], "teacher_updated_controls",
            "conversation", conversation_id, body
        )

    return {"success": True}

@router.get("/school-members")
async def get_school_members(
    user: dict = Depends(get_user_from_token),
    q: str = Query("", description="Search query (name/email)"),
):
    """Search for school members to start a conversation with"""
    user_id = user["user_id"]
    role = user["role"]

    # Get school_id from DB
    user_data = await execute_one(
        "SELECT school_id FROM users WHERE id = $1",
        user_id
    )
    school_id = user_data.get("school_id") if user_data else None

    # For students without school_id, try enrollment
    if not school_id and role == "student":
        enrollment = await execute_one(
            """SELECT c.school_id FROM enrollments e
               JOIN classes c ON e.class_id = c.id
               WHERE e.student_id = $1 LIMIT 1""",
            user_id
        )
        if enrollment:
            school_id = enrollment.get("school_id")

    if not school_id:
        return {"data": []}

    # Students can only see teachers/managers/admins (not other students)
    if role == "student":
        role_filter = "AND u.role IN ('teacher', 'manager', 'admin')"
    else:
        role_filter = "AND u.role IN ('student', 'teacher', 'manager', 'admin')"

    search_pattern = f"%{q}%" if q.strip() else "%"

    members = await execute_query(
        f"""SELECT u.id, u.full_name, u.email, u.role,
                   COALESCE(u.is_online, false) as is_online, u.last_seen_at
            FROM users u
            WHERE u.school_id = $1
            AND u.id != $2
            AND u.is_active = true
            {role_filter}
            AND (u.full_name ILIKE $3 OR u.email ILIKE $3)
            ORDER BY u.full_name
            LIMIT 20""",
        school_id, user_id, search_pattern
    )

    return {"data": [dict(m) for m in members]}


@router.get("/eligible-teachers")
async def get_eligible_teachers(
    user: dict = Depends(get_user_from_token),
):
    """Get list of teachers student can contact"""
    if user["role"] != "student":
        raise HTTPException(403, "Only students can view eligible teachers")

    user_id = user["user_id"]

    # Fetch current school_id from database (JWT might be stale)
    student_data = await execute_one(
        "SELECT school_id FROM users WHERE id = $1",
        user_id
    )
    print(f"DEBUG: Student data from DB: {student_data}")
    school_id = student_data["school_id"] if student_data else None
    print(f"DEBUG: Extracted school_id: {school_id} (type: {type(school_id)})")

    print(f"DEBUG: Getting eligible teachers for student {user_id} in school {school_id}")

    # Get teachers assigned to student's enrolled classes via teacher_class_subject_assignments
    teachers = await execute_query("""
        SELECT DISTINCT u.id, u.full_name, u.email,
               CASE WHEN u.accept_new_requests = false THEN true ELSE false END as busy,
               CASE WHEN u.is_online = true THEN 'online' ELSE 'offline' END as presence,
               u.last_seen_at
        FROM enrollments e
        JOIN teacher_class_subject_assignments tcsa ON tcsa.class_id = e.class_id
        JOIN users u ON u.id = tcsa.teacher_id
        WHERE e.student_id = $1 AND e.is_active = true
        ORDER BY u.full_name
    """, user_id)

    print(f"DEBUG: Found {len(teachers)} teachers")
    return {"data": [dict(t) for t in teachers]}


@router.get("/eligible-contacts")
async def get_eligible_contacts(user: dict = Depends(get_user_from_token)):
    """Return grouped suggested contacts based on the caller's role."""
    user_id = user["user_id"]
    role = user["role"]

    user_data = await execute_one("SELECT school_id FROM users WHERE id = $1", user_id)
    school_id = user_data.get("school_id") if user_data else None

    groups = []

    if role == "student":
        rows = await execute_query("""
            SELECT DISTINCT u.id, u.full_name, u.email, u.role,
                   COALESCE(u.is_online, false) as is_online, u.last_seen_at
            FROM enrollments e
            JOIN teacher_class_subject_assignments tcsa ON tcsa.class_id = e.class_id
            JOIN users u ON u.id = tcsa.teacher_id
            WHERE e.student_id = $1 AND e.is_active = true
            ORDER BY u.full_name
        """, user_id)
        if rows:
            groups.append({"label": "Your Teachers", "members": [dict(r) for r in rows]})

    elif role == "teacher":
        # Students in teacher's classes
        students = await execute_query("""
            SELECT DISTINCT u.id, u.full_name, u.email, u.role,
                   COALESCE(u.is_online, false) as is_online, u.last_seen_at
            FROM teacher_class_subject_assignments tcsa
            JOIN enrollments e ON e.class_id = tcsa.class_id AND e.is_active = true
            JOIN users u ON u.id = e.student_id
            WHERE tcsa.teacher_id = $1
            ORDER BY u.full_name
        """, user_id)
        if students:
            groups.append({"label": "Students", "members": [dict(r) for r in students]})

        # Other teachers in same school
        teachers = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE school_id = $1 AND role = 'teacher' AND id != $2 AND is_active = true
            ORDER BY full_name
        """, school_id, user_id)
        if teachers:
            groups.append({"label": "Teachers", "members": [dict(r) for r in teachers]})

        # Managers of the school
        managers = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE school_id = $1 AND role = 'manager' AND is_active = true
            ORDER BY full_name
        """, school_id)
        if managers:
            groups.append({"label": "Managers", "members": [dict(r) for r in managers]})

    elif role == "manager":
        # Super admins (school_id is NULL for super_admins)
        super_admins = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE role = 'super_admin' AND is_active = true
            ORDER BY full_name
        """)
        if super_admins:
            groups.append({"label": "Super Admins", "members": [dict(r) for r in super_admins]})

        # Admins (may have NULL school_id — they are school-wide admins)
        admins = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE role = 'admin' AND (school_id = $1 OR school_id IS NULL) AND is_active = true
            ORDER BY full_name
        """, school_id)
        if admins:
            groups.append({"label": "Admins", "members": [dict(r) for r in admins]})

        # Teachers in the school
        teachers = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE school_id = $1 AND role = 'teacher' AND is_active = true
            ORDER BY full_name
        """, school_id)
        if teachers:
            groups.append({"label": "Teachers", "members": [dict(r) for r in teachers]})

    elif role == "admin":
        # Super admins
        super_admins = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE role = 'super_admin' AND is_active = true
            ORDER BY full_name
        """)
        if super_admins:
            groups.append({"label": "Super Admins", "members": [dict(r) for r in super_admins]})

        # Managers in the school
        managers = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE school_id = $1 AND role = 'manager' AND is_active = true
            ORDER BY full_name
        """, school_id)
        if managers:
            groups.append({"label": "Managers", "members": [dict(r) for r in managers]})

    elif role == "super_admin":
        # All admins
        admins = await execute_query("""
            SELECT id, full_name, email, role,
                   COALESCE(is_online, false) as is_online, last_seen_at
            FROM users
            WHERE role = 'admin' AND is_active = true
            ORDER BY full_name
        """)
        if admins:
            groups.append({"label": "Admins", "members": [dict(r) for r in admins]})

    return {"groups": groups}


@router.post("/announcements")
async def create_announcement(
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Teacher creates announcement"""
    if user["role"] != "teacher":
        raise HTTPException(403, "Only teachers can create announcements")

    user_id = user["user_id"]
    school_id = user["school_id"]

    content = body.get("content", "")[:MAX_ANNOUNCEMENT_LENGTH]
    title = body.get("title", "")[:255]
    priority = body.get("priority", "normal")
    class_id = body.get("class_id")
    subject_id = body.get("subject_id")
    homework_id = body.get("homework_id")
    exam_id = body.get("exam_id")
    lecture_id = body.get("lecture_id")
    requires_acknowledgement = body.get("requires_acknowledgement", False)
    expires_at = body.get("expires_at")  # ISO string or None

    if priority not in ANNOUNCEMENT_PRIORITY:
        raise HTTPException(400, "Invalid priority")

    if not content:
        raise HTTPException(400, "Content required")

    # Validate teacher can broadcast to this class/subject
    if class_id or subject_id:
        can_broadcast = await validate_teacher_can_broadcast(user_id, class_id, subject_id)
        if not can_broadcast:
            raise HTTPException(403, "You cannot broadcast to this class")

    # Create announcement
    ann_id = str(uuid.uuid4())
    await execute_write(
        """INSERT INTO chat_announcements
           (id, teacher_id, school_id, class_id, subject_id, homework_id, exam_id, lecture_id,
            title, content, priority, requires_acknowledgement, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)""",
        ann_id, user_id, school_id, class_id, subject_id, homework_id, exam_id, lecture_id,
        title, content, priority, requires_acknowledgement,
        expires_at if expires_at else None
    )

    # Get students to notify
    if class_id:
        students = await execute_query(
            """SELECT student_id FROM enrollments WHERE class_id = $1""",
            class_id
        )
    elif subject_id:
        students = await execute_query(
            """SELECT DISTINCT e.student_id FROM enrollments e
               JOIN classes c ON e.class_id = c.id
               WHERE c.subject_id = $1""",
            subject_id
        )
    else:
        students = []

    # Create notifications
    for student_row in students:
        try:
            await execute_write(
                """INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
                   VALUES ($1, 'announcement', $2, $3, 'announcement', $4)""",
                student_row["student_id"], title or "New announcement", content[:100],
                ann_id
            )
        except:
            pass

    # Log
    await log_audit(
        user_id, school_id, "announcement_created",
        "announcement", ann_id
    )

    return {"id": ann_id, "priority": priority}

@router.get("/announcements")
async def list_announcements(
    user: dict = Depends(get_user_from_token),
):
    """Get announcements for student's enrolled classes"""
    if user["role"] != "student":
        raise HTTPException(403, "Only students can view announcements")

    user_id = user["user_id"]

    announcements = await execute_query("""
        SELECT ca.*, u.full_name as teacher_name
        FROM chat_announcements ca
        JOIN users u ON ca.teacher_id = u.id
        WHERE ca.class_id IN (
            SELECT c.id FROM classes c
            JOIN enrollments e ON e.class_id = c.id
            WHERE e.student_id = $1
        )
        AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
        ORDER BY
            CASE WHEN ca.priority = 'urgent' THEN 0
                 WHEN ca.priority = 'important' THEN 1
                 ELSE 2 END,
            ca.created_at DESC
    """, user_id)

    # Check read status for each
    result = []
    for ann in announcements:
        read = await execute_one(
            "SELECT * FROM chat_announcement_reads WHERE announcement_id = $1 AND student_id = $2",
            ann["id"], user_id
        )
        ann_dict = dict(ann)
        ann_dict["is_read"] = read is not None
        ann_dict["is_acknowledged"] = read["acknowledged"] if read else False
        result.append(ann_dict)

    return {"data": result}

@router.post("/announcements/{announcement_id}/read")
async def mark_announcement_read(
    announcement_id: str,
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Mark announcement as read/acknowledged"""
    if user["role"] != "student":
        raise HTTPException(403, "Only students can acknowledge")

    user_id = user["user_id"]
    acknowledged = body.get("acknowledged", False)

    await execute_write(
        """INSERT INTO chat_announcement_reads (announcement_id, student_id, acknowledged, read_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (announcement_id, student_id) DO UPDATE SET
           acknowledged = $3, read_at = NOW()""",
        announcement_id, user_id, acknowledged
    )

    return {"acknowledged": acknowledged}

@router.get("/unread-count")
async def get_unread_count(
    user: dict = Depends(get_user_from_token),
):
    """Get total unread count for badge"""
    user_id = user["user_id"]

    # Unread messages
    msg_count = await execute_one(
        """SELECT COUNT(*) as cnt FROM chat_messages
           WHERE is_read = false AND sender_id != $1
           AND conversation_id IN (
               SELECT id FROM chat_conversations
               WHERE (participant_a_id = $1 OR participant_b_id = $1)
               AND NOT (CASE WHEN participant_a_id = $1 THEN deleted_by_a ELSE deleted_by_b END)
           )""",
        user_id
    )

    # Unread announcements
    ann_count = await execute_one(
        """SELECT COUNT(*) as cnt FROM chat_announcements ca
           WHERE ca.class_id IN (
               SELECT c.id FROM classes c
               JOIN enrollments e ON e.class_id = c.id
               WHERE e.student_id = $1
           )
           AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
           AND ca.id NOT IN (
               SELECT announcement_id FROM chat_announcement_reads
               WHERE student_id = $1
           )""",
        user_id
    )

    return {
        "message_count": msg_count["cnt"] if msg_count else 0,
        "announcement_count": ann_count["cnt"] if ann_count else 0,
        "total": (msg_count["cnt"] if msg_count else 0) + (ann_count["cnt"] if ann_count else 0),
    }

@router.patch("/busy-mode")
async def toggle_busy_mode(
    body: dict,
    user: dict = Depends(get_user_from_token),
):
    """Teacher toggle busy mode (accept_new_requests)"""
    if user["role"] != "teacher":
        raise HTTPException(403, "Only teachers can set busy mode")

    user_id = user["user_id"]
    accept = body.get("accept_new_requests", True)

    await execute_write(
        "UPDATE users SET accept_new_requests = $1 WHERE id = $2",
        accept, user_id
    )

    return {"accept_new_requests": accept}

@router.get("/presence/{user_id}")
async def get_presence(
    user_id: str,
    user: dict = Depends(get_user_from_token),
):
    """Get user presence status (teacher only)"""
    if user["role"] != "teacher":
        raise HTTPException(403, "Only teachers can view student presence")

    target = await execute_one(
        "SELECT is_online, last_seen_at FROM users WHERE id = $1",
        user_id
    )
    if not target:
        raise HTTPException(404, "User not found")

    return {
        "is_online": target["is_online"],
        "last_seen_at": target["last_seen_at"],
    }
