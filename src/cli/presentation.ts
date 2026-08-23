import type { CommandResult } from '../types.js';

/** Renders a command payload without allowing nested command output to leak into JSON. */
export function present(json: boolean, data: unknown, human: string, exitCode = 0): CommandResult {
  return { output: json ? `${JSON.stringify(data, null, 2)}\n` : human, exitCode, data };
}

/** Creates a machine-readable failure while keeping human diagnostics off stdout. */
export function failure(json: boolean, message: string, code = 'command_failed'): CommandResult {
  const data = { ok: false, error: { code, message } };
  return json
    ? { output: `${JSON.stringify(data, null, 2)}\n`, exitCode: 1, data }
    : { output: '', error: message, exitCode: 1, data };
}
