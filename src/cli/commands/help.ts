import type { CommandResult } from '../../types.js';

export function help(): CommandResult {
  return {
    output: `UI Registry

Install and manage components from GitHub repositories.

Commands:
  ui help
    Show this help.

  ui self-update
    Update the installed UI Registry CLI.

  ui component list [--json] [--available-versions]
    List components installed in the current directory.

  ui component info [name] [--json]
    Show details for an installed component; interactive terminals prompt if omitted.

  ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
    Validate root component.json and install the component locally.
    Use --force to overwrite an already installed component.
    Use --dry-run to preview changes and --json for machine-readable output.

  ui component remove [name] [--json]
    Remove an installed component and its files; interactive terminals prompt if omitted.

  ui component toggle [name] [--json]
    Toggle an installed component's enabled status without changing its files.

  ui component update [name] [--json]
    Update a component to the newest compatible Git tag.

Requirements:
  - component.json must be in the repository root.
  - The repository must contain a stable semver Git tag.
  - Component files must use safe relative source and target paths.

Examples:
  ui self-update
  ui component add https://github.com/example/button.git
  ui component add https://github.com/example/button.git --force
  ui component remove button
  ui component toggle button
  ui component update button
  ui component list
`,
    exitCode: 0,
  };
}
