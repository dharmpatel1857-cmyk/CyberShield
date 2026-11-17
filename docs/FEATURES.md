# Feature status and boundaries

## Implemented in this repository

| Area | Behavior |
|---|---|
| Authentication | Registration, login, logout, `/me`, scrypt password hashes, random opaque sessions with expiry, user scoping |
| URL detection | Explainable rules and evidence for URL structure, Unicode/punycode and likely brand homographs, redirect parameters, known shortener hostnames, and risky download suffixes |
| Browser extension | MV3 interstitial before top-level HTTP/HTTPS navigation; authenticated backend URL rules, local Ollama advisory, block/back/explicit continue actions, and local API settings |
| Persistence | SQLAlchemy SQLite entities for users, sessions, monitored sites, scans, detections, incidents, notes, settings, and audit events |
| Incident response | Automatic incident record for high/critical detections, status updates, notes, per-user history |
| Dashboard | Real API-backed summary, recent scans/incidents, URL scan form, incident queue, local AI chat, CSV/HTML reports |
| AI | Local Ollama `/api/chat` advisory for authenticated extension scans and dashboard chat; deterministic rules remain the source of recorded scores |
| Exports | User-scoped CSV, XLSX, PDF, and standalone HTML summary exports |

## Deliberate limits

- Detection is advisory and URL-only; it cannot confirm malware, virus payloads, page contents, or site safety. Evidence and confidence are exposed to help review.
- URL analysis is offline and non-invasive. It does not resolve DNS, fetch sites, probe ports, test vulnerabilities, or download files.
- Page metadata collection is limited to title, HTTPS state, password-form count, iframe count, and external-script count. No values, cookies, tokens, or body text are read or transmitted.
- The extension redirects top-level HTTP/HTTPS navigations to an extension-owned warning page, then asks the authenticated loopback backend to analyze the destination before allowing a user decision. Browser-internal pages, subframe requests, and downloaded-file contents are not scanned.
- Enabling the gate requires broad HTTP/HTTPS host access in Chrome. URL scoring remains heuristic; the interstitial is a pause for review, not a verdict or replacement for Safe Browsing.
- No external threat feeds, Google OAuth/Drive/Sheets, email notifications, certificate monitoring, global stats, or production-grade multi-tenant admin console are configured. These require provider credentials, operational policy, and deployment work.
- Conversation history is held in the dashboard session only; allow/block lists, retention cleanup jobs, account lockout, and a full admin console are not implemented in this MVP.
- SQLite `create_all` bootstraps a new database. Use Alembic migrations before evolving a production database.
- Default local session storage is intentionally simple; production deployments should add refresh/revocation policy, CSRF protections for cookie auth (if added), request throttling, secure key management, TLS, and security review.
