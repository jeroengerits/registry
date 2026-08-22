# One-Shot CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove CLI wizards and make namespace and component operations one-shot commands.

**Architecture:** Keep command handlers intact. Simplify `run()` dispatch and remove wizard-only prompt functions and dashboard orchestration.

---

### Task 1: Simplify dispatch

- Modify `src/cli/index.ts` so no arguments render namespace help, `components` calls `listComponent`, and `hooks` returns a one-shot status frame.
- Remove dashboard and namespace picker dispatch.

### Task 2: Remove wizard UI

- Remove wizard-only functions and types from `src/cli/ui.ts`.
- Delete `src/cli/commands/component/dashboard.ts`.
- Keep version selection and destructive confirmation prompts only where an operation genuinely needs input.

### Task 3: Update contracts and verification

- Update help, README, installation docs, and CLI tests for deterministic one-shot behavior.
- Run typecheck, lint, build, shell validation, and the full test suite.
- Commit with `refactor: simplify cli commands` and push `main`.
