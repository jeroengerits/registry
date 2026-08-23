import type { CommandResult } from '../../types.js';
import { colors } from '../ui.js';
import { componentHelp } from './component/help.js';
import { commandDefinitions, focusedDefinition } from './registry.js';

/** Returns concise root help or focused help for one command. */
export function help(command?: string): CommandResult {
  if (command) return commandReference(command);
  const rootCommands = commandDefinitions.filter((definition) => ['init', 'doctor', 'self-update'].includes(definition.path));
  const commands = [
    ['add', 'Install a component.'], ['list', 'List installed components.'], ['show', 'Show an installed component.'],
    ['remove', 'Remove an installed component.'], ['update', 'Update one or all components.'], ['outdated', 'Show available updates.'],
    ['versions', 'Show available versions.'], ['status', 'Show installed component status.'], ['undo', 'Undo or inspect the last update.'], ['enable', 'Enable a component.'], ['disable', 'Disable a component.'],
  ];
  return {
    output: `${colors.info('UI Registry')}

Install and manage UI components from Git repositories or local paths.

Usage:
  ui <command> [options]

${colors.info('Commands:')}
${commands.map(([name, description]) => `  ${colors.info(name.padEnd(14))}${description}`).join('\n')}
${rootCommands.map((definition) => `  ${colors.info(definition.path.padEnd(14))}${definition.description}`).join('\n')}

Legacy namespace: ui component <command>

${colors.info('Examples:')}
  ui init
  ui add owner/button
  ui list
  ui update button

Run "ui help <command>" for more information.
`,
    exitCode: 0,
  };
}

/** Resolves a focused help topic without expanding the root help screen. */
function commandReference(command: string): CommandResult {
  if (command === 'component') return componentHelp();
  const aliases: Record<string, string> = { add: 'component add', list: 'component list', status: 'component list', show: 'component info', remove: 'component remove', update: 'component update', outdated: 'component outdated', versions: 'component versions', undo: 'component revert' };
  const definition = focusedDefinition(aliases[command] ?? command);
  if (!definition) return { output: '', error: colors.error(`Unknown help topic: ${command}`), exitCode: 2 };
  const usage = definition.usage ? ` ${definition.usage}` : '';
  const options = definition.options?.length ? `\n\nOptions:\n${definition.options.map((option) => `  ${option.flags.padEnd(22)}${option.description}`).join('\n')}` : '';
  const argument = definition.path === 'component add' ? '\n\nArguments:\n  repository-or-path  GitHub URL, owner/repository, or local component directory' : '';
  const output = `${colors.info(`ui ${definition.path}${usage}`)}\n\n${definition.description}${argument}${options}`;
  return { output: `${output}\n`, exitCode: 0 };
}
