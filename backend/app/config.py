import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None

    JWT_SECRET: str = "your-extremely-secure-jwt-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "Giặt Ký"

    # Brevo configurations
    BREVO_API_KEY: Optional[str] = None
    BREVO_API_URL: str = "https://api.brevo.com/v3/smtp/email"
    MAIL_FROM_EMAIL: str = "noreply@giatky.site"
    MAIL_FROM_NAME: str = "Giặt Ký"

    GOOGLE_CLIENT_ID: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
