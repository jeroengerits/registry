import type { CommandResult } from '../../../types.js';
import { createVersionLookup, satisfies } from '../../../git.js';
import { mapConcurrent } from '../../../shared.js';
import { readState } from '../../../state.js';
import { colors, frame, infoLine, table } from '../../ui.js';
import { present } from '../../presentation.js';

interface OutdatedComponent {
  name: string;
  current: string;
  latest: string;
}

/** Finds installed components with a newer stable version available. */
export async function outdatedComponents(cwd: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : infoLine('no components installed'), exitCode: 0 };
  const lookup = createVersionLookup();
  const candidates = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b));
  const outdated = await mapConcurrent(candidates, 4, async ([name, component]) => {
    if (!component.repository) return undefined;
    const versions = await lookup(component.repository);
    const compatible = versions.filter((version) => satisfies(version, component.constraint ?? `^${component.version.split('.')[0]}`));
    return compatible[0] && compatible[0] !== component.version ? { name, current: `v${component.version}`, latest: `v${compatible[0]}` } : undefined;
  }).then((items) => items.filter((item): item is OutdatedComponent => Boolean(item)));
  if (json) return present(true, outdated, '');
  if (!outdated.length) return { output: infoLine('all components up to date'), exitCode: 0 };
  return { output: frame('component outdated', `${outdated.length} update${outdated.length === 1 ? '' : 's'} available\n\n${table(['Name', 'Current', 'Latest'], outdated.map((component) => [component.name, component.current, colors.info(component.latest)]))}`), exitCode: 0 };
}
