import type { CommandResult } from '../../types.js';
import { colors } from '../ui.js';
import { componentHelp } from './component/help.js';

/** Returns concise root help or focused help for one command. */
export function help(command?: string): CommandResult {
  if (command) return commandReference(command);
  return {
    output: `${colors.info('UI Registry')}

Install and manage UI components from GitHub.

Usage:
  ui <command> [options]

${colors.info('Commands:')}
  ${colors.info('init')}                  Initialize UI Registry
  ${colors.info('component')}             Manage project components
  ${colors.info('hooks')}                 Manage project hooks
  ${colors.info('doctor')}                Check project configuration
  ${colors.info('update')}                Update UI Registry
  ${colors.info('help')}                  Show help for a command

${colors.info('Component commands:')}
  ${colors.info('component list')}        List installed components
  ${colors.info('component add')}         Install a component
  ${colors.info('component remove')}      Remove a component
  ${colors.info('component info')}        Show component details
  ${colors.info('component update')}      Update installed components
  ${colors.info('component outdated')}    Show available updates
  ${colors.info('component versions')}    Show available versions
  ${colors.info('component enable')}      Enable a component
  ${colors.info('component disable')}     Disable a component

${colors.info('Examples:')}
  ui init
  ui component add owner/button
  ui component list
  ui component update button

Run "ui help <command>" for more information.
`,
    exitCode: 0,
  };
}

/** Resolves a focused help topic without expanding the root help screen. */
function commandReference(command: string): CommandResult {
  if (command === 'component') return componentHelp();
  const references: Record<string, string> = {
    init: `${colors.info('ui init')}\n\nInitialize UI Registry in the current project.\n\nCreates ui.json without overwriting an existing file.`,
    update: `${colors.info('ui update')}\n\nUpdate the UI Registry CLI to the latest release.`,
    hooks: `${colors.info('ui hooks')}\n\nShow project hook status.`,
    doctor: `${colors.info('ui doctor')}\n\nCheck project configuration, registry state, and installed files.`,
    'component add': `${colors.info('ui component add <repository> [options]')}\n\nInstall a component from a GitHub repository.\n\nArguments:\n  repository  GitHub URL or owner/repository\n\nOptions:\n  --version <version>  Install a specific version\n  --dry-run            Preview changes without writing files\n  --force              Overwrite conflicting files\n  --json               Output machine-readable JSON\n\nExamples:\n  ui component add acme/button\n  ui component add acme/button --version 1.4.0`,
  };
  const output = references[command] ?? references[`component ${command}`];
  return output ? { output: `${output}\n`, exitCode: 0 } : { output: `${colors.error(`Unknown help topic: ${command}`)}\n`, exitCode: 1 };
}
