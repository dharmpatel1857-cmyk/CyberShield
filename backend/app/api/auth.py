from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_session, current_session, get_current_user, hash_password, verify_password
from app.db import get_db
from app.models import AuditEvent, User, UserSession, UserSetting
from app.schemas import AuthResponse, LoginInput, UserCreate, UserView

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if not settings.allow_registration:
        raise HTTPException(status_code=403, detail="Registration is currently disabled")
    username = payload.username.strip().lower()
    email = str(payload.email).lower()
    if db.scalar(select(User).where(or_(User.username == username, User.email == email))):
        raise HTTPException(status_code=409, detail="Username or email is already registered")
    user = User(full_name=payload.full_name.strip(), username=username, email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    token, expires = create_session(db, user)
    db.add(AuditEvent(user_id=user.id, action="account.registered"))
    db.commit()
    return AuthResponse(access_token=token, expires_at=expires, user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    login_value = payload.login.strip().lower()
    user = db.scalar(select(User).where(or_(User.email == login_value, User.username == login_value)))
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    token, expires = create_session(db, user)
    db.add(AuditEvent(user_id=user.id, action="session.created"))
    db.commit()
    return AuthResponse(access_token=token, expires_at=expires, user=user)


@router.post("/logout", status_code=204)
def logout(pair=Depends(current_session), db: Session = Depends(get_db)):
    user, session = pair
    session.revoked = True
    db.add(AuditEvent(user_id=user.id, action="session.revoked"))
    db.commit()


@router.get("/me", response_model=UserView)
def me(user: User = Depends(get_current_user)):
    return user
