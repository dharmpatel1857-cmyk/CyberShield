import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import User, UserSession


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = encoded.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_session(db: Session, user: User) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(40)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours)
    db.add(UserSession(user_id=user.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=expires_at))
    return token, expires_at


def current_session(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> tuple[User, UserSession]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue")
    raw = authorization[7:].strip()
    if not raw or len(raw) > 256:
        raise HTTPException(status_code=401, detail="Invalid session")
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    session = db.scalar(select(UserSession).where(UserSession.token_hash == token_hash, UserSession.revoked.is_(False)))
    now = datetime.now(timezone.utc)
    expiry = session.expires_at if session else now
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if session is None or expiry <= now:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    user = db.get(User, session.user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    return user, session


def get_current_user(session_and_user: tuple[User, UserSession] = Depends(current_session)) -> User:
    return session_and_user[0]
