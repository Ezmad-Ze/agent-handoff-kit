# Architecture and tradeoffs

## Data flow

CLI arguments → Git repository root → first state capture → recent commit metadata → second state capture → privacy filtering → Markdown / JSON → stdout or an explicitly named local file.

Git status uses `--porcelain=v1 -z`. NUL separators preserve spaces and newline characters in paths. Rename records consume both destination and original path. If either is sensitive, the entry is omitted.

The SHA-256 fingerprint covers HEAD, branch name, raw Git status and a digest of tracked diffs. It deliberately includes filtered-out changes so editing a tracked secret can still invalidate a brief without exporting that secret. Untracked contents, ignored files and inner submodule data are outside the fingerprint's contract.

Two captures detect common concurrent edit races; they do not lock the worktree. A file changed and restored between captures can escape detection. There is no atomic multi-command Git snapshot guarantee.

## Why deterministic metadata first?

An LLM summarizer would add costs, data egress, nondeterminism and credential management. The initial version solves a smaller problem: collect useful context and make stale state visible. Human/agent task notes remain explicit, unverified input.

## Why no automatic test command discovery?

Executing commands from package scripts or agent instructions is a code-execution boundary. This tool does not cross it. It reports checks as not run and asks the user to record actual results. An explicit, separately reviewed check runner could be a future product.

## Why no database, server, or framework?

This product is a local CLI over Git metadata. A service layer would increase effort and operational cost without improving its first use case. TypeScript, Node built-ins and Git are sufficient. All npm dependencies are build-time only.

## What to explain in an interview

1. Why porcelain `-z` is safer than parsing display-oriented Git output.
2. Why hashing file status alone misses subsequent edits to the same modified file.
3. Why output written inside the inspected repository can immediately make a brief stale.
4. How shell-free execution, bounded subprocesses and escaping reduce risks, and their remaining limits.
5. Why a matching fingerprint is neither a signature nor a test result.
6. Why untracked content and submodules need explicit limitations.

## Source references

- Git status porcelain format: https://git-scm.com/docs/git-status
- Git diff external helpers and text conversion: https://git-scm.com/docs/git-diff
- Node child processes: https://nodejs.org/api/child_process.html

These references explain underlying behavior, not a security certification of this application.
