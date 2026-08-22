import type { CommandResult } from '../../types.js';

/** Returns the top-level command reference and usage examples. */
export function help(): CommandResult {
  // Keep the complete reference in one plain-text result for TTYs and scripts.
  return {
    output: `UI Registry

Install and manage components from GitHub repositories.

Commands:
  ui
    Choose between components and hooks in an interactive terminal.

  ui help
    Show this help.

  ui self-update
    Update the installed UI Registry CLI.

  ui components
    Open the component dashboard.

  ui hooks
    Manage project hooks.

  ui component list [--json] [--available-versions]
    List components installed in the current directory.

  ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]
    Validate root component.json and install the component locally.
    Use --force to overwrite an already installed component.
    Use --dry-run to preview changes and --json for machine-readable output.

  ui component remove [name] [--json]
    Remove an installed component and its files; interactive terminals prompt if omitted.

  ui component update [name] [--json]
    Update a component to the newest compatible Git tag.

Requirements:
  - component.json must be in the repository root.
  - The repository must contain a stable semver Git tag.
  - Component files must use safe relative source and target paths.

Output:
  Human-readable output uses compact framed layouts with Clack prompts and
  Ora progress feedback in interactive terminals. Use --json for automation;
  JSON output never includes prompts, colors, or spinner control sequences.

Examples:
  ui component
  ui self-update
  ui component add https://github.com/example/button.git
  ui component add https://github.com/example/button.git --force
  ui component remove button
  ui component update button
  ui component list
`,
    exitCode: 0,
  };
}
