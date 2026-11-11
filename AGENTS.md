# Working on Agent Handoff Kit

Keep this a small, local-first developer tool. Read README.md and docs/architecture.md before making changes.

- Run `npm ci`, `npm test` and `npm run demo` for meaningful behavior changes.
- Do not run project scripts from repositories being inspected.
- Never commit a real handoff, private repository data, credentials or `.env` files here.
- Use real temporary Git repositories in tests. Tests must remove their fixtures.
- Extend privacy and race-condition tests when collected metadata changes.
- Keep CLI help, README, exit codes and behavior aligned.
- No backdated commits, fabricated metrics, employment claims or cosmetic commits for activity.
- Do not add paid APIs, hosted infrastructure, npm publishing, MCP access or new permissions without a concrete user requirement.
- Update CHANGELOG.md only for actual shipped changes. Record failed/unrun checks honestly.
