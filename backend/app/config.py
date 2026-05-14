"""
Configuration settings for the Education Platform
"""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Education Platform API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Admin bootstrap user (sourced from env; upserted on startup)
    ADMIN_ID: str = "00000000-0000-0000-0000-000000000001"
    ADMIN_EMAIL: str = "admin@mail.com"
    ADMIN_FULL_NAME: str = "System Admin"
    ADMIN_ROLE: str = "super_admin"
    ADMIN_PASSWORD: str = "Admin@123"
    IMPORT_DEFAULT_PASSWORD: str = "ChangeMe@123"
    DEACTIVATE_NON_ADMIN_USERS: bool = False
    AUTO_CREATE_DEFAULT_TENANT: bool = False

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Claude API
    ANTHROPIC_API_KEY: str
    
    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "education-videos"
    R2_PUBLIC_URL: str = ""
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@education.com"
    
    # CORS — comma-separated list; include every browser origin (scheme+host+port) that loads the SPA.
    # Example: http://localhost:3000,http://127.0.0.1:3000
    # In DEBUG mode, the regex below allows all localhost ports anyway
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_VIDEO_EXTENSIONS: str = "mp4,avi,mov,mkv"
    ALLOWED_IMAGE_EXTENSIONS: str = "jpg,jpeg,png,gif"
    
    # D-ID Avatar API (https://studio.d-id.com)
    # Sign up for free trial (20 free videos), then pay ~$0.10/min via API plan.
    DID_API_KEY: str = ""
    DID_PRESENTER_URL: str = (
        "https://d-id-public-bucket.s3.us-east-1.amazonaws.com/alice.jpg"
    )
    DID_VOICE_ID: str = "en-US-JennyNeural"

    # Caching
    CACHE_DEFAULT_TIMEOUT: int = 300
    QA_CACHE_TIMEOUT: int = 86400  # 24 hours
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list (skip blanks — empty entries break browser CORS)."""
        if not (self.CORS_ORIGINS or "").strip():
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
    
    @property
    def allowed_video_extensions_list(self) -> List[str]:
        """Convert video extensions string to list"""
        return [ext.strip() for ext in self.ALLOWED_VIDEO_EXTENSIONS.split(",")]
    
    @property
    def allowed_image_extensions_list(self) -> List[str]:
        """Convert image extensions string to list"""
        return [ext.strip() for ext in self.ALLOWED_IMAGE_EXTENSIONS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    Using lru_cache ensures we only load settings once
    """
    return Settings()


# Convenience instance
settings = get_settings()
