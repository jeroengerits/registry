import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { checkProjectFile } from '../../filesystem.js';
import { colors, frame, table } from '../ui.js';
import { present } from '../presentation.js';

type CheckStatus = 'ok' | 'missing' | 'changed';
interface DoctorCheck { check: string; status: CheckStatus; }

/** Checks project registry state and installed component files. */
export async function doctor(cwd: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  const checks: DoctorCheck[] = [{ check: 'Project initialized', status: state ? 'ok' : 'missing' }];
  if (state) {
    for (const [name, component] of Object.entries(state.components)) {
      const files = component.files ?? [];
      const statuses = await Promise.all(files.map((file) => checkProjectFile(cwd, file.path, file.sha256)));
      checks.push({ check: `${name} files`, status: statuses.includes('missing') ? 'missing' : statuses.includes('changed') ? 'changed' : 'ok' });
    }
  }
  const rows = checks.map((check) => [check.check, check.status === 'ok' ? colors.success('ok') : colors.error(check.status)]);
  const failed = checks.some((check) => check.status !== 'ok');
  return present(json, { checks }, frame('doctor', `${table(['Check', 'Status'], rows)}\n\n${failed ? 'error: problems found' : 'ok: project healthy'}`), failed ? 1 : 0);
}
