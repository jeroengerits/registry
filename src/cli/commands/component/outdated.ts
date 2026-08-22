import type { CommandResult } from '../../../types.js';
import { availableVersions } from '../../../git.js';
import { readState } from '../../../state.js';
import { colors, frame, outcome, table } from '../../ui.js';

/** Finds installed components with a newer stable version available. */
export async function outdatedComponents(cwd: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : `${outcome('No components installed.', 'warning')}\n`, exitCode: 0 };
  const rows: string[][] = [];
  for (const [name, component] of Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b))) {
    if (!component.repository) continue;
    const versions = await availableVersions(component.repository);
    if (versions[0] && versions[0] !== component.version) rows.push([name, `v${component.version}`, colors.info(`v${versions[0]}`)]);
  }
  if (json) return { output: `${JSON.stringify(rows.map(([name, current, latest]) => ({ name, current, latest })), null, 2)}\n`, exitCode: 0 };
  if (!rows.length) return { output: `${outcome('All components are up to date.')}\n`, exitCode: 0 };
  return { output: frame('component outdated', `${rows.length} update${rows.length === 1 ? '' : 's'} available\n\n${table(['Component', 'Current', 'Latest'], rows)}`, 'Next: ui component update'), exitCode: 0 };
}
