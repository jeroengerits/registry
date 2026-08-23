# Automatic Project Initialization and Schema Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create missing project state for recognized stateful CLI commands and keep both published JSON Schemas aligned with runtime contracts.

**Architecture:** Add a silent, exclusive bootstrap helper beside the existing state functions. The CLI entrypoint calls it only after identifying a recognized stateful command and before Commander dispatch; explicit `init` and diagnostics retain their current semantics. Update schemas and tests together, without changing the separate component-manifest versus project-state boundary.

**Tech Stack:** TypeScript, Commander, Zod, JSON Schema 2020-12, Vitest.

---

### Task 1: Add silent project bootstrap

**Files:**
- Modify: `src/state.ts`
- Modify: `src/cli/index.ts`
- Test: `test/cli.test.ts`

- [x] **Step 1: Write failing tests** for `run(['list'], directory)` creating `{ components: {} }`, `run(['list', '--json'], directory)` returning `[]` while creating the file, and `run(['doctor'], directory)` reporting missing without creating it.
- [x] **Step 2: Run `npm test -- --run test/cli.test.ts` and verify the new stateful-command expectations fail because `list` currently treats missing state as an empty result without writing it.
- [x] **Step 3: Add `ensureState(cwd)` in `src/state.ts` using `readState`, `readRootVersion`, and exclusive `initializeState`; return the existing state when present and the newly initialized state otherwise.
- [x] **Step 4: Add command classification in `src/cli/index.ts` for recognized stateful commands (`add`, `list`, `show`, `remove`, `status`, `update`, `outdated`, `versions`, `undo`, `enable`, `disable`, and `component` equivalents), excluding `init`, `doctor`, help, metadata, and unknown commands.
- [x] **Step 5: Call the helper silently before Commander parsing and preserve existing JSON/error handling.
- [x] **Step 6: Run the focused test file and confirm all tests pass.

### Task 2: Align published schemas with runtime usage

**Files:**
- Modify: `schemas/ui.schema.json`
- Modify: `schemas/registry.schema.json`
- Modify: `src/registry.ts`
- Modify: `src/state.ts`
- Test: `test/cli.test.ts`

- [x] **Step 1: Add schema fixtures/assertions covering safe relative manifest paths, non-blank manifest fields, project state optional metadata, and installed file hash records.
- [x] **Step 2: Tighten runtime validation to match the published constraints for paths and non-blank persisted path values, preserving accepted legacy state where tests document it.
- [x] **Step 3: Update both JSON Schemas to match those runtime constraints and actual serialized fields, including explicit path definitions and schema metadata descriptions.
- [x] **Step 4: Run the schema-focused tests and fix any runtime/schema discrepancy revealed by them.

### Task 3: Verify and publish

**Files:**
- No additional files.

- [x] **Step 1: Run `npm run lint`.
- [x] **Step 2: Run `npm run typecheck`.
- [x] **Step 3: Run `npm test`.
- [x] **Step 4: Inspect `git diff` and `git status --short` to ensure only the intended implementation, tests, schemas, and planning documents changed.
- [ ] **Step 5: Commit with `feat: initialize project state automatically` and push `main` to `origin`.
