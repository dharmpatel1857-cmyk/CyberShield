# API reference

Base path: `/api/v1`. Interactive OpenAPI docs are served at `/docs` by FastAPI.

All endpoints except health and auth require `Authorization: Bearer <session-token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status |
| POST | `/auth/register` | Create account and session |
| POST | `/auth/login` | Start session |
| POST | `/auth/logout` | Revoke current session |
| GET | `/auth/me` | Current user profile |
| POST | `/scans` | Analyze and persist URL + limited page metadata |
| POST | `/extension/analyze` | Analyze a browser navigation with URL rules and optional local Ollama, then persist the redacted scan |
| GET | `/scans` | List recent scans |
| GET | `/dashboard/summary` | User-scoped counts and recent activity |
| GET | `/incidents` | List incidents |
| PATCH | `/incidents/{id}` | Update incident status |
| POST | `/incidents/{id}/notes` | Add an investigation note |
| GET | `/settings` | Read user settings |
| PATCH | `/settings` | Update user settings |
| POST | `/assistant/chat` | Ask the configured local Ollama model |
| GET | `/reports/scans.csv` | Download user-scoped scan export |
| GET | `/reports/scans.xlsx` | Download user-scoped Excel export |
| GET | `/reports/scans.pdf` | Download user-scoped PDF report |
| GET | `/reports/summary.html` | Download standalone HTML summary |

Scan input accepts only HTTP(S) URLs and a bounded set of page counters. Private, localhost, and IP literal URLs can be analyzed syntactically but are never fetched. Do not submit secrets in URL query strings.

`/extension/analyze` requires an authenticated user session. It returns rule-based detections and a local AI advisory; AI is not a malware verdict. Extension URLs are analyzed before redaction but the stored URL, and URL sent to Ollama, omit credentials, query values, and fragments. If Ollama is unavailable, the response explicitly marks the AI assessment unavailable while retaining URL-rule results.
