import csv
import html
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet

from app.core.security import get_current_user
from app.db import get_db
from app.models import SecurityIncident, User, WebsiteScan

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/scans.csv")
def scans_csv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scans = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc())).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["scan_id", "scanned_at", "url", "domain", "risk_level", "risk_score", "confidence", "evidence", "recommendations"])
    for scan in scans:
        writer.writerow([scan.id, scan.created_at.isoformat(), scan.url, scan.domain, scan.risk_level, scan.risk_score, scan.confidence, " | ".join(json.loads(scan.evidence_json)), " | ".join(json.loads(scan.recommendations_json))])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=cybershield-scans.csv"})


@router.get("/summary.html", response_class=HTMLResponse)
def summary_html(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scans = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc()).limit(250)).all()
    incidents = db.scalars(select(SecurityIncident).where(SecurityIncident.user_id == user.id).order_by(SecurityIncident.created_at.desc()).limit(100)).all()
    rows = "".join(f"<tr><td>{html.escape(scan.created_at.strftime('%Y-%m-%d %H:%M UTC'))}</td><td>{html.escape(scan.domain)}</td><td>{html.escape(scan.risk_level)}</td><td>{scan.risk_score}</td></tr>" for scan in scans)
    incident_list = "".join(f"<li><strong>{html.escape(item.severity)}</strong> · {html.escape(item.domain)} — {html.escape(item.status)}</li>" for item in incidents)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CyberShield Security Report</title>
<style>body{{font:16px system-ui;background:#09111f;color:#e8eef8;max-width:1000px;margin:48px auto;padding:0 24px}}h1{{color:#78e2c1}}.card{{background:#111d30;border:1px solid #253750;border-radius:14px;padding:20px;margin:20px 0}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #273750}}small{{color:#91a3ba}}</style>
<h1>CyberShield · Security activity report</h1><small>Prepared for {html.escape(user.full_name)} · {generated}. Findings are advisory URL heuristics.</small>
<section class="card"><h2>Recent URL checks</h2><table><thead><tr><th>Time</th><th>Domain</th><th>Risk</th><th>Score</th></tr></thead><tbody>{rows or '<tr><td colspan="4">No scans recorded.</td></tr>'}</tbody></table></section>
<section class="card"><h2>Incidents</h2><ul>{incident_list or '<li>No incidents recorded.</li>'}</ul></section></html>"""
    return HTMLResponse(page, headers={"Content-Disposition": "attachment; filename=cybershield-summary.html"})


@router.get("/scans.xlsx")
def scans_xlsx(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scans = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc())).all()
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "URL scans"
    sheet.append(["Scan ID", "Scanned at (UTC)", "URL", "Domain", "Risk level", "Risk score", "Confidence", "Evidence", "Recommendations"])
    for scan in scans:
        sheet.append([scan.id, scan.created_at.isoformat(), scan.url, scan.domain, scan.risk_level, scan.risk_score, scan.confidence, " | ".join(json.loads(scan.evidence_json)), " | ".join(json.loads(scan.recommendations_json))])
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for column, width in {"A": 10, "B": 25, "C": 46, "D": 27, "E": 16, "F": 14, "G": 14, "H": 70, "I": 70}.items():
        sheet.column_dimensions[column].width = width
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=cybershield-scans.xlsx"})


@router.get("/scans.pdf")
def scans_pdf(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scans = db.scalars(select(WebsiteScan).where(WebsiteScan.user_id == user.id).order_by(WebsiteScan.created_at.desc()).limit(250)).all()
    incidents = db.scalars(select(SecurityIncident).where(SecurityIncident.user_id == user.id).order_by(SecurityIncident.created_at.desc()).limit(100)).all()
    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=letter, title="CyberShield Security Report", rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=42)
    styles = getSampleStyleSheet()
    story = [Paragraph("CyberShield · Security Activity Report", styles["Title"]), Spacer(1, 8), Paragraph(f"Prepared for {html.escape(user.full_name)} · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]), Spacer(1, 16), Paragraph("Recent URL analysis", styles["Heading2"])]
    data = [["Date (UTC)", "Domain", "Risk", "Score"]]
    data.extend([[scan.created_at.strftime("%Y-%m-%d %H:%M"), scan.domain[:36], scan.risk_level, str(scan.risk_score)] for scan in scans])
    table = Table(data, repeatRows=1, colWidths=[120, 230, 80, 45])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#173b36")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#bdc9d2")), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f6")]), ("FONTSIZE", (0, 0), (-1, -1), 8), ("VALIGN", (0, 0), (-1, -1), "TOP")] ))
    story.extend([table, Spacer(1, 16), Paragraph("Incidents", styles["Heading2"])])
    story.extend([Paragraph(f"{html.escape(item.severity)} · {html.escape(item.domain)} — {html.escape(item.status)}", styles["BodyText"]) for item in incidents] or [Paragraph("No incidents recorded.", styles["BodyText"])])
    story.extend([Spacer(1, 12), Paragraph("Findings are advisory URL-only heuristics and do not prove that a website is safe or malicious.", styles["Italic"])])
    document.build(story)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=cybershield-report.pdf"})
