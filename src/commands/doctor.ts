import type { CommandResult } from '../types.js';
import { readState } from '../state.js';

export async function doctor(cwd: string): Promise<CommandResult> {
  await readState(cwd);
  return { output: 'ui.json is valid.\n', exitCode: 0 };
}
