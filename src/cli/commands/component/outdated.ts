import type { CommandResult } from '../../../types.js';
import { availableVersions } from '../../../git.js';
import { readState } from '../../../state.js';
import { colors, frame, outcome, table } from '../../ui.js';

interface OutdatedComponent {
  name: string;
  current: string;
  latest: string;
}

/** Finds installed components with a newer stable version available. */
export async function outdatedComponents(cwd: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : `${outcome('No components installed.', 'warning')}\n`, exitCode: 0 };
  const outdated: OutdatedComponent[] = [];
  for (const [name, component] of Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b))) {
    if (!component.repository) continue;
    const versions = await availableVersions(component.repository);
    if (versions[0] && versions[0] !== component.version) outdated.push({ name, current: `v${component.version}`, latest: `v${versions[0]}` });
  }
  if (json) return { output: `${JSON.stringify(outdated, null, 2)}\n`, exitCode: 0 };
  if (!outdated.length) return { output: `${outcome('All components are up to date.')}\n`, exitCode: 0 };
  return { output: frame('component outdated', `${outdated.length} update${outdated.length === 1 ? '' : 's'} available\n\n${table(['Component', 'Current', 'Latest'], outdated.map((component) => [component.name, component.current, colors.info(component.latest)]))}`, 'Next: ui component update'), exitCode: 0 };
}
