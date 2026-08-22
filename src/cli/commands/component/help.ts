import type { CommandResult } from '../../../types.js';

/** Returns the focused command reference for the component namespace. */
export function componentHelp(): CommandResult {
  return {
    output: `Component commands

  ui component list [--json] [--available-versions]
    List installed components.

  ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
    Install one or more components.

  ui component remove [name] [--json]
    Remove an installed component and its files.

  ui component update [name] [--json]
    Update an installed component to the newest compatible tag.

 Run "ui component" in an interactive terminal to open the dashboard.
`,
    exitCode: 0,
  };
}
