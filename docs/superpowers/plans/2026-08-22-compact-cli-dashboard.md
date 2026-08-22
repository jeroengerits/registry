# Compact CLI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every human-readable `ui` command a compact dedicated layout and add a persisted per-component `component toggle` command without changing installed files.

**Architecture:** Keep the existing one-shot command pipeline and `CommandResult` return type. Centralize semantic output formatting and operation feedback in `src/cli/ui.ts`, keep command-specific layouts in command modules, and validate persisted state with a strict Zod schema that defaults legacy components to enabled.

**Tech Stack:** TypeScript, Commander.js, @clack/prompts, Picocolors, Ora, Zod, Execa, Vitest.

---

## File Map

- Modify `src/types.ts`: add `enabled` to `ComponentState` and define toggle result types.
- Modify `src/state.ts`: replace manual state validation with strict Zod parsing and default `enabled: true`.
- Modify `schemas/ui.schema.json`: document the optional enabled property.
- Modify `src/cli/ui.ts`: add shared frame, semantic status, result, prompt, and delayed-spinner helpers.
- Modify `src/cli/commands/component/list.ts`: render the compact component table and status counts.
- Modify `src/cli/commands/component/info.ts`: render the dedicated detail layout and status.
- Modify `src/cli/commands/component/add.ts`: render staged install output through shared helpers.
- Modify `src/cli/commands/component/update.ts`: render before/after update output.
- Modify `src/cli/commands/component/remove.ts`: render selection, confirmation, and removal result.
- Create `src/cli/commands/component/toggle.ts`: flip one persisted component status.
- Modify `src/cli/commands/self-update.ts`: render staged self-update output.
- Modify `src/cli/commands.ts`: export the toggle command.
- Modify `src/cli/index.ts`: register `component toggle [name] [--json]`.
- Modify `src/cli/commands/help.ts`: document the new command and output behavior.
- Modify `test/cli.test.ts`: cover state migration, toggle flows, status output, and JSON behavior.
- Modify `README.md` and `docs/installation.md`: document toggle and status semantics.

### Task 1: Add strict persisted state schema

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state.ts`
- Modify: `schemas/ui.schema.json`
- Test: `test/cli.test.ts`

- [ ] **Step 1: Write failing state migration and toggle-state tests**

Add a test fixture with a legacy component record that has no `enabled` field,
run `component list --json`, and assert the returned record contains
`"enabled":true`. Add a second fixture with `"enabled":false` and assert it is
preserved.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --run test/cli.test.ts`

Expected: the new assertions fail because `enabled` is not currently present.

- [ ] **Step 3: Define the state schema and inferred types**

In `src/types.ts`, add `enabled: boolean` to `ComponentState`. In `src/state.ts`,
define strict schemas for installed files, component references, component
state, and UI state. Use `enabled: z.boolean().default(true)` and
`safeParse` at the `ui.json` boundary. Convert Zod issues to the existing
human-readable `ui.json ...` error style, and return the parsed output.

- [ ] **Step 4: Update the public JSON schema**

Add an optional `enabled` boolean to each component entry in
`schemas/ui.schema.json`; omission remains valid for legacy files.

- [ ] **Step 5: Run focused tests and full static checks**

Run: `npm test -- --run test/cli.test.ts`

Expected: state migration and preservation tests pass.

Run: `npm run lint && npm run typecheck`

Expected: both commands pass.

- [ ] **Step 6: Commit the state migration**

```sh
git add src/types.ts src/state.ts schemas/ui.schema.json test/cli.test.ts
git commit -m "feat: persist component enabled state"
```

### Task 2: Create shared compact terminal UI primitives

**Files:**
- Modify: `src/cli/ui.ts`
- Test: `test/cli.test.ts`

- [ ] **Step 1: Add output contract tests**

Assert human-readable output contains `UI Registry`, a command label, and
semantic status symbols. Assert `--json` output contains no ANSI escape code,
prompt text, spinner frame, or frame header.

- [ ] **Step 2: Implement shared helpers**

Add helpers with these signatures:

```ts
export function frame(command: string, body: string, footer?: string): string;
export function status(enabled: boolean): string;
export function outcome(message: string, kind: 'success' | 'warning' | 'error'): string;
export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled?: boolean): Promise<T>;
```

Use Picocolors for semantic color only, Clack cancellation helpers for all
selectors, and Ora only after a short delay so fast operations do not flash.
Keep `interactive()` TTY/CI detection and ensure every helper returns plain
text when non-interactive or `NO_COLOR` is set.

- [ ] **Step 3: Run output tests**

Run: `npm test -- --run test/cli.test.ts`

Expected: shared output assertions pass without changing JSON output.

- [ ] **Step 4: Commit the UI primitives**

```sh
git add src/cli/ui.ts test/cli.test.ts
git commit -m "refactor: add shared cli output primitives"
```

### Task 3: Implement the toggle command

**Files:**
- Create: `src/cli/commands/component/toggle.ts`
- Modify: `src/cli/commands.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/commands/help.ts`
- Test: `test/cli.test.ts`

- [ ] **Step 1: Write failing named toggle tests**

Create one enabled component, run `component toggle button`, assert exit code
`0`, assert output contains `● enabled` after `○ disabled`, and assert the
persisted state is false. Run the same command again and assert it returns to
enabled. Verify files and version remain unchanged.

- [ ] **Step 2: Write failing JSON toggle tests**

Run `component toggle button --json` and assert the parsed object contains the
component name, `previousStatus`, `status`, and updated component record, with
no ANSI sequences or interactive prompt text.

- [ ] **Step 3: Implement `toggleComponent`**

Implement `toggleComponent(cwd, name, json)` by reading validated state,
resolving the named component, flipping only `enabled`, writing state through
the existing atomic writer, and returning either structured JSON or the
dedicated toggle frame. Return exit code `1` for missing state, unknown names,
invalid state, or write failures.

- [ ] **Step 4: Register the command and help**

Register `component.command('toggle [name]')` with `--json`, export the command,
and add its usage, semantics, and examples to `help.ts`.

- [ ] **Step 5: Test cancellation and non-interactive errors**

Add tests for a missing name without a TTY, an empty component registry, an
unknown name, and a cancelled Clack picker. Each must exit `1` without writing
state.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- --run test/cli.test.ts`

Expected: all toggle tests pass.

```sh
git add src/cli/commands/component/toggle.ts src/cli/commands.ts src/cli/index.ts src/cli/commands/help.ts test/cli.test.ts
git commit -m "feat: add component toggle command"
```

### Task 4: Upgrade list and info layouts

**Files:**
- Modify: `src/cli/commands/component/list.ts`
- Modify: `src/cli/commands/component/info.ts`
- Modify: `test/cli.test.ts`

- [ ] **Step 1: Add list status assertions**

Assert list output includes installed count, enabled count, disabled count,
aligned name/version/status/path columns, and `●`/`○` status labels. Assert
JSON includes normalized `enabled` values and keeps available versions when
requested.

- [ ] **Step 2: Add info status assertions**

Assert info output places status next to the component identity and includes
version, repository, location, file count, dependency count, and the exact
`ui component toggle <name>` next step.

- [ ] **Step 3: Implement dedicated layouts**

Use the shared frame and status helpers. Keep available-version Git lookups in
the existing Ora wrapper, and do not run them in JSON mode unless explicitly
requested by the current flag.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- --run test/cli.test.ts`

```sh
git add src/cli/commands/component/list.ts src/cli/commands/component/info.ts test/cli.test.ts
git commit -m "feat: show component status in list and info"
```

### Task 5: Upgrade mutation command layouts and prompts

**Files:**
- Modify: `src/cli/commands/component/add.ts`
- Modify: `src/cli/commands/component/update.ts`
- Modify: `src/cli/commands/component/remove.ts`
- Modify: `src/cli/commands/self-update.ts`
- Modify: `src/cli/ui.ts`
- Modify: `test/cli.test.ts`

- [ ] **Step 1: Add output regression assertions**

For add, update, remove, and self-update, assert the human-readable output has
the shared frame, command-specific stage/result text, semantic success/error
symbols, and a next-step or final outcome. Assert existing error messages stay
actionable.

- [ ] **Step 2: Refactor add and update progress through shared helpers**

Wrap Git, npm, and slow filesystem actions with the shared delayed Ora helper.
Use Clack group/select flows for multi-step interactive decisions and preserve
the current latest-version selection behavior.

- [ ] **Step 3: Refactor remove confirmation and result**

Keep the existing picker, add explicit confirmation before deletion, and render
the selected component, affected path count, and final result in the remove
layout. Never alter files if cancellation occurs.

- [ ] **Step 4: Refactor self-update output**

Render source download, build, and cache replacement as concise stages, then
show the resulting CLI version. Preserve the safe replacement behavior.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

```sh
git add src/cli/commands/component/add.ts src/cli/commands/component/update.ts src/cli/commands/component/remove.ts src/cli/commands/self-update.ts src/cli/ui.ts test/cli.test.ts
git commit -m "feat: standardize cli command layouts"
```

### Task 6: Update documentation and verify the release

**Files:**
- Modify: `README.md`
- Modify: `docs/installation.md`
- Modify: `docs/superpowers/specs/2026-08-22-compact-cli-dashboard-design.md`
- Modify: `schemas/ui.schema.json` if schema examples need alignment

- [ ] **Step 1: Document status and toggle**

Add `ui component toggle [name] [--json]`, explain that disabled components
remain installed and are not removed or skipped automatically, and show list
and info status examples.

- [ ] **Step 2: Document output modes**

State that Clack/Ora/Picocolors are used only for interactive human-readable
output and that JSON/CI/redirected output is plain and automation-safe.

- [ ] **Step 3: Run complete verification**

Run:

```sh
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: all commands pass and `git diff --check` is silent.

- [ ] **Step 4: Commit and push the completed feature**

```sh
git add README.md docs/installation.md docs/superpowers/specs/2026-08-22-compact-cli-dashboard-design.md schemas/ui.schema.json
git commit -m "feat: improve cli tui ux and component status"
git push origin main
git status -sb
```

Expected: `main` is clean and tracks `origin/main`.
