import type { CommandResult } from '../../../types.js';
import { colors } from '../../ui.js';

/** Returns the focused command reference for the component namespace. */
export function componentHelp(): CommandResult {
  return {
    output: `${colors.info('Component commands')}

  ${colors.info('ui component list [--json] [--available-versions]')}
    List installed components.

  ${colors.info('ui component add <github-url> [--version <x.y.z>] [--dry-run] [--force] [--json]')}
    Install one or more components.

  ${colors.info('ui component remove [name] [--json]')}
    Remove an installed component and its files.

  ${colors.info('ui component update [name] [--json]')}
    Update an installed component to the newest compatible tag.

  Run "ui help" for the complete command reference.
`,
    exitCode: 0,
  };
}
