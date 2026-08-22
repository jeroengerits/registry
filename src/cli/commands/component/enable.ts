import type { CommandResult } from '../../../types.js';
import { setComponentEnabled } from './toggle.js';

/** Enables one installed component without changing its files. */
export function enableComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  return setComponentEnabled(cwd, name, true, json);
}
