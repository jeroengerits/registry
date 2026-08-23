import type { CommandResult } from '../types.js';

/** Renders a command payload without allowing nested command output to leak into JSON. */
export function present(json: boolean, data: unknown, human: string, exitCode = 0): CommandResult {
  return { output: json ? `${JSON.stringify(data, null, 2)}\n` : human, exitCode, data };
}

/** Creates a machine-readable failure while keeping human diagnostics off stdout. */
export function failure(json: boolean, message: string, code = 'command_failed', exitCode = 1): CommandResult {
  const data = { ok: false, error: { code, message } };
  return json
    ? { output: `${JSON.stringify(data, null, 2)}\n`, exitCode, data }
    : { output: '', error: message, exitCode, data };
}

/** Returns a successful, non-mutating cancellation result for declined updates. */
export function cancelled(json: boolean): CommandResult {
  const data = { updated: false, cancelled: true };
  const human = 'Update cancelled.\nNo changes were made.\n';
  return { output: json ? `${JSON.stringify(data, null, 2)}\n` : human, exitCode: 0, data };
}
