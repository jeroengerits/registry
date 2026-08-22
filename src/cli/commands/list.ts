import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { availableVersions } from '../../git.js';
import { withSpinner } from '../ui.js';
import { colors } from '../ui.js';

export async function listComponent(cwd: string, json: boolean, showAvailableVersions = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : `${colors.info('No installed components.')}\n`, exitCode: 0 };
  const installed = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details }));
  const components: Array<typeof installed[number] & { availableVersions?: string[] }> = showAvailableVersions ? await withSpinner('Checking available component versions...', () => Promise.all(installed.map(async (component) => ({ ...component, availableVersions: component.repository ? await availableVersions(component.repository) : [] }))), (value) => `Checked ${value.length} component${value.length === 1 ? '' : 's'}`, !json) : installed;
  if (json) return { output: `${JSON.stringify(components, null, 2)}\n`, exitCode: 0 };
  if (!components.length) return { output: `${colors.info('No installed components.')}\n`, exitCode: 0 };
  const heading = `Installed components (${components.length})${state.version ? ` ${colors.muted(`· app v${state.version}`)}` : ''}`;
  const lines = [colors.info(heading), ''];
  for (const [index, component] of components.entries()) {
    lines.push(`${colors.success(component.name)} ${colors.muted(`@${component.version}`)}`);
    lines.push(`  Path: ${component.path}`);
    if (component.repository) lines.push(`  Repository: ${colors.muted(component.repository)}`);
    if (showAvailableVersions) lines.push(`  Available: ${(component.availableVersions ?? []).join(', ') || 'none'}`);
    if (index < components.length - 1) lines.push('');
  }
  return { output: `${lines.join('\n')}\n`, exitCode: 0 };
}
