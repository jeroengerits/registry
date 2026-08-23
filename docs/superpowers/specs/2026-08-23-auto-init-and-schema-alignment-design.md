# Automatic Project Initialization and Schema Alignment

## Goal

Make the CLI usable in a new project without requiring a separate `ui init` command, while keeping explicit diagnostics and help commands predictable. Ensure the published JSON Schemas describe the data contracts that the TypeScript runtime actually reads and writes.

## Design

Before dispatching a stateful command, silently create the project state file when it does not exist. Initialization uses the existing exclusive `initializeState` operation and copies the host application's package version when available. Explicit `init` remains idempotent and reports whether it created the file. `help`, `doctor`, `completion`, `changelog`, `clear-cache`, `self-update`, and version handling do not create project state; `doctor` must continue to report a missing project as a diagnostic.

The bootstrap is centralized in the CLI entrypoint rather than duplicated across component commands. It runs only for recognized stateful commands, so unknown commands and command-usage errors do not mutate the project. Bootstrap output is silent, including for `--json`, and failures use the existing command error handling.

The component manifest schema remains separate from project state: `ui.schema.json` describes repository manifests consumed by `readComponentManifest`, and `registry.schema.json` describes project state consumed by `readState`. Schema constraints will be aligned with runtime validation for non-blank values, safe relative paths, duplicate target semantics where expressible, and the optional state fields actually persisted by the CLI.

## Testing

Add CLI coverage proving a stateful command creates `ui.json`, that the resulting file contains the expected empty state, that `doctor` remains non-mutating, and that JSON output stays parseable. Extend schema assertions or fixtures for the corrected manifest and registry constraints. Run lint, type checking, and the complete Vitest suite.
