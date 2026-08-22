import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { availableVersions } from '../../git.js';
import { colors, frame, outcome, status, withSpinner } from '../ui.js';

export async function listComponent(cwd: string, json: boolean, showAvailableVersions = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : `${outcome('No installed components.', 'warning')}\n`, exitCode: 0 };
  const installed = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details }));
  const components: Array<typeof installed[number] & { availableVersions?: string[] }> = showAvailableVersions ? await withSpinner('Checking available component versions...', () => Promise.all(installed.map(async (component) => ({ ...component, availableVersions: component.repository ? await availableVersions(component.repository) : [] }))), (value) => `Checked ${value.length} component${value.length === 1 ? '' : 's'}`, !json) : installed;
  if (json) return { output: `${JSON.stringify(components, null, 2)}\n`, exitCode: 0 };
  if (!components.length) return { output: `${outcome('No installed components.', 'warning')}\n`, exitCode: 0 };
  const enabled = components.filter((component) => component.enabled).length;
  const lines = [`${components.length} components  ·  ${enabled} enabled  ·  ${components.length - enabled} disabled${state.version ? `  ·  app v${state.version}` : ''}`, '', 'COMPONENT     VERSION    STATE       LOCATION'];
  for (const component of components) {
    lines.push(`${component.name.padEnd(13)} v${component.version.padEnd(9)} ${status(component.enabled)}  ${component.path}`);
    if (component.repository) lines.push(`             ${colors.muted(component.repository)}`);
    if (showAvailableVersions) lines.push(`             ${colors.muted(`Available: ${(component.availableVersions ?? []).join(', ') || 'none'}`)}`);
  }
  return { output: frame('component list', lines.join('\n'), 'Status: ● enabled  ○ disabled\nAction: ui component toggle <name>'), exitCode: 0 };
}
