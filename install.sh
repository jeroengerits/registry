#!/bin/sh

set -eu

repository="${UI_REGISTRY_REPOSITORY:-https://github.com/jeroengerits/registry}"
branch="${UI_REGISTRY_BRANCH:-main}"
install_dir="${UI_INSTALL_DIR:-$PWD}"
cache_dir="${UI_CACHE_DIR:-$PWD/.ui-registry}"
archive_url="$repository/archive/refs/heads/$branch.tar.gz"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/ui-registry.XXXXXX")"

current_version='not installed'
if [ -f "$cache_dir/package.json" ]; then
  current_version="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version" "$cache_dir/package.json" 2>/dev/null || printf '%s' 'unknown')"
fi

cleanup() {
  rm -rf "$temporary_dir"
}
trap cleanup EXIT INT TERM

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'ui-registry requires Node.js 22 or newer.' >&2
  exit 1
fi


node_version="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_version" -lt 22 ]; then
  printf '%s\n' "ui-registry requires Node.js 22 or newer (found Node.js $node_version)." >&2
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$archive_url" -o "$temporary_dir/source.tar.gz"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$temporary_dir/source.tar.gz" "$archive_url"
else
  printf '%s\n' 'ui-registry requires curl or wget.' >&2
  exit 1
fi

tar -xzf "$temporary_dir/source.tar.gz" -C "$temporary_dir"
source_dir="$temporary_dir/registry-$branch"

(cd "$source_dir" && npm_config_loglevel=error npm install --ignore-scripts --no-package-lock --no-audit --no-fund >/dev/null)
(cd "$source_dir" && npm_config_loglevel=error npm run build >/dev/null)

latest_version="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version" "$source_dir/package.json")"
printf 'Checking latest version: %s\n' "$latest_version"

if [ "$current_version" = "$latest_version" ]; then
  printf 'UI Registry is already up to date at v%s.\n' "$current_version"
  exit 0
fi

if [ "${UI_CHECK_ONLY:-0}" = '1' ]; then
  exit 0
fi

printf 'Removing installed version: %s\n' "$current_version"
rm -rf "$cache_dir"
mkdir -p "$(dirname "$cache_dir")"
printf 'Installing latest version: %s\n' "$latest_version"
mv "$source_dir" "$cache_dir"

mkdir -p "$install_dir"
launcher="$install_dir/ui"
cat > "$launcher" <<EOF
#!/bin/sh
export UI_INSTALL_DIR="$install_dir"
export UI_CACHE_DIR="$cache_dir"
exec node "$cache_dir/bin/ui.js" "\$@"
EOF
chmod 755 "$launcher"

if [ "${UI_SELF_UPDATE:-0}" != '1' ]; then
  printf 'Installed ui to %s\n' "$launcher"
  printf '\nWelcome to UI Registry.\n\n'
  printf 'Run %s help for full command information.\n\n' "$launcher"
fi

if [ "$#" -gt 0 ]; then
  exec "$launcher" "$@"
fi
