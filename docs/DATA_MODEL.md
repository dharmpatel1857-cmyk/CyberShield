# Data model

CyberShield creates its database schema on first API startup. It does not insert seed users, scans, incidents, or other sample rows. The local SQLite database file is ignored by Git.

| Table | Purpose |
| --- | --- |
| `users` | Local account profile and password hash |
| `user_sessions` | Hashed bearer-token sessions and expiry/revocation state |
| `user_settings` | Per-user dashboard and protection preferences |
| `monitored_websites` | Per-user website summary counters |
| `website_scans` | URL analysis result, evidence, and limited metadata |
| `threat_detections` | Evidence records associated with a scan |
| `security_incidents` | User-scoped incident status and summary |
| `incident_notes` | Investigation notes attached to an incident |
| `audit_logs` | Account and session activity records |

The SQLAlchemy model definitions are in `backend/app/models.py`. `backend/app/init_db.py` can create the schema explicitly. The API also creates missing tables when it starts. Use Alembic migrations when evolving a database that already contains user data.
