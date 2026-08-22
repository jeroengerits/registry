import type { CommandResult } from '../../../types.js';

/** Returns the focused command reference for the component namespace. */
export function componentHelp(): CommandResult {
  return {
    output: `Component commands

  ui component list [--json] [--available-versions]
    List installed components.

  ui component info [name] [--json]
    Inspect an installed component.

  ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
    Install one or more components.

  ui component remove [name] [--json]
    Remove an installed component and its files.

  ui component toggle [name] [--json]
    Enable or disable an installed component without changing its files.

  ui component update [name] [--json]
    Update an installed component to the newest compatible tag.

 Run "ui component" in an interactive terminal to choose a command.
`,
    exitCode: 0,
  };
}
