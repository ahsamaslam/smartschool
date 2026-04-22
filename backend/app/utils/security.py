"""
Security helpers — secure random tokens and input sanitisation.
Password hashing lives in utils/auth.py to keep dependencies centralised.
"""
import secrets
import string


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure URL-safe token.
    Used for password-reset links, invite tokens, etc.

    Args:
        length: Number of random bytes before URL-safe encoding.
                Resulting string will be slightly longer.

    Returns:
        URL-safe token string.
    """
    return secrets.token_urlsafe(length)


def generate_numeric_otp(digits: int = 6) -> str:
    """Generate a numeric OTP of *digits* length."""
    return "".join(secrets.choice(string.digits) for _ in range(digits))


def constant_time_compare(val1: str, val2: str) -> bool:
    """
    Compare two strings in constant time to prevent timing attacks.
    Wraps secrets.compare_digest.
    """
    return secrets.compare_digest(val1.encode(), val2.encode())
