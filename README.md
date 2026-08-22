# UI Registry CLI

Install and manage Git-based components described by `component.json`.

Current release: [v0.0.5](https://github.com/jeroengerits/registry/releases/tag/v0.0.5)

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

This installs `./ui`. See [docs/installation.md](docs/installation.md) for
configuration and troubleshooting.

## Commands

```sh
./ui
./ui components
./ui hooks
./ui component list [--json] [--available-versions]
./ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
./ui component remove [name] [--json]
./ui component update [name] [--json]
./ui self-update
```

`component update` selects the newest compatible Git tag. `--force` overwrites
an already installed component. Add a specific tag with `--version`; without
it, interactive terminals let you choose a stable tag with the latest tag
preselected. Non-interactive runs select the latest automatically and show the
available versions.
`--available-versions` shows all stable tags for each installed component.

Run `./ui` or `./ui component` in an interactive terminal to open the component
dashboard. Details and enable/disable actions are available after selecting a
component. In CI or a redirected terminal, it prints the component command
reference instead.

Disabled components remain installed and can still be inspected, updated, or
removed. Existing `ui.json` files treat components without an `enabled` field
as enabled.

Interactive terminals show colored status and progress feedback; JSON and CI
output remain plain and script-friendly.

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
