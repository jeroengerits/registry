import type { CommandResult } from '../../types.js';
import { colors } from '../ui.js';
import { componentHelp } from './component/help.js';
import { commandDefinitions, focusedDefinition } from './registry.js';

/** Returns concise root help or focused help for one command. */
export function help(command?: string): CommandResult {
  if (command) return commandReference(command);
  const rootCommands = commandDefinitions.filter((definition) => !definition.path.includes(' ') && !definition.hidden);
  const componentCommands = commandDefinitions.filter((definition) => definition.path.startsWith('component ') && !definition.hidden);
  return {
    output: `${colors.info('UI Registry')}

Install and manage UI components from GitHub.

Usage:
  ui <command> [options]

${colors.info('Commands:')}
${rootCommands.map((definition) => `  ${colors.info(definition.path.padEnd(22))}${definition.description}`).join('\n')}

${colors.info('Component commands:')}
${componentCommands.map((definition) => `  ${colors.info(definition.path.padEnd(22))}${definition.description}`).join('\n')}

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
  const definition = focusedDefinition(command);
  if (!definition) return { output: `${colors.error(`Unknown help topic: ${command}`)}\n`, exitCode: 1 };
  const usage = definition.usage ? ` ${definition.usage}` : '';
  const options = definition.options?.length ? `\n\nOptions:\n${definition.options.map((option) => `  ${option.flags.padEnd(22)}${option.description}`).join('\n')}` : '';
  const argument = definition.path === 'component add' ? '\n\nArguments:\n  repository-or-path  GitHub URL, owner/repository, or local component directory' : '';
  const output = `${colors.info(`ui ${definition.path}${usage}`)}\n\n${definition.description}${argument}${options}`;
  return { output: `${output}\n`, exitCode: 0 };
}
