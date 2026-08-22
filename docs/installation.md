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

It writes the launcher to `~/.local/bin/ui` and the built CLI to
`~/.cache/ui-registry`. Add `~/.local/bin` to `PATH` when necessary:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## One-Shot Commands

Arguments after the installer command are forwarded to `ui`, so installation
and the first registry operation can happen in one command:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh \
  | sh -s -- add https://github.com/example/button.git --yes
```

## Update

Run the installer again to download and build the latest CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/jeroengerits/registry/main/install.sh | sh
```

The installer replaces the cached build only after the download and build
complete successfully.

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
ui doctor
ui components list
```

`ui` operates on the current working directory. It stores installed component
state in `ui.json` and never installs npm packages until an `add` or `update`
operation requires them.
