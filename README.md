# UI Registry CLI

Install and manage reusable UI components from Git repositories or local directories.

Latest release: [v0.0.16](https://github.com/jeroengerits/registry/releases/tag/v0.0.16)

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

This installs the `ui` launcher in the current directory.

## Quick Start

```sh
./ui init
./ui component add owner/button
./ui component list
```

The project state is stored in `ui.json`.

## Commands

```text
ui init                              Initialize the current project
ui update                            Update the UI Registry CLI
ui doctor                            Check project and component files

ui component list                    List installed components
ui component info <name>             Show component details
ui component add <source>            Add a Git or local component
ui component remove <name>           Remove a component and its files
ui component update [name]           Update one or all components
ui component outdated                Show compatible component updates
ui component versions <name>         List stable versions
ui component revert                  Undo the last component update
```

Use `ui help <command>` for focused help. Add `--json` to commands that support machine-readable output.

### Component Sources

GitHub shorthand and URLs:

```sh
./ui component add owner/button
./ui component add https://github.com/owner/button.git
./ui component add owner/button --version 1.2.3
```

Local component directories:

```sh
./ui component add ./components/button
./ui component add /absolute/path/to/button
./ui component add file:///absolute/path/to/button
```

Use `--dry-run` to preview changes and `--force` to replace an installed component.

### Updating Components

```sh
# Update every installed component
./ui component update

# Update one component
./ui component update button

# Update one component to a specific stable version
./ui component update button --version 1.2.3

# Undo the last component update
./ui component revert
```

Update output shows the current version, new version, status, and the available undo command. Component updates preserve a one-step rollback of tracked files and `ui.json`.

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
