# UI Registry CLI

Install and manage Git-based components described by `component.json`.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

This installs `./ui`. See [docs/installation.md](docs/installation.md) for
configuration and troubleshooting.

## Commands

```sh
./ui component list [--json] [--available-versions]
./ui component info <name> [--json]
./ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
./ui component remove <name> [--json]
./ui component update <name> [--json]
./ui self-update
```

`component update` selects the newest compatible Git tag. `--force` overwrites
an already installed component. Add a specific tag with `--version`; without
it, interactive terminals let you choose a stable tag with the latest tag
preselected. Non-interactive runs select the latest automatically and show the
available versions.
`--available-versions` shows all stable tags for each installed component.

Interactive terminals show colored status and progress feedback; JSON and CI
output remain plain and script-friendly.

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
