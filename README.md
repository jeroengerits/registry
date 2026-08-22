# UI Registry CLI

A local-first registry manager for installing components described by `component.json` from Git repositories.

## Usage

Install the CLI directly from GitHub:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

The installer requires Node.js 22 or newer, builds the CLI in
`./.ui-registry`, and installs `./ui` in the current working directory. Run it
as `./ui`, or add the current directory to `PATH`. To install and run a command
in one step:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh -s -- component add https://github.com/example/button.git
```

To refresh the installed CLI, run the installer again. The repository and
branch can be overridden with `UI_REGISTRY_REPOSITORY` and `UI_REGISTRY_BRANCH`.

For local development, install dependencies and build the CLI:

```sh
npm install
npm run build
```

Use the installed CLI to inspect and manage the current project:

```sh
./ui component list
./ui component list --json
./ui component info button
./ui component add https://github.com/example/button.git
./ui component remove button
./ui self-update
./ui help
```

The same commands can be run directly from a local checkout during development:

```sh
node bin/ui.js component list [--json]
node bin/ui.js component info <name> [--json]
node bin/ui.js component add <github-url>
node bin/ui.js component remove <name>
node bin/ui.js help
```

See [docs/installation.md](docs/installation.md) for installer behavior,
configuration, and troubleshooting.

When `ui.json` is absent, list prints `No installed components.` and exits successfully. A state file has this shape:

```json
{
  "$schema": "./schemas/ui.schema.json",
  "components": {
    "button": {
      "version": "1.0.0",
      "path": "components/button.tsx",
      "files": [{ "path": "components/button.tsx", "sha256": "..." }]
    }
  }
}
```

`component.json` must be at the repository root and uses `schemaVersion: 1`, a name, optional description, file mappings, npm dependency ranges as an object, and component repository references as `{ "repository": "...", "version": "..." }` objects. `component add` recursively installs component dependencies, validates every repository, source, and target before changing the project, and detects cycles. Tags must be stable `x.y.z` versions; exact, `^major`, and `^major.minor` constraints are supported. HTTPS, SSH, and local filesystem Git references are accepted.

Example manifest:

```json
{
  "schemaVersion": 1,
  "name": "button",
  "description": "A button",
  "files": [{ "source": "src/button.tsx", "target": "components/button.tsx" }],
  "dependencies": { "@radix-ui/react-slot": "^1.0.0" },
  "components": [{ "repository": "https://github.com/example/icon.git", "version": "^2.1" }]
}
```
