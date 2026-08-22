# Compact CLI Dashboard Design

## Goal

Improve the one-shot terminal experience for every `ui` command while keeping
the CLI compact, consistent, scriptable, and usable in plain terminals. Add a
per-component enabled/disabled toggle without changing installed files.

## Scope

- Keep the existing one-shot command model; do not introduce a full-screen TUI.
- Give each human-readable command a dedicated information layout.
- Add `ui component toggle [name] [--json]`.
- Show component status in `list` and `info`.
- Preserve JSON output as ANSI-free, prompt-free machine-readable output.
- Keep existing Git, npm, manifest, and installation behavior unchanged.

## Visual Language

Every human-readable command uses the compact registry identity line:

```text
◆ UI REGISTRY  ·  <command>
────────────────────────────────────────
```

The body is command-specific:

- `list`: aligned component table with count, enabled count, status, version,
  and path.
- `info`: labeled component inspection with status prominent and repository,
  version, files, dependencies, and location.
- `add`: staged checklist for validation, file copy, dependencies, and final
  installed version.
- `update`: before/after version summary followed by changed-file result.
- `remove`: selected component, affected files, confirmation, and final result.
- `toggle`: previous status, arrow, new status, and final result.
- `self-update`: source/build/update stages followed by the installed CLI
  version.

Use symbols and text in addition to color: `✓` success, `!` warning, `×`
error, `●` enabled, and `○` disabled. Avoid decorative borders beyond the
single frame separator. Do not emit ANSI codes for JSON, CI, or redirected
output.

## Interaction Model

Interactive commands remain one-shot. Clack provides component and version
selection, confirmation, and cancellation. A missing component name for
`info`, `remove`, or `toggle` opens a component picker only when interactive.
The `list` command displays status and may offer a follow-up toggle action in
interactive mode; it does not become a persistent dashboard.

The only status mutation command is:

```text
ui component toggle [name] [--json]
```

With a name, it flips exactly one component. Without a name, it selects one
component interactively. Non-interactive invocation without a name returns a
usage error. Toggle is idempotent with respect to the resulting state and
never changes component files, dependencies, versions, or repositories.

## State Model

Each installed component record gains:

```json
{ "enabled": true }
```

The current manual state validator will be replaced by a strict Zod state
schema. It will default missing `enabled` values to `true`, so existing
`ui.json` files remain valid and are normalized on read/write. State loading
will use `safeParse` at the file boundary and format validation failures into
actionable CLI errors. The public `schemas/ui.schema.json` will also include
the optional persisted `enabled` boolean.

`list` and `info` read the state only. Toggle performs one validated state
mutation and persists it atomically enough to preserve the existing state on
write failure.

## Library Responsibilities

- Clack: all interactive selections, confirmations, and cancellation handling.
- Commander.js: command registration, arguments, options, help, and usage
  errors.
- Picocolors: shared semantic colors for headings, metadata, statuses, and
  outcomes, with color disabled for non-interactive output.
- Ora: shared operation spinner for Git, npm, self-update, add, update,
  remove, and slow filesystem operations; no spinner flash for fast actions.
- Zod: component manifests, persisted `ui.json`, toggle state, and structured
  command result validation. Use strict schemas, inferred types, defaults for
  backwards-compatible fields, and `safeParse` for recoverable file/input
  errors.
- Execa: all Git/npm process execution and normalized subprocess errors.

## Error Handling

- Unknown component: show the requested name, available installed names when
  useful, and exit with code `1`.
- Picker cancellation: report `Operation cancelled.` and exit with code `1`.
- Invalid state or manifest: show the validation issue without writing changes.
- Git/npm failure: stop the spinner, show a concise cause, and avoid raw
  subprocess noise unless verbose diagnostics already exist.
- JSON errors: return structured JSON only, with no prompts, colors, or spinner
  control sequences.
- Limited/non-TTY terminal: skip Clack and Ora, keep symbols and labels
  readable without relying on color, and require explicit component names for
  operations that otherwise need a picker.

## Testing

- Unit-test state defaulting and toggle transitions in both directions.
- Test legacy `ui.json` data without `enabled` as enabled.
- Test named and interactive toggle flows, cancellation, unknown components,
  and non-interactive missing-name errors.
- Test list/info status rendering and JSON output.
- Test each command's human-readable output for the shared identity line and
  command-specific result structure.
- Test spinner suppression below the interactive delay threshold and plain
  output under `NO_COLOR`, CI, redirected stdout, and redirected stderr.
- Run the existing test, lint, typecheck, and build scripts before release.

## Acceptance Criteria

- All commands have a clear, dedicated human-readable layout.
- Component status is visible in list and info output.
- `component toggle` changes only persisted enabled state.
- Existing installations default to enabled without migration failure.
- All requested libraries have consistent, purposeful roles.
- JSON, CI, and redirected output remain automation-safe.
- Existing behavior and tests remain intact except for documented output and
  state additions.
