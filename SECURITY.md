# Security policy

CyberShield is a local-first defensive project and is not a managed security service.

## Reporting a vulnerability

Please do not post credentials, session tokens, private URLs, or exploit details in a public issue. If this repository is hosted on GitHub, use **Security → Report a vulnerability** to send a private report. Include the affected version, a concise impact description, and steps to reproduce in a local test environment. Do not include real user data.

## Supported versions

Only the latest version on the repository's default branch is currently supported.

## Deployment scope

The development configuration binds services to loopback. Review authentication, session lifecycle, TLS, request limits, secrets, CORS, backups, and database migrations before exposing any deployment to a network.
