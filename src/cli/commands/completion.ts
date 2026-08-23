import type { CommandResult } from '../../types.js';
import { errorResult } from './shared.js';

const COMMANDS = 'add list show remove status update outdated versions undo enable disable init doctor self-update completion help';

/** Returns a small, dependency-free completion script for a supported shell. */
export function completion(shell?: string): CommandResult {
  if (!shell || !['bash', 'zsh', 'fish'].includes(shell)) return errorResult('Usage: ui completion <bash|zsh|fish>');
  if (shell === 'bash') return { output: `# ui bash completion\n_ui_completion() {\n  local current="$2"\n  COMPREPLY=( $(compgen -W "${COMMANDS}" -- "$current") )\n}\ncomplete -F _ui_completion ui\n`, exitCode: 0 };
  if (shell === 'zsh') return { output: `#compdef ui\n_arguments '1:command:(${COMMANDS})'\n`, exitCode: 0 };
  return { output: COMMANDS.split(' ').map((command) => `complete -c ui -f -n "__fish_use_subcommand" -a ${command}`).join('\n') + '\n', exitCode: 0 };
}
