# UI Registry CLI

A local-first registry manager for installed UI components. The MVP reads component state from `ui.json` and does not perform remote installation.

## Usage

Install dependencies and build the CLI:

```sh
npm install
npm run build
```

List installed components with the required script:

```sh
npm run ui:components:list
npm run ui:components:list -- --json
npm run ui:hooks:list
npm run ui:hooks:list -- --json
```

The CLI also supports:

```sh
node bin/ui.js components list [--json]
node bin/ui.js hooks list [--json]
node bin/ui.js components info <name> [--json]
node bin/ui.js manifest validate <file>
node bin/ui.js doctor
node bin/ui.js add <component>
```

When `ui.json` is absent, list prints `No installed components.` and exits successfully. A state file has this shape:

```json
{
  "$schema": "./schemas/ui.schema.json",
  "components": {
    "button": { "version": "1.0.0", "path": "components/button" }
  }
}
```
