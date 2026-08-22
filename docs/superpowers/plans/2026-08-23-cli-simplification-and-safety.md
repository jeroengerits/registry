# CLI Simplification and Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CLI safer, less duplicated, easier to extend, and correct under update and failure scenarios.

**Architecture:** Keep Commander as a thin adapter, preserve `commands/shared.ts` for component workflow orchestration, and move reusable filesystem, Git metadata, transaction, and presentation responsibilities behind focused functions. Prefer incremental changes over a wholesale rewrite.

**Tech Stack:** TypeScript, Commander, Vitest, Node.js filesystem APIs, Execa, Zod.

---

### Task 1: Harden semantic versions and Git metadata

**Files:**
- Modify: `src/git.ts`
- Test: `test/cli.test.ts`

- [x] Add tests for `^0`, `^0.1`, and `^0.0.1` compatibility.
- [x] Implement standard caret semantics and keep stable tag sorting.
- [x] Add `git ls-remote --tags` metadata lookup for version-only commands.
- [x] Reuse one metadata lookup per command invocation.

### Task 2: Harden filesystem boundaries and hashes

**Files:**
- Create: `src/filesystem.ts`
- Modify: `src/paths.ts`
- Modify: `src/cli/commands/shared.ts`
- Modify: `src/cli/commands/doctor.ts`
- Modify: `src/cli/commands/component/remove.ts`
- Modify: `src/cli/commands/component/add.ts`
- Test: `test/cli.test.ts`

- [x] Reject symlink sources and destinations with `lstat`.
- [x] Route copy, delete, and existence checks through safe filesystem helpers.
- [x] Compute SHA-256 hashes for installed files.
- [x] Make doctor verify hashes when present and report missing files.
- [x] Add traversal, symlink, and hash tests.

### Task 3: Make component updates correct and recoverable

**Files:**
- Modify: `src/cli/commands/shared.ts`
- Modify: `src/cli/commands/component/add.ts`
- Modify: `src/cli/commands/component/update.ts`
- Modify: `src/cli/commands/component/outdated.ts`
- Modify: `src/state.ts`
- Test: `test/cli.test.ts`

- [x] Clean staging directories on every failure path.
- [x] Delete obsolete tracked files during forced updates.
- [x] Apply compatibility filtering to outdated versions.
- [x] Update only requested roots when dependencies are already current.
- [x] Use unique temporary state filenames.
- [x] Add tests for dependency updates, stale files, constrained outdated results, and rollback.

### Task 4: Simplify command registration and presentation

**Files:**
- Create: `src/cli/commands/registry.ts`
- Create: `src/cli/presentation.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/help.ts`
- Modify: `src/cli/commands/component/help.ts`
- Modify: command modules as needed
- Test: `test/cli.test.ts`

- [x] Define command metadata once for Commander and focused help.
- [x] Centralize command result formatting for human and JSON output.
- [x] Remove nested JSON string aggregation from update-all.
- [x] Keep `index.ts` limited to parsing, dispatch, and process exit handling.
- [x] Add focused help coverage for every documented command.

### Task 5: Validate, review, commit, and push

**Files:**
- Modify: `docs/superpowers/plans/2026-08-23-cli-simplification-and-safety.md`

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build` and restore launcher permissions if needed.
- [x] Run `npm run test`.
- [x] Inspect `git diff --check`, status, and staged diff.
- [x] Commit all changes with a concise refactor message.
- [x] Push `main` to `origin` and verify a clean worktree.
