# Security Policy

Thank you for helping keep CyberShield secure.

If you believe you have found a security vulnerability in this project, please report it privately and responsibly. We take all security reports seriously and will investigate as quickly as possible.

## Reporting a Vulnerability

Please report vulnerabilities through one of the following methods:

- Preferred: GitHub Security Advisories for this repository
- Alternative: Email the maintainer privately at security@cybershield.example

Please do not open a public GitHub issue for security vulnerabilities until we have had a chance to investigate and, if needed, release a fix.

When reporting, include:

- A description of the vulnerability
- Steps to reproduce the issue
- The affected component or file
- Impact and severity assessment
- Any proof-of-concept or sample payloads
- Your contact information

## Response Expectations

We aim to respond as follows:

- Initial acknowledgment: within 48 hours
- Triage and impact assessment: within 5 business days
- Fix timeline: depends on severity and complexity, but we will keep you informed throughout

## Supported Versions

The project currently supports the latest branch and the latest tagged release. Security fixes are prioritized for the current main branch.

If you are using an older version, please upgrade before reporting a vulnerability unless the issue is specifically tied to the older version being used.

## Security Scope

This project includes:

- Backend API
- Frontend dashboard
- Browser extension
- Local database and session handling
- URL analysis and detection logic
- Local AI integration and environment configuration

We are especially interested in issues involving:

- Authentication or session bypass
- Authorization flaws
- SQL injection or unsafe database handling
- Command execution or arbitrary code execution
- Unsafe use of environment variables or secrets
- Cross-site scripting (XSS)
- Unsafe extension behavior
- Data leakage or improper exposure of user information

## Responsible Disclosure

We ask researchers and users to:

- Avoid privacy violations or data exposure beyond the minimum needed to validate the issue
- Do not access, modify, or delete data that does not belong to you
- Avoid public disclosure before coordination with the project maintainers
- Use the smallest viable proof-of-concept necessary to demonstrate the issue

## Security Best Practices for Contributors

Please follow these standards when contributing:

- Never commit secrets, API keys, tokens, or private credentials
- Use secure password hashing and session management practices
- Validate all user input before processing
- Use least-privilege access patterns
- Be careful with browser extension permissions and message passing
- Keep environment variables out of source control
- Prefer secure defaults over permissive configurations

## Local Deployment Guidance

CyberShield is designed for local-first use and should be deployed with care:

- Keep services bound to localhost unless a production deployment is explicitly designed and reviewed
- Use strong secret management for `.env` values
- Avoid exposing internal APIs publicly without additional security controls
- Review browser extension permissions before deploying to end users
- Keep dependencies updated and monitor security advisories for all packages

## Disclosure Policy

We follow responsible disclosure. If a valid vulnerability is reported to us, we will:

- Investigate the issue promptly
- Work with the reporter to confirm the root cause
- Develop and validate a mitigation
- Publish a coordinated security fix when appropriate
- Credit the reporter if they wish to be acknowledged

## Contact

For security-related concerns, contact the maintainer privately through the repository’s GitHub Security Advisory workflow or via the project’s private security email.

Thank you for helping make CyberShield safer for everyone.
