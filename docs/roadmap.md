# Roadmap

## v0.1 — implemented

- Local Markdown/JSON capture with bounded Markdown output.
- Tracked-state stale detection and explicit untracked-content limitations.
- Sensitive-path omission, metadata redaction and escaping.
- Real-Git fixture tests and an isolated CLI demo.
- CI configuration and a practical architecture walkthrough.

## Next small milestone

- Add an opt-in file allowlist with bounded excerpts, if useful after real usage.
- Add a stdio MCP adapter that exposes only explicit local repositories.
- Add a CI check that detects documentation/CLI drift.

Design and test privacy boundaries before expanding collected data. Neither excerpts nor MCP are implemented yet.

## Later products

1. Webhook Relay — NestJS/PostgreSQL delivery queue, signing, bounded retry and delivery history.
2. Approval Desk — Spring Boot/PostgreSQL requests, decisions and audit history.
3. API Health Monitor — endpoint checks and a small status dashboard.

Work in small, tested milestones. Do not create empty repositories, cosmetic commits or backdated activity to fill a calendar.
