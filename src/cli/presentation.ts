import type { CommandResult } from '../types.js';

/** Renders a command payload without allowing nested command output to leak into JSON. */
export function present(json: boolean, data: unknown, human: string, exitCode = 0): CommandResult {
  return { output: json ? `${JSON.stringify(data, null, 2)}\n` : human, exitCode, data };
}
