# Installation

The supported installation path downloads the CLI source from GitHub, builds
it locally, and installs a small `ui` launcher.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

The installer requires:

- Node.js 22 or newer;
- `curl` or `wget`;
- `tar`.

The current release is `v0.0.8`. The installer builds the CLI locally from the
selected repository branch, so Node.js is also required for self-updates.

It writes the launcher to `./ui` and the built CLI to `./.ui-registry`, relative
to the directory where the installer is run. Run the launcher explicitly:

```sh
./ui component list
```

Or add the current directory to `PATH` when necessary:

```sh
export PATH="$(pwd):$PATH"
```

## One-Shot Commands

Arguments after the installer command are forwarded to `ui`, so installation
and the first registry operation can happen in one command:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh \
  | sh -s -- component add https://github.com/example/button.git
```

## Update

Run the installed CLI to download and build the latest version:

```sh
./ui update
```

This preserves the launcher and replaces the cached build only after the
download and build complete successfully. The installer can still be run
directly when the launcher is unavailable:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

## Configuration

The defaults target the public repository and `main` branch. Override them for
development or a private fork:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh \
  | UI_REGISTRY_REPOSITORY=https://github.com/acme/registry UI_REGISTRY_BRANCH=develop sh
```

The install and cache locations can also be changed:

```sh
UI_INSTALL_DIR="$HOME/bin" UI_CACHE_DIR="$HOME/.cache/acme-ui" \
  sh install.sh
```

## Verify

```sh
./ui help
./ui component list
./ui component remove <name>
./ui component update <name>
```

The complete command set is:

```text
ui update
ui doctor
ui component list [--json] [--versions]
ui component add <repository> [--version <version>] [--dry-run] [--force] [--json]
ui component remove [name] [--json]
ui component info <name> [--json]
ui component enable <name> [--json]
ui component disable <name> [--json]
ui component update [name] [--json]
ui component outdated [--json]
ui component versions <name> [--json]
```

Every command performs one operation and returns. Commands that inspect, enable,
disable, or remove a component require its explicit name. Only version selection
and destructive confirmation may prompt.

Initialize a project before installing components:

```sh
./ui init
```

Add a component by URL or owner/repository shorthand with an exact version:

```sh
./ui component add example/button --version 1.2.3
```

If `--version` is omitted, the latest stable version is selected.

The enable/disable commands change only the enabled status persisted in `ui.json`;
they never remove or restore files.

Show available stable versions for one installed component:

```sh
./ui component versions button
```

`ui` operates on the current working directory. The launcher and its cache are
local to the installation directory, while it stores installed component
state in `ui.json` and installs declared npm dependencies during `component add`.
The root app version from `package.json` is recorded in `ui.json`. Interactive
spinners and colors are disabled for JSON, CI, and redirected output.
