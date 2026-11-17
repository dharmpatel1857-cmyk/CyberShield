from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.models import AuditEvent, IncidentNote, SecurityIncident, User
from app.schemas import IncidentStatusUpdate, NoteCreate

router = APIRouter(prefix="/incidents", tags=["incidents"])


def incident_view(item: SecurityIncident) -> dict:
    return {
        "id": item.id,
        "incident_key": item.incident_key,
        "domain": item.domain,
        "title": item.title,
        "severity": item.severity,
        "status": item.status,
        "summary": item.summary,
        "created_at": item.created_at,
        "notes": [{"id": note.id, "note": note.note, "created_at": note.created_at} for note in sorted(item.notes, key=lambda note: note.created_at)],
    }


@router.get("")
def list_incidents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(SecurityIncident).where(SecurityIncident.user_id == user.id).order_by(SecurityIncident.created_at.desc()).limit(200)).all()
    return [incident_view(row) for row in rows]


@router.patch("/{incident_id}")
def update_incident(incident_id: int, payload: IncidentStatusUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.scalar(select(SecurityIncident).where(SecurityIncident.id == incident_id, SecurityIncident.user_id == user.id))
    if item is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    item.status = payload.status
    db.add(AuditEvent(user_id=user.id, action="incident.status_updated", detail=f"{item.incident_key}: {payload.status}"))
    db.commit()
    db.refresh(item)
    return incident_view(item)


@router.post("/{incident_id}/notes", status_code=201)
def add_note(incident_id: int, payload: NoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.scalar(select(SecurityIncident).where(SecurityIncident.id == incident_id, SecurityIncident.user_id == user.id))
    if item is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    note = IncidentNote(incident_id=item.id, user_id=user.id, note=payload.note.strip())
    db.add(note)
    db.add(AuditEvent(user_id=user.id, action="incident.note_added", detail=item.incident_key))
    db.commit()
    db.refresh(item)
    return incident_view(item)
