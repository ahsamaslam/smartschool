"""
Authentication routes — Login, Logout, Password Reset, Profile.
"""
from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta

from app.utils.database import execute_one, execute_write, get_user_by_email
from app.utils.cache import set_user_session, delete_user_session
from app.utils.auth import (
    verify_password,
    hash_password,
    create_access_token,
    verify_token,
)
from app.utils.security import generate_secure_token
from app.utils.validators import validate_password_strength
from app.config import settings

router = APIRouter()


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    profile_picture_url: Optional[str] = None
    school_id: Optional[str] = None
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate a user and return a signed JWT access token.

    - Looks up the user by email.
    - Verifies the bcrypt password_hash stored in the users table
      (populated by seed.sql via pgcrypto, or by the change-password endpoint).
    - Returns a JWT whose payload contains sub=user_id and role=role.
    """
    user = await get_user_by_email(credentials.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account password not configured. Contact your administrator.",
        )

    if not verify_password(credentials.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["id"])

    # Build JWT (include school_id so manager scoping works without extra DB hit)
    token = create_access_token(
        data={
            "sub": user_id,
            "role": user["role"],
            "email": user["email"],
            "school_id": str(user["school_id"]) if user.get("school_id") else None,
        }
    )

    # Cache the session for quick lookups (optional but keeps parity with existing code)
    session_data = {
        "user_id": user_id,
        "email": user["email"],
        "role": user["role"],
        "login_time": datetime.now().isoformat(),
    }
    await set_user_session(user_id, session_data, expire=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    return LoginResponse(
        user_id=user_id,
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        profile_picture_url=user.get("profile_picture_url"),
        school_id=str(user["school_id"]) if user.get("school_id") else None,
        token=token,
    )


@router.post("/logout")
async def logout(user_id: str):
    """Invalidate cached session. Frontend should discard the JWT."""
    await delete_user_session(user_id)
    return {"message": "Logged out successfully"}


# ============================================
# PASSWORD RESET
# ============================================

@router.post("/password-reset/request")
async def request_password_reset(request: PasswordResetRequest):
    """Generate a password-reset token and (in production) email it to the user."""
    user = await get_user_by_email(request.email)

    # Security: don't reveal whether the email exists
    if not user:
        return {"message": "If the email exists, a password reset link has been sent"}

    reset_token = generate_secure_token()
    expires_at = datetime.now() + timedelta(hours=24)

    query = """
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
    """
    await execute_write(query, user["id"], reset_token, expires_at)

    # TODO: Send email in production. In DEBUG mode expose the link for testing.
    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"

    return {
        "message": "If the email exists, a password reset link has been sent",
        "reset_link": reset_link if settings.DEBUG else None,
        "token": reset_token if settings.DEBUG else None,
    }


@router.post("/password-reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    """Apply a new password using a valid, unused, unexpired reset token."""
    err = validate_password_strength(request.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    query = """
        SELECT user_id, expires_at, is_used
        FROM password_reset_tokens
        WHERE token = $1
    """
    token_data = await execute_one(query, request.token)

    if not token_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    if token_data["is_used"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token already used")

    if token_data["expires_at"] < datetime.now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    new_hash = hash_password(request.new_password)

    await execute_write(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        new_hash,
        token_data["user_id"],
    )
    await execute_write(
        "UPDATE password_reset_tokens SET is_used = true WHERE token = $1",
        request.token,
    )

    return {"message": "Password reset successful"}


# ============================================
# CHANGE PASSWORD (authenticated)
# ============================================

@router.post("/password/change")
async def change_password(request: ChangePasswordRequest):
    """Change password for a logged-in user. Requires valid old password."""
    err = validate_password_strength(request.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    query = """
        SELECT password_hash FROM users WHERE id = $1 AND is_active = true
    """
    row = await execute_one(query, request.user_id)

    if not row or not row["password_hash"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(request.old_password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Old password is incorrect")

    new_hash = hash_password(request.new_password)
    await execute_write(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        new_hash,
        request.user_id,
    )

    return {"message": "Password changed successfully"}


# ============================================
# CURRENT USER
# ============================================

@router.get("/me")
async def get_current_user(user_id: str):
    """Return profile for *user_id* (passed as query param by the frontend)."""
    query = """
        SELECT id, email, full_name, role, profile_picture_url, created_at
        FROM users
        WHERE id = $1 AND is_active = true
    """
    user = await execute_one(query, user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return dict(user)


# ============================================
# PROFILE MANAGEMENT
# ============================================

@router.put("/profile/{user_id}")
async def update_profile(user_id: str, profile: UpdateProfileRequest):
    """Update display name and/or profile picture URL for a user."""
    updates = []
    params: list = []
    idx = 1

    if profile.full_name is not None:
        updates.append(f"full_name = ${idx}")
        params.append(profile.full_name)
        idx += 1

    if profile.profile_picture_url is not None:
        updates.append(f"profile_picture_url = ${idx}")
        params.append(profile.profile_picture_url)
        idx += 1

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No updates provided")

    params.append(user_id)
    query = f"""
        UPDATE users
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${idx}
        RETURNING id, email, full_name, profile_picture_url
    """
    updated = await execute_one(query, *params)

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return dict(updated)


# ============================================
# TOKEN VERIFICATION UTILITY (used by other routers)
# ============================================

async def get_user_from_token(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency — extracts and verifies the Bearer JWT from the
    Authorization header.

    Usage in a router:
        @router.get("/protected")
        async def protected(current_user: dict = Depends(get_user_from_token)):
            ...
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    token = authorization.split(" ", 1)[1]
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return {
        "user_id": payload["sub"],
        "role": payload["role"],
        "email": payload["email"],
        "school_id": payload.get("school_id"),
    }



# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    profile_picture_url: Optional[str]
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Login endpoint
    
    NOTE: For development, we're using Supabase Auth.
    In production, this integrates with Supabase authentication.
    For now, this is a simplified version for testing.
    """
    
    # Get user by email
    user = await get_user_by_email(credentials.email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # TODO: In production, verify password with Supabase Auth
    # For development, we'll generate a simple token
    
    # Generate session token (in production, use Supabase token)
    token = str(uuid.uuid4())
    
    # Store session in cache
    session_data = {
        "user_id": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "login_time": datetime.now().isoformat()
    }
    
    await set_user_session(str(user["id"]), session_data, expire=3600)
    
    return LoginResponse(
        user_id=str(user["id"]),
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        profile_picture_url=user.get("profile_picture_url"),
        token=token
    )


@router.post("/logout")
async def logout(user_id: str):
    """Logout and clear session"""
    
    await delete_user_session(user_id)
    
    return {
        "message": "Logged out successfully"
    }


@router.post("/password-reset/request")
async def request_password_reset(request: PasswordResetRequest):
    """
    Request password reset - generates token and sends email
    """
    
    # Check if user exists
    user = await get_user_by_email(request.email)
    
    if not user:
        # Don't reveal if email exists - security best practice
        return {
            "message": "If the email exists, a password reset link has been sent"
        }
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(hours=24)
    
    # Store token in database
    query = """
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
    """
    await execute_write(query, user["id"], reset_token, expires_at)
    
    # TODO: Send email with reset link
    # For development, return the token (in production, only send via email)
    reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
    
    return {
        "message": "Password reset link sent to email",
        "reset_link": reset_link if settings.DEBUG else None,
        "token": reset_token if settings.DEBUG else None
    }


@router.post("/password-reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    """
    Confirm password reset with token
    """
    
    # Verify token
    query = """
        SELECT user_id, expires_at, is_used
        FROM password_reset_tokens
        WHERE token = $1
    """
    token_data = await execute_one(query, request.token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    if token_data["is_used"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token already used"
        )
    
    if token_data["expires_at"] < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token expired"
        )
    
    # TODO: In production, hash password and update via Supabase Auth
    # For development, we'll just mark token as used
    
    # Mark token as used
    update_query = """
        UPDATE password_reset_tokens
        SET is_used = true
        WHERE token = $1
    """
    await execute_write(update_query, request.token)
    
    return {
        "message": "Password reset successful",
        "user_id": str(token_data["user_id"])
    }


@router.post("/password/change")
async def change_password(request: ChangePasswordRequest):
    """
    Change password for logged-in user
    """
    
    # TODO: Verify old password via Supabase Auth
    # TODO: Update password via Supabase Auth
    
    return {
        "message": "Password changed successfully"
    }


@router.get("/me")
async def get_current_user(user_id: str):
    """
    Get current user information
    """
    
    query = """
        SELECT id, email, full_name, role, profile_picture_url, created_at
        FROM users
        WHERE id = $1 AND is_active = true
    """
    
    user = await execute_one(query, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return dict(user)


# ============================================
# PROFILE MANAGEMENT
# ============================================

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None


@router.put("/profile/{user_id}")
async def update_profile(user_id: str, profile: UpdateProfileRequest):
    """Update user profile"""
    
    updates = []
    params = []
    param_count = 1
    
    if profile.full_name:
        updates.append(f"full_name = ${param_count}")
        params.append(profile.full_name)
        param_count += 1
    
    if profile.profile_picture_url:
        updates.append(f"profile_picture_url = ${param_count}")
        params.append(profile.profile_picture_url)
        param_count += 1
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates provided"
        )
    
    # Add user_id to params
    params.append(user_id)
    
    query = f"""
        UPDATE users
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING id, email, full_name, profile_picture_url
    """
    
    updated_user = await execute_one(query, *params)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return dict(updated_user)
