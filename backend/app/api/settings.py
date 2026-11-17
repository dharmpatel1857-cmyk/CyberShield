from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models import AuditEvent, User, UserSetting
from app.schemas import SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_settings(user: User, db: Session) -> UserSetting:
    item = db.scalar(select(UserSetting).where(UserSetting.user_id == user.id))
    if item is None:
        item = UserSetting(user_id=user.id)
        db.add(item)
        db.commit()
        db.refresh(item)
    return item


def view(item: UserSetting) -> dict:
    return {"theme": item.theme, "protection_enabled": item.protection_enabled, "sync_extension": item.sync_extension, "ollama_model": item.ollama_model, "retention_days": item.retention_days}


@router.get("")
def read_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return view(get_or_create_settings(user, db))


@router.patch("")
def update_settings(payload: SettingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = get_or_create_settings(user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.add(AuditEvent(user_id=user.id, action="settings.updated"))
    db.commit()
    db.refresh(item)
    return view(item)
