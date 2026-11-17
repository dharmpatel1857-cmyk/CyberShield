from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginInput(BaseModel):
    login: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserView(BaseModel):
    id: int
    full_name: str
    username: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserView


class PageMetadata(BaseModel):
    https: bool | None = None
    title: str | None = Field(default=None, max_length=160)
    password_form_count: int = Field(default=0, ge=0, le=100)
    iframe_count: int = Field(default=0, ge=0, le=500)
    external_script_count: int = Field(default=0, ge=0, le=500)


class ScanCreate(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    page_metadata: PageMetadata | None = None


class ExtensionScanCreate(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class DetectionView(BaseModel):
    category: str
    severity: str
    evidence: str


class ScanView(BaseModel):
    id: int
    url: str
    domain: str
    risk_level: str
    risk_score: int
    confidence: float
    evidence: list[str]
    recommendations: list[str]
    page_metadata: dict
    created_at: datetime


class IncidentStatusUpdate(BaseModel):
    status: Literal["New", "Investigating", "Confirmed", "False Positive", "Resolved", "Archived"]


class NoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=4000)


class SettingsUpdate(BaseModel):
    theme: Literal["dark", "light", "system"] | None = None
    protection_enabled: bool | None = None
    sync_extension: bool | None = None
    ollama_model: str | None = Field(default=None, max_length=100)
    retention_days: int | None = Field(default=None, ge=1, le=3650)


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    scan_id: int | None = None


class ChatResponse(BaseModel):
    response: str
    model: str
    local: bool = True
