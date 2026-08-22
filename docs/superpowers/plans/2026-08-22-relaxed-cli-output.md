# Relaxed CLI Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize human-readable output around a quiet title and generous whitespace.

**Architecture:** Change the shared `frame()` renderer first, then simplify command bodies that duplicate labels or command prefixes. Preserve machine-readable output and existing command behavior.

---

### Task 1: Update shared renderer

- Modify `src/cli/ui.ts` to use `UI Registry  /  command`, whitespace-separated sections, and a single quiet footer.
- Preserve color semantics and JSON behavior.

### Task 2: Simplify command copy

- Modify component list/info/add/remove/toggle and self-update human-readable bodies to remove redundant labels and decorative separators.
- Keep actionable next steps concise.

### Task 3: Verify and publish

- Update human-output assertions in `test/cli.test.ts`.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `sh -n install.sh`.
- Commit with `refactor: simplify cli output` and push `main`.
