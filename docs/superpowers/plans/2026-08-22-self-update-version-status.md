# Self-Update Version Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render current and latest UI Registry versions clearly during `ui self-update`.

**Architecture:** Keep version discovery and update decisions in `install.sh`. Add a small parser/formatter boundary in the self-update command so installer output becomes a stable framed TUI result. Preserve the existing spinner and non-TTY behavior.

**Tech Stack:** TypeScript, Node.js, Vitest, shell installer, Ora, picocolors.

---

### Task 1: Add version-status formatting tests

**Files:**
- Modify: `test/cli.test.ts`
- Modify: `src/cli/commands/self-update.ts`

- [ ] **Step 1: Add fixtures for installer output parsing**

Add tests that exercise the formatter through the exported self-update command helpers. Cover:

```text
Checking installed version: 0.0.1
Checking latest version: 0.0.2
Removing installed version: 0.0.1
Installing latest version: 0.0.2
```

and the current-version output:

```text
Checking installed version: 0.0.1
Checking latest version: 0.0.1
UI Registry is already up to date at v0.0.1.
```

Assert the human-readable frame contains `Current`, `Latest`, and the correct success message.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run test/cli.test.ts -t "self-update version status"`

Expected: FAIL because the command currently emits raw installer lines without a `Current`/`Latest` comparison.

### Task 2: Implement compact status rendering

**Files:**
- Modify: `src/cli/commands/self-update.ts`

- [ ] **Step 1: Parse the two version lines**

Add a private parser returning `{ current?: string; latest?: string }`, matching `Checking installed version: ...` and `Checking latest version: ...`.

- [ ] **Step 2: Render the comparison before installer stages**

Build the frame body with:

```ts
const versionStatus = [
  `Current  ${versions.current ? `v${versions.current}` : 'unknown'}`,
  `Latest   ${versions.latest ? `v${versions.latest}` : 'unknown'}`,
].join('\n');
```

Append `versionStatus`, the installer stage lines excluding the duplicate checking lines, and the existing `outcome(...)` message. Keep the already-current detection based on `already up to date`.

- [ ] **Step 3: Run the focused test and verify it passes**

Run: `npx vitest run test/cli.test.ts -t "self-update version status"`

Expected: PASS.

### Task 3: Verify the complete change

**Files:**
- Verify: `install.sh`
- Verify: `src/cli/commands/self-update.ts`
- Verify: `test/cli.test.ts`

- [ ] **Step 1: Validate shell syntax**

Run: `sh -n install.sh`

Expected: no output and exit code 0.

- [ ] **Step 2: Run repository checks**

Run: `npm run typecheck && npm run lint && npm run build && npm test`

Expected: all commands pass; Vitest reports all tests passing.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/cli/commands/self-update.ts test/cli.test.ts install.sh
git commit -m "feat: show self-update version status"
```

- [ ] **Step 4: Push the implementation**

```bash
git push origin main
```
