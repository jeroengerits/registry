# CLI Command Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the crowded component picker with a focused dashboard and consistent command output.

**Architecture:** Keep existing component handlers and JSON behavior. Add a small interactive dashboard orchestrator that composes those handlers, while `ui.ts` owns only prompt choices and presentation helpers.

**Tech Stack:** TypeScript, Commander, Clack prompts, Ora, Vitest.

---

### Task 1: Implement the focused dashboard

**Files:**
- Create: `src/cli/commands/component/dashboard.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/ui.ts`

- [ ] Add dashboard and detail action loops using existing list/info/add/update/remove/toggle handlers.
- [ ] Expose only list, add, update, and remove in the primary picker.
- [ ] Use one interactive session for dashboard navigation and write each completed frame once.

### Task 2: Clean self-update output

**Files:**
- Modify: `src/cli/commands/self-update.ts`
- Modify: `install.sh`

- [ ] Read the current cached package version before invoking the installer.
- [ ] Filter installer welcome, launcher path, and help-banner lines from the rendered result.
- [ ] Render current/latest versions, decision, and concise update stages in one frame.

### Task 3: Update coverage and docs

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `README.md`
- Modify: `docs/installation.md`
- Modify: `src/cli/commands/help.ts`
- Modify: `src/cli/commands/component/help.ts`

- [ ] Test reduced picker actions, dashboard navigation, and clean self-update formatting.
- [ ] Document the focused command model and dashboard actions.

### Task 4: Verify and release the change

- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `sh -n install.sh`.
- [ ] Commit with `feat: redesign component command dashboard`.
- [ ] Push `main`.
