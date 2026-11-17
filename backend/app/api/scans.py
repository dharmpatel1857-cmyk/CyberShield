import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db import get_db
from app.models import AuditEvent, MonitoredWebsite, SecurityIncident, ThreatDetection, User, UserSetting, WebsiteScan
from app.schemas import ExtensionScanCreate, ScanCreate
from app.services.assistant import assess_url_with_local_model
from app.services.detection import analyze_url, redact_url

router = APIRouter(tags=["scans"])
logger = logging.getLogger(__name__)


def scan_response(scan: WebsiteScan) -> dict:
    return {
        "id": scan.id,
        "url": scan.url,
        "domain": scan.domain,
        "risk_level": scan.risk_level,
        "risk_score": scan.risk_score,
        "confidence": scan.confidence,
        "evidence": json.loads(scan.evidence_json),
        "recommendations": json.loads(scan.recommendations_json),
        "page_metadata": json.loads(scan.page_metadata_json),
        "created_at": scan.created_at,
    }


def _persist_scan(user: User, db: Session, url: str, analysis: dict, metadata: dict) -> dict:
    site = db.scalar(select(MonitoredWebsite).where(MonitoredWebsite.user_id == user.id, MonitoredWebsite.domain == analysis["domain"]))
    if site is None:
        site = MonitoredWebsite(user_id=user.id, domain=analysis["domain"], scan_count=0)
        db.add(site)
    site.last_seen_at = datetime.now(timezone.utc)
    site.scan_count += 1
    scan = WebsiteScan(
        user_id=user.id,
        url=url.strip(),
        domain=analysis["domain"],
        risk_level=analysis["risk_level"],
        risk_score=analysis["risk_score"],
        confidence=analysis["confidence"],
        evidence_json=json.dumps(analysis["evidence"]),
        recommendations_json=json.dumps(analysis["recommendations"]),
        page_metadata_json=json.dumps(metadata),
    )
    db.add(scan)
    db.flush()
    for finding in analysis["detections"]:
        db.add(ThreatDetection(scan_id=scan.id, category=finding["category"], severity=finding["severity"], evidence=finding["evidence"]))
    if analysis["risk_level"] in {"High", "Critical"}:
        db.add(SecurityIncident(
            incident_key="CS-" + uuid.uuid4().hex[:12].upper(),
            user_id=user.id,
            scan_id=scan.id,
            domain=analysis["domain"],
            title=f"{analysis['risk_level']} risk URL indicators",
            severity=analysis["risk_level"],
            status="New",
            summary="; ".join(analysis["evidence"][:3]),
        ))
    db.add(AuditEvent(user_id=user.id, action="url.analyzed", detail=f"{analysis['risk_level']} risk, score {analysis['risk_score']}"))
    db.commit()
    db.refresh(scan)
    result = scan_response(scan)
    result["detections"] = [{key: item[key] for key in ("category", "severity", "evidence")} for item in analysis["detections"]]
    return result


@router.post("/scans", status_code=201)
def create_scan(payload: ScanCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        analysis = analyze_url(payload.url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    metadata = payload.page_metadata.model_dump(exclude_none=True) if payload.page_metadata else {}
    return _persist_scan(user, db, payload.url, analysis, metadata)


@router.post("/extension/analyze")
async def analyze_extension_navigation(payload: ExtensionScanCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        analysis = analyze_url(payload.url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    user_settings = db.scalar(select(UserSetting).where(UserSetting.user_id == user.id))
    model = (user_settings.ollama_model if user_settings and user_settings.ollama_model else "") or settings.ollama_model
    try:
        ai_assessment = await assess_url_with_local_model(redact_url(payload.url), model)
    except (httpx.HTTPError, RuntimeError, ValueError) as error:
        logger.warning("Extension AI assessment unavailable (%s)", type(error).__name__)
        ai_assessment = {
            "status": "unavailable",
            "message": "Local AI analysis is unavailable; the rule-based URL findings are shown.",
        }

    ai_is_suspicious = (
        ai_assessment.get("status") == "complete"
        and ai_assessment.get("likely_suspicious") is True
        and ai_assessment.get("confidence", 0) >= 0.7
    )
    alert_level = analysis["risk_level"]
    levels = ["Safe", "Low", "Medium", "High", "Critical"]
    if ai_is_suspicious:
        ai_level = ai_assessment["risk_level"]
        if levels.index(ai_level) < levels.index("Medium"):
            ai_level = "Medium"
            ai_assessment["risk_level"] = ai_level
        if levels.index(ai_level) > levels.index(alert_level):
            alert_level = ai_level
    metadata = {"source": "browser_extension", "ai_assessment": ai_assessment}
    result = _persist_scan(user, db, redact_url(payload.url), analysis, metadata)
    result["ai_assessment"] = ai_assessment
    result["alert"] = analysis["risk_score"] >= 25 or ai_is_suspicious
    result["alert_level"] = alert_level
    return result


@router.get("/scans")
def list_scans(limit: int = Query(default=30, ge=1, le=100), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc()).limit(limit)).all()
    return [scan_response(row) for row in rows]


@router.get("/dashboard/summary")
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scans_count = db.scalar(select(func.count(WebsiteScan.id)).where(WebsiteScan.user_id == user.id)) or 0
    monitored_count = db.scalar(select(func.count(func.distinct(WebsiteScan.domain))).where(WebsiteScan.user_id == user.id)) or 0
    high_count = db.scalar(select(func.count(WebsiteScan.id)).where(WebsiteScan.user_id == user.id, WebsiteScan.risk_level.in_(["High", "Critical"]))) or 0
    incident_count = db.scalar(select(func.count(SecurityIncident.id)).where(SecurityIncident.user_id == user.id, SecurityIncident.status.not_in(["Resolved", "Archived", "False Positive"]))) or 0
    recent = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc()).limit(6)).all()
    return {"websites_monitored": monitored_count, "scans_total": scans_count, "high_risk_scans": high_count, "open_incidents": incident_count, "recent_scans": [scan_response(row) for row in recent]}
