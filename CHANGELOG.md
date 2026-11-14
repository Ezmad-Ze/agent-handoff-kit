# Changelog

## Unreleased

- Fix the documentation checker's direct-entry detection through symlinked directories, including macOS temporary paths; add a regression covering stale rejection, explicit synchronization and successful checking through an alias.
- Add `docs:check` to compare the README command reference with built CLI help and validate the package-version banner.
- Add `docs:update` to synchronize only the marked reference block after a reviewed CLI change.
- Run the drift check in CI; cover option/default/exit-code drift, marker errors, idempotence, and invocation outside a Git repository.
- Repository capture, privacy filtering, verification semantics and snapshot schema are unchanged.

## 0.1.0 — 2026-11-10

- Initial TypeScript CLI: Markdown/JSON snapshots and verification.
- Best-effort metadata redaction and sensitive-path filtering.
- Bounded Git subprocesses and no runtime npm dependencies.
- Temporary-repository tests, demo and CI configuration.

Local preparation date; GitHub publication and remote CI status must be verified separately.

