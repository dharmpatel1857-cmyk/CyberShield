# CyberShield

CyberShield is a local-first cybersecurity monitoring platform designed to help users detect suspicious URLs, review risky websites, and manage digital security incidents before a threat escalates. It combines a fast URL analysis engine, a secure dashboard, and a browser extension that pauses navigation for safety review.

> CyberShield is intended for advisory, local monitoring workflows. It does not replace browser security tools, antivirus protection, or enterprise security monitoring systems.

## Why CyberShield?

Modern online threats often hide in deceptive links, lookalike domains, shortened URLs, and subtle malicious patterns. CyberShield gives security teams, analysts, and individuals a practical way to:

- assess suspicious website URLs before visiting them
- review risk indicators in an explainable and transparent way
- track findings and incident notes over time
- integrate with a browser workflow that pauses risky navigation
- keep the system local-first with no forced cloud dependency

## Features

- Explainable URL risk analysis for suspicious domains, URI patterns, redirect tricks, encoded hostnames, shorteners, and executable download clues
- User authentication with secure session management and per-user scan history
- Dashboard summaries, incident tracking, notes, settings, and exports in CSV, XLSX, PDF, and HTML formats
- Manifest V3 browser extension for Chrome, Edge, and Brave that pauses top-level HTTP/HTTPS navigation for review
- Optional local Ollama integration for AI-assisted analysis without sending sensitive data to external services
- SQLite-backed local storage with an empty default database and no seed users or demo records

## Interface Preview

These previews are illustrative examples and do not include live production data. A fresh installation starts with an empty database.

<p><strong>Monitoring Dashboard</strong><br><img src="docs/images/dashboard-preview.svg" alt="CyberShield dashboard preview" width="720"></p>

<p><strong>Browser Extension</strong><br><img src="docs/images/extension-preview.svg" alt="CyberShield browser extension preview" width="590"></p>

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy, SQLite
- Frontend: React, TypeScript, Vite
- Browser extension: JavaScript, Manifest V3
- Security controls: local-first processing, session tokens, password hashing, safe loopback configuration

## Quick Start

### Windows

Open PowerShell in the project root and run:

```powershell
.\scripts\start.ps1
```

On the first run, the script creates a Python virtual environment, installs the locked frontend dependencies and backend requirements, initializes the local environment file, and launches both services on loopback. Then open:

- Dashboard: http://127.0.0.1:5173
- API health: http://127.0.0.1:8001/api/v1/health

### Linux and macOS

```bash
cp .env.example .env
sh ./scripts/start.sh
```

Then, in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The application is available at http://127.0.0.1:5173.

> Node.js 20.19+ or 22.12+ is required for the frontend toolchain.

## Database Setup

On first startup, SQLAlchemy creates the SQLite database at `backend/cybershield.db`. The initial database is empty, with no default users, sample records, or preloaded incidents. The table definitions are in `backend/app/models.py`, and the data model documentation is available in [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Browser Extension

1. Start CyberShield and sign in or create a local account.
2. In Chrome, Edge, or Brave, open the extensions page and enable Developer mode.
3. Select **Load unpacked** and choose the `extension/` folder.
4. Enter the local API URL (`http://127.0.0.1:8001/api/v1`) and a valid session token from the dashboard settings.
5. Visit a website to review the extension’s advisory screen before continuing.

This extension requests navigation permissions so it can pause top-level website requests and review destination URLs before they proceed.

## Privacy and Security Boundaries

- The API analyzes URL strings and does not fetch the destination page content.
- Risk evaluation is heuristic-based; it may produce false positives or miss some threats.
- The browser extension does not inspect iframe contents or downloaded file bytes.
- The optional assistant uses a local Ollama endpoint and does not send data to a hosted provider by default.
- Keep the system bound to localhost for local use. Public deployments should be reviewed separately for TLS, rate limiting, secrets management, and backup procedures.

## Project Structure

```text
backend/       FastAPI application, models, and database logic
docs/          Product and data documentation
extension/     Browser extension for navigation review
frontend/      React and TypeScript dashboard
scripts/       Startup and local environment helpers
```

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

The dashboard and extension visuals included in this repository were provided with the original project reference materials. The included SVG preview assets are part of the repository content.
