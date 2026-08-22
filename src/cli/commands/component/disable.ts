import type { CommandResult } from '../../../types.js';
import { setComponentEnabled } from './toggle.js';

/** Disables one installed component without removing its files. */
export function disableComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  return setComponentEnabled(cwd, name, false, json);
}
