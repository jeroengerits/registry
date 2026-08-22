import type { CommandResult } from '../../../types.js';
import { colors } from '../../ui.js';
import { commandDefinitions } from '../registry.js';

/** Returns the focused command reference for the component namespace. */
export function componentHelp(): CommandResult {
  const commands = commandDefinitions.filter((definition) => definition.path.startsWith('component ') && !definition.hidden);
  return {
    output: `${colors.info('Component commands')}

${commands.map((definition) => `  ${colors.info(`ui ${definition.path}${definition.usage ? ` ${definition.usage}` : ''}`)}
    ${definition.description}`).join('\n\n')}

  Run "ui help" for the complete command reference.
`,
    exitCode: 0,
  };
}
