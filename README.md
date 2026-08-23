# UI Registry CLI

Install and manage reusable UI components from Git repositories or local directories.

Latest release: [v0.0.19](https://github.com/jeroengerits/registry/releases/tag/v0.0.19)

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

This installs the `ui` launcher in the current directory.

## Quick Start

```sh
./ui init
./ui add owner/button
./ui list
```

The project state is stored in `ui.json`.

## Commands

```text
ui init                              Initialize the current project
 ui self-update                       Update the UI Registry CLI
 ui doctor                            Check project and component files

 ui add <source>                      Add a Git or local component
 ui list                              List installed components
 ui show <name>                       Show component details
ui remove <name>                     Remove a component and its files
ui status                            Show installed component status
ui update [name]                     Update one or all components
 ui outdated                          Show compatible component updates
 ui versions <name>                   List stable versions
ui undo                              Undo the last component update
 ui enable <name>                     Enable a component
ui disable <name>                    Disable a component
ui completion <shell>                Print Bash, Zsh, or Fish completions
```

Use `ui help <command>` for focused help. Add `--json` to commands that support machine-readable output.

Install shell completion by evaluating the generated script:

```sh
eval "$(ui completion bash)"
eval "$(ui completion zsh)"
ui completion fish | source
```

Global Unix-style options can be placed before or after the command:

```sh
ui -C ./packages/app list
ui --project ./packages/app update --dry-run
ui list --quiet
ui remove button --yes --no-input
ui list --color=never

```

Successful output is written to stdout. Progress, prompts, warnings, and errors are written to stderr. Piped and CI runs do not prompt or emit terminal styling. Set `NO_COLOR=1` to disable colors explicitly.

Use `ui add -` to install newline-delimited component sources from stdin. Empty lines are ignored, so the command composes naturally with shell pipelines.

### Component Sources

GitHub shorthand and URLs:

```sh
./ui add owner/button
./ui add https://github.com/owner/button.git
./ui add owner/button --version 1.2.3
```

Local component directories:

```sh
./ui add ./components/button
./ui add /absolute/path/to/button
./ui add file:///absolute/path/to/button
```

Use `--dry-run` to preview changes and `--force` to replace an installed component.

Use `ui remove button --dry-run` to preview tracked files before removal. Use `ui undo --list` to check whether a rollback point is available without changing files.

### Updating Components

```sh
# Update every installed component
./ui update

# Update one component
./ui update button

# Update one component to a specific stable version
./ui update button --version 1.2.3

# Undo the last component update
./ui undo
```

Update output shows the current version, new version, status, and the available undo command. Component updates preserve a one-step rollback of tracked files and `ui.json`.

## Changelog

### Unreleased

Future changes will be listed here before the next release.

### v0.0.19

- Added `ui status` as a direct status command.
- Added `ui undo --list` to inspect rollback availability without mutating files.
- Added `ui remove <name> --dry-run` to preview tracked files before removal.

### v0.0.18

- Added `ui add -` for newline-delimited component sources from stdin.
- Kept unexpected `--json` failures machine-readable on stdout.
- Made `--quiet` suppress progress spinners as well as result output.

### v0.0.17

- Added Unix-first output behavior: successful results go to stdout, diagnostics go to stderr, and non-interactive runs never prompt.
- Added short top-level component commands such as `ui add`, `ui list`, `ui update`, and `ui undo` while retaining `ui component ...` compatibility commands.
- Added idempotent `ui enable` and `ui disable` commands.
- Added explicit `--yes` confirmation for non-interactive component removal.
- Added `-C`/`--project`, `--quiet`, `--no-input`, and explicit color policy options.
- Added update dry runs, JSON-compatible self-update and rollback responses, and invalid-usage exit code `2`.

### v0.0.16

- Added targeted component updates with `ui component update <name>`.
- Added stable `--version` selection for component updates.
- Improved update planning, rollback reporting, and CI-safe color handling.

### v0.0.15

- Simplified the CLI README and documented local component sources.
- Removed obsolete component commands and helpers.

### v0.0.14

- Added local component directory support, including relative, absolute, and `file://` paths.

### v0.0.13

- Hardened component update planning and transactional filesystem changes.

### v0.0.11

- Improved update flow UX and component status reporting.

### v0.0.10

- Improved compatible component update resolution.

### v0.0.9

- Centralized CLI helpers and improved command reliability.

### v0.0.8

- Added `ui init` project initialization.

### v0.0.7

- Simplified component commands and added colorized human output.

### v0.1.0

- Added top-level namespace selection and terminal tables.

### v0.0.5

- Added interactive namespace selection and improved component tables.

### v0.0.4

- Redesigned the component command dashboard and improved component status output.

### v0.0.3

- Added the first component command dashboard.

### v0.0.2

- Added release tooling and improved CLI command organization.

### v0.0.1

- Initial component lifecycle CLI with installation, listing, version selection, removal, and self-update support.

Versions `v0.0.6` and `v0.0.12` do not have published releases in the repository history and are intentionally omitted.

## Component Manifest

Each component directory must contain a root `component.json`:

```json
{
  "schemaVersion": 1,
  "name": "button",
  "files": [
    { "source": "src/button.tsx", "target": "components/button.tsx" }
  ],
  "dependencies": {},
  "components": []
}
```

- `schemaVersion` must be `1`.
- `name` must be lowercase kebab-case.
- `files` maps component files to safe project-relative targets.
- `dependencies` contains package-manager dependencies.
- `components` contains other component repositories and optional version constraints.

Git component versions come from stable tags such as `v1.2.3`. Local directories without Git tags use the version `local`.

## Output

Interactive terminals use Clack prompts, Ora spinners, semantic Picocolors, and tables. Piped, CI, and `--json` output stays script-friendly and avoids interactive prompts.

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Before every version release, add the user-facing changes to the matching version under `## Changelog`, update the version, and verify the release entry describes the shipped behavior. Changes after a release belong under `Unreleased` until the next version is cut.
