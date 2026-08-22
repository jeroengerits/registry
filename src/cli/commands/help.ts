import type { CommandResult } from '../../types.js';
import { colors } from '../ui.js';

/** Returns the top-level command reference and usage examples. */
export function help(): CommandResult {
  // Keep the complete reference in one plain-text result for TTYs and scripts.
  return {
    output: `${colors.info('UI Registry')}

Install and manage components from GitHub repositories.

${colors.info('Commands:')}
  ${colors.info('ui')}
    Show available namespaces and commands.

  ${colors.info('ui help')}
    Show this help.

  ${colors.info('ui self-update')}
    Update the installed UI Registry CLI.

  ${colors.info('ui components')}
    List installed components.

  ${colors.info('ui hooks')}
    Manage project hooks.

  ${colors.info('ui component list [--json] [--available-versions]')}
    List components installed in the current directory.

  ${colors.info('ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]')}
    Validate root component.json and install the component locally.
    Use --force to overwrite an already installed component.
    Use --dry-run to preview changes and --json for machine-readable output.

  ${colors.info('ui component remove [name] [--json]')}
    Remove an installed component and its files.

  ${colors.info('ui component info <name> [--json]')}
    Show details for an installed component.

  ${colors.info('ui component toggle <name> [--json]')}
    Enable or disable an installed component.

  ${colors.info('ui component update [name] [--json]')}
    Update a component to the newest compatible Git tag.

${colors.info('Requirements:')}
  - component.json must be in the repository root.
  - The repository must contain a stable semver Git tag.
  - Component files must use safe relative source and target paths.

${colors.info('Output:')}
  Human-readable output uses relaxed tables and Ora progress feedback. Use
  --json for automation;
  JSON output never includes prompts, colors, or spinner control sequences.

${colors.info('Examples:')}
  ${colors.info('ui components')}
  ${colors.info('ui self-update')}
  ${colors.info('ui component add https://github.com/example/button.git')}
  ${colors.info('ui component add https://github.com/example/button.git --force')}
  ${colors.info('ui component remove button')}
  ${colors.info('ui component update button')}
  ${colors.info('ui component list')}
`,
    exitCode: 0,
  };
}
