# UI Registry CLI

A local-first registry manager for installing components described by `components.json` from Git repositories.

## Usage

Install the CLI directly from GitHub:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

The installer requires Node.js 22 or newer, builds the CLI in
`~/.cache/ui-registry`, and installs `ui` in `~/.local/bin`. Add that directory
to `PATH` if it is not already available. To install and run a command in one
step:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh -s -- add https://github.com/example/button.git --yes
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
ui components list
ui components list --json
ui components info button
ui add https://github.com/example/button.git --yes
ui update button --overwrite
ui remove button
```

The same commands can be run directly from a local checkout during development:

```sh
node bin/ui.js components list [--json]
node bin/ui.js hooks list [--json]
node bin/ui.js components create <name> [--json]
node bin/ui.js components info <name> [--json]
node bin/ui.js manifest validate <file>
node bin/ui.js manifest check <file>
node bin/ui.js doctor
node bin/ui.js add <component>
node bin/ui.js add <git-url-or-path>[#version] --yes
node bin/ui.js add <git-url-or-path>[#version] --dry-run --json
node bin/ui.js update <git-url-or-path>[#version] --overwrite
node bin/ui.js remove <name> [--overwrite]
node bin/ui.js manifest generate components.json [output]
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

`components.json` uses `schemaVersion: 1`, a name, optional description, file mappings, npm dependency ranges as an object, and component repository references as `{ "repository": "...", "version": "..." }` objects. `add` recursively installs component dependencies, validates every repository, source, and target before changing the project, and detects cycles. Tags must be stable `x.y.z` versions; exact, `^major`, and `^major.minor` constraints are supported. HTTPS, SSH, and local filesystem Git references are accepted.

Create a starter React component package with `npm run ui:components:create -- <name>`. It creates `components/<name>/package.json`, an editable `components.json`, and `src/<name>.tsx` mapped to `components/<name>.tsx`; it never overwrites an existing component directory.

`remove` and `update` refuse to overwrite locally changed files when hashes are available; `--overwrite` explicitly bypasses that protection. The CLI never uninstalls npm packages. `manifest generate <repository-directory> [output]` infers a manifest from `package.json` and tracked TypeScript source files; `manifest check` validates the JSON and confirms all declared source files exist. `ui update` updates all installed components, while `ui update <name>` updates one installed component.

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
