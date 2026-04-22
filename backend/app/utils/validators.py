"""
Input validators used across request handlers.
These are called at the application boundary — not inside business logic.
"""
import re
from typing import Optional


# ---------------------------------------------------------------------------
# Password
# ---------------------------------------------------------------------------
_MIN_PASSWORD_LENGTH = 8
_PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$"
)


def validate_password_strength(password: str) -> Optional[str]:
    """
    Validate password strength.

    Returns:
        None if valid; a human-readable error message if invalid.
    """
    if len(password) < _MIN_PASSWORD_LENGTH:
        return f"Password must be at least {_MIN_PASSWORD_LENGTH} characters."
    if not _PASSWORD_PATTERN.match(password):
        return (
            "Password must contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character (@$!%*?&_-#)."
        )
    return None


# ---------------------------------------------------------------------------
# File uploads
# ---------------------------------------------------------------------------
_ALLOWED_VIDEO_EXTENSIONS = {"mp4", "avi", "mov", "mkv", "webm"}
_ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
_ALLOWED_CSV_EXTENSIONS = {"csv"}


def validate_file_extension(filename: str, file_type: str = "video") -> Optional[str]:
    """
    Validate that *filename* has an allowed extension for *file_type*.

    Args:
        filename:  Original filename including extension.
        file_type: One of 'video', 'image', 'csv'.

    Returns:
        None if valid; error message string if invalid.
    """
    if not filename or "." not in filename:
        return "Filename must include an extension."

    ext = filename.rsplit(".", 1)[-1].lower()

    allowed: set
    if file_type == "video":
        allowed = _ALLOWED_VIDEO_EXTENSIONS
    elif file_type == "image":
        allowed = _ALLOWED_IMAGE_EXTENSIONS
    elif file_type == "csv":
        allowed = _ALLOWED_CSV_EXTENSIONS
    else:
        return f"Unknown file_type: {file_type}"

    if ext not in allowed:
        return f"'{ext}' is not allowed for {file_type} uploads. Allowed: {', '.join(sorted(allowed))}."
    return None


# ---------------------------------------------------------------------------
# UUID
# ---------------------------------------------------------------------------
_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def validate_uuid(value: str) -> bool:
    """Return True if *value* is a valid UUID4 string."""
    return bool(_UUID_PATTERN.match(value))


# ---------------------------------------------------------------------------
# Pagination params
# ---------------------------------------------------------------------------
def validate_pagination(page: int, page_size: int) -> Optional[str]:
    """Return error message if pagination params are out of range, else None."""
    if page < 1:
        return "page must be >= 1."
    if not (1 <= page_size <= 100):
        return "page_size must be between 1 and 100."
    return None
