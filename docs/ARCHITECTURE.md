# Architecture

```text
┌─────────────────────┐      authenticated JSON      ┌───────────────────────────┐
│ React dashboard     │ ───────────────────────────▶ │ FastAPI API               │
│ Vite / TypeScript   │                              │ auth, URL scans, incidents│
└─────────────────────┘                              └─────────────┬─────────────┘
                                                                   │ SQLAlchemy
┌─────────────────────┐  optional local scan sync                 ▼
│ MV3 browser addon   │ ───────────────────────────▶        ┌──────────────┐
│ navigation review  │                                       │ SQLite       │
└─────────────────────┘                                       └──────────────┘
                                                                   │ optional
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │ Local Ollama       │
                                                        │ assistant endpoint │
                                                        └────────────────────┘
```

The API parses URL strings and applies deterministic, explainable rules. It does not fetch the submitted destination. The browser extension listens for top-level HTTP and HTTPS navigation, pauses the tab on an extension-owned review page, and asks the authenticated local API to analyze the destination. The review page lets the user go back or explicitly continue once. Extension scan records are stored under the signed-in account with sensitive URL components redacted.

The dashboard and extension communicate with the API over authenticated JSON. SQLAlchemy stores user-scoped accounts, sessions, scans, detections, incidents, notes, settings, and audit events in SQLite by default. The schema is created on startup, but no seed or demo records are inserted. Optional assistant requests go to the configured local Ollama endpoint only; the assistant does not determine saved risk scores.

## Request flow

1. A user registers or signs in to receive an expiring bearer session.
2. The dashboard or extension sends an HTTP/HTTPS URL to the API.
3. The offline detector returns a score, risk band, evidence, and defensive advice.
4. The API stores the scan and its findings for the authenticated user. Higher-risk findings can create an incident.
5. The dashboard displays user-scoped summaries, scan history, incident status, notes, and reports.

See [API.md](API.md), [FEATURES.md](FEATURES.md), and [DATA_MODEL.md](DATA_MODEL.md) for endpoints, behavior, and storage details.
