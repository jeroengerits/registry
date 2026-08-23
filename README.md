# UI Registry CLI

[![CI](https://github.com/jeroengerits/registry/actions/workflows/ci.yml/badge.svg)](https://github.com/jeroengerits/registry/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/jeroengerits/registry)](https://github.com/jeroengerits/registry/releases)

Install and manage reusable UI components from Git repositories or local directories. UI Registry copies the files declared by each component into your project and records the installed state in `ui.json`.

## Features

- Install components from GitHub shorthand, Git URLs, or local directories.
- Pin installs and updates to stable component versions.
- Preview changes with dry runs before writing files.
- Update, enable, disable, remove, and roll back components.
- Use JSON output and non-interactive flags in scripts and CI.
- Keep remote sources in a project-local cache that can be cleared safely.
- Inspect project state and component files with `ui doctor`.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Component sources](#component-sources)
- [Updating and rollback](#updating-and-rollback)
- [Component manifest](#component-manifest)
- [Automation](#automation)
- [Development](#development)
- [Release history](#release-history)

## Requirements

- Node.js 22 or newer
- `curl` or `wget` for installation
- Git for remote component sources

## Install

Run the installer from the project directory where you want the `ui` launcher:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

The installer downloads the latest release, installs its dependencies in `.ui-registry/`, and creates a `ui` launcher in the current directory. Add the launcher directory to your `PATH` to run `ui` from anywhere.

The latest release is [v0.0.37](https://github.com/jeroengerits/registry/releases/tag/v0.0.37).

Installer environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `UI_INSTALL_DIR` | Current directory | Directory for the `ui` launcher |
| `UI_CACHE_DIR` | `.ui-registry` | Directory for the CLI installation |
| `UI_REGISTRY_BRANCH` | `main` | Branch downloaded by the installer |
| `UI_CHECK_ONLY` | `0` | Set to `1` to check for updates without installing |

Example:

```sh
UI_INSTALL_DIR="$HOME/.local/bin" \
UI_CACHE_DIR="$HOME/.cache/ui-registry" \
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

## Quick start

```sh
ui init
ui add owner/button
ui list
ui update button
```

`ui init` creates the project state file. A first successful `ui add` also creates `ui.json` when needed. Component changes update the state file and project files transactionally.

Use `ui help <command>` for focused usage and options:

```sh
ui help add
ui help update
```

## Commands

| Command | Description |
| --- | --- |
| `ui init` | Initialize a new UI project |
| `ui add <source>` | Install one or more components |
| `ui list` | List installed components |
| `ui show [name]` | Show component details |
| `ui status` | Show installed component status |
| `ui update [name]` | Update one or all components |
| `ui outdated` | Show available component updates |
| `ui versions <name>` | Show available stable versions |
| `ui remove [name]` | Remove a component and its files |
| `ui undo` | Undo the last component update |
| `ui enable <name>` | Enable a component |
| `ui disable <name>` | Disable a component |
| `ui doctor` | Check project configuration |
| `ui self-update` | Update the CLI |
| `ui completion <shell>` | Print Bash, Zsh, or Fish completions |
| `ui clear-cache` | Remove cached remote component sources |
| `ui changelog [version]` | Show release changes |
| `ui --version` | Print the CLI version |

The legacy `ui component <command>` namespace remains available. The root commands are the recommended interface.

### Common options

Global options can appear before or after a command:

```sh
ui -C ./packages/app list
ui --project ./packages/app update --dry-run
ui list --quiet
ui remove button --yes --no-input
ui list --color=never
```

- `-C`/`--project <path>` selects a project directory.
- `--quiet` suppresses successful output.
- `--no-input` prevents prompts.
- `--color auto|always|never` controls terminal styling.
- `--json` prints machine-readable output for supported commands.
- Set `NO_COLOR=1` to disable colors explicitly.

Successful output is written to stdout. Progress, prompts, warnings, and errors are written to stderr. Piped and CI runs do not prompt or emit terminal styling.

## Component sources

GitHub shorthand and URLs:

```sh
ui add owner/button
ui add https://github.com/owner/button.git
ui add owner/button --version 1.2.3
```

Local component directories:

```sh
ui add ./components/button
ui add /absolute/path/to/button
ui add file:///absolute/path/to/button
```

Use `--dry-run` to preview changes and `--force` to replace an installed component. Use `ui add -` to read newline-delimited sources from stdin:

```sh
printf '%s\n' owner/button ./components/card | ui add -
```

Remote repositories are cloned into the project-local `.ui-sources/` cache. The source path is recorded as `sourcePath` in `ui.json`. Remove cached source checkouts with:

```sh
ui clear-cache --yes
```

The cache command does not remove `.ui-registry`, which contains the active CLI installation.

## Updating and rollback

```sh
# Update every installed component
ui update

# Update one component
ui update button

# Update one component to a stable version
ui update button --version 1.2.3

# Preview updates without writing files
ui update --dry-run

# Inspect or undo the last update
ui undo --list
ui undo
```

Updates preserve a one-step rollback of tracked files and `ui.json`. Use `ui remove button --dry-run` to preview tracked files before removal.

## Component manifest

Each component repository or directory must contain a root `ui.json` manifest:

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
- File paths must not be absolute and must not contain parent-directory segments such as `../`.

See the complete [`schemas/ui.schema.json`](schemas/ui.schema.json) reference. Git component versions come from stable tags such as `v1.2.3`; local directories without Git tags use the version `local`.

## Automation

Use non-interactive mode and JSON output in scripts or CI where supported:

```sh
ui --no-input update --json
ui --no-input remove button --yes --json
```

Install shell completion by evaluating the generated script:

```sh
eval "$(ui completion bash)"
eval "$(ui completion zsh)"
ui completion fish | source
```

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/jeroengerits/registry.git
cd registry
npm install --ignore-scripts
```

Run the individual checks or the complete verification suite:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run verify
```

`npm run verify` runs linting, type checking, tests, and the production build. The GitHub Actions workflow runs the same checks on Node.js 22 for pushes and pull requests.

## Release history

See [`CHANGELOG.md`](CHANGELOG.md) for the complete release history. Release notes are also available from the CLI:

```sh
ui changelog
ui changelog v0.0.37
```

## License

No license file is currently included in this repository. Add a `LICENSE` file before distributing the project under an open-source license.
