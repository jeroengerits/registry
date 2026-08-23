# Changelog

## v0.0.35

- Initialize the target project automatically after npm installation when `ui.json` is absent.

## v0.0.34

- Automatically initialize project state for stateful CLI commands.
- Align the component manifest path schema with runtime validation.

## v0.0.33

- Prompt for a stable component version when running `ui update` interactively.
- Keep non-interactive updates on the latest compatible version path.

## v0.0.32

- Add `ui changelog [version]` for full or version-specific release notes.
- Show the selected release changes after a successful CLI self-update.

## v0.0.31

- Ignore `.ui-rollback/`, the project-local rollback artifact directory.
- Keep `ui.json` trackable as project registry state.

## v0.0.30

- Improve framed command output with consistent `ui <command>` titles.
- Restore actionable next-step guidance in human-readable output.
- Add semantic enabled/disabled status symbols.

## v0.0.29

- Rename the component manifest schema to `schemas/ui.schema.json`.
- Align it with the example component `ui.json` and validate safe relative file paths.

## v0.0.28

- Align published JSON Schemas with the current `ui.json` manifest and project-state contracts.
- Add schema alignment regression coverage.

## v0.0.27

- Make all-component updates report updated and unchanged components consistently.

## v0.0.26

- Harden manifest and persisted state schemas.
- Validate rollback snapshots before restoring them.

## v0.0.25

- Use `ui.json` as the component manifest filename.

## v0.0.24

- Persist remote component source checkouts in `.ui-sources/`.
- Add `ui clear-cache --yes` to remove project-local source checkouts safely.
