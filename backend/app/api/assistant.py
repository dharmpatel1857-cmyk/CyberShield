from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db import get_db
from app.models import User, UserSetting, WebsiteScan
from app.schemas import ChatInput
from app.services.assistant import ask_local_model

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat")
async def chat(payload: ChatInput, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    context = None
    if payload.scan_id is not None:
        scan = db.scalar(select(WebsiteScan).where(WebsiteScan.id == payload.scan_id, WebsiteScan.user_id == user.id))
        if scan is None:
            raise HTTPException(status_code=404, detail="Scan not found")
        context = {"domain": scan.domain, "risk_level": scan.risk_level, "score": scan.risk_score, "evidence": scan.evidence_json}
    user_settings = db.scalar(select(UserSetting).where(UserSetting.user_id == user.id))
    model = (user_settings.ollama_model if user_settings and user_settings.ollama_model else "") or settings.ollama_model
    try:
        answer = await ask_local_model(payload.message, model, context)
    except Exception as error:
        # Avoid returning connection details, local paths or upstream response contents.
        raise HTTPException(status_code=503, detail="Local Ollama is unavailable or returned an error. Start Ollama and check the configured model.") from error
    return {"response": answer, "model": model, "local": True}
