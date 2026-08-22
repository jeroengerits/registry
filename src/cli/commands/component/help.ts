import type { CommandResult } from '../../../types.js';
import { colors } from '../../ui.js';

/** Returns the focused command reference for the component namespace. */
export function componentHelp(): CommandResult {
  return {
    output: `${colors.info('Component commands')}

  ${colors.info('ui component list [--json] [--versions]')}
    List installed components.

  ${colors.info('ui component add <repository> [options]')}
    Install a component from a GitHub repository.

  ${colors.info('ui component remove [name] [--json]')}
    Remove an installed component and its files.

  ${colors.info('ui component update [name] [--json]')}
    Update an installed component to the newest compatible tag.

  ${colors.info('ui component outdated [--json]')}
    Show components with newer versions available.

  ${colors.info('ui component versions <name> [--json]')}
    Show available versions for one component.

  ${colors.info('ui component enable <name> [--json]')}
    Enable a component.

  ${colors.info('ui component disable <name> [--json]')}
    Disable a component.

  Run "ui help" for the complete command reference.
`,
    exitCode: 0,
  };
}
