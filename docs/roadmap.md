# Roadmap

## v0.1 — implemented

- Local Markdown/JSON capture with bounded Markdown output.
- Tracked-state stale detection and explicit untracked-content limitations.
- Sensitive-path omission, metadata redaction and escaping.
- Real-Git fixture tests and an isolated CLI demo.
- CI configuration and a practical architecture walkthrough.

## Implemented on main

- Documentation drift check for the README command reference and package-version banner.
- Explicit synchronization command and CI gate; no new repository data collection.

## Initial-version completion gate

- Resolve the macOS documentation-checker failure and verify all supported CI jobs before calling this initial version finished.
- Confirm the isolated demo, setup instructions and tests still work.
- After owner review and merge, keep this version at its agreed scope and move to the next approved product.

## Optional extensions — require owner approval

- Add an opt-in file allowlist with bounded excerpts, if useful after real usage.
- Add a stdio MCP adapter that exposes only explicit local repositories.

Design and test privacy boundaries before expanding collected data. Neither excerpts nor MCP are implemented yet.

## Later products

1. Webhook Relay — NestJS/PostgreSQL delivery queue, signing, bounded retry and delivery history.
2. Approval Desk — Spring Boot/PostgreSQL requests, decisions and audit history.
3. API Health Monitor — endpoint checks and a small status dashboard.

Work in small, tested milestones. Do not create empty repositories, cosmetic commits or backdated activity to fill a calendar.

Aim for one complete small initial product per three-day cycle, finishing earlier when ready. A pull request is for review; completion means the agreed scope is verified and merged to main. Fix blockers before starting another product. Propose additional features for approval instead of implementing them automatically.

