# UI Registry CLI

Install and manage Git-based components described by `component.json`.

Current release: [v0.0.14](https://github.com/jeroengerits/registry/releases/tag/v0.0.14)

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

This installs `./ui`. See [docs/installation.md](docs/installation.md) for
configuration and troubleshooting.

## Commands

```sh
./ui
./ui init
./ui update
./ui doctor
./ui component list [--json] [--versions]
./ui component add <repository> [--version <version>] [--dry-run] [--force] [--json]
./ui component remove [name] [--json]
./ui component info <name> [--json]
./ui component update [name] [--json]
./ui component outdated [--json]
./ui component versions <name> [--json]
```

`component update` updates every installed component when no name is given, or
one named component. `--force` overwrites an already installed component. Add
components with a GitHub URL or shorthand such as `owner/repository`.
`component versions` lists stable versions for one installed component.

Every command performs one operation and returns. `./ui component list` lists
components. Details and removal require an explicit name.

Disabled components remain installed and can still be inspected, updated, or
removed. Existing `ui.json` files treat components without an `enabled` field
as enabled.

Human-readable output shows relaxed tables and progress feedback; JSON and CI
output remain plain and script-friendly. Run `ui help <command>` for focused
command help.

The CLI uses Commander.js for parsing, Zod for manifest and state validation,
Execa for Git and package-manager processes, Clack for interactive prompts,
Ora for slow-operation spinners, and Picocolors for semantic terminal output.

## Component Manifest

Every component repository needs a root `component.json`:

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

Component versions come from stable Git tags such as `v1.2.3`. Component
dependencies may use exact, `^major`, or `^major.minor` constraints.

## Development

```sh
npm install
npm test
npm run build
```
