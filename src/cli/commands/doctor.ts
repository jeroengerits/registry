import { access } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { colors, frame, outcome, table } from '../ui.js';

type CheckStatus = 'ok' | 'missing';
interface DoctorCheck { check: string; status: CheckStatus; }

/** Checks project registry state and installed component files. */
export async function doctor(cwd: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  const checks: DoctorCheck[] = [{ check: 'Project initialized', status: state ? 'ok' : 'missing' }];
  if (state) {
    for (const [name, component] of Object.entries(state.components)) {
      const files = component.files ?? [];
      const missing = (await Promise.all(files.map(async (file) => { try { await access(path.join(cwd, file.path)); return false; } catch { return true; } }))).some(Boolean);
      checks.push({ check: `${name} files`, status: missing ? 'missing' : 'ok' });
    }
  }
  if (json) return { output: `${JSON.stringify({ checks }, null, 2)}\n`, exitCode: checks.some((check) => check.status === 'missing') ? 1 : 0 };
  const rows = checks.map((check) => [check.check, check.status === 'ok' ? colors.success('ok') : colors.error('missing')]);
  const failed = checks.some((check) => check.status === 'missing');
  return { output: frame('doctor', `${table(['Check', 'Status'], rows)}\n\n${failed ? outcome('Problems found.', 'error') : outcome('Everything looks good.')}`, 'Next: ui component list'), exitCode: failed ? 1 : 0 };
}
