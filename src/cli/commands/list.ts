import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { availableVersions } from '../../git.js';
import { withSpinner } from '../ui.js';

export async function listComponent(cwd: string, json: boolean, showAvailableVersions = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : 'No installed components.\n', exitCode: 0 };
  const installed = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details }));
  const components: Array<typeof installed[number] & { availableVersions?: string[] }> = showAvailableVersions ? await withSpinner('Checking available component versions...', () => Promise.all(installed.map(async (component) => ({ ...component, availableVersions: component.repository ? await availableVersions(component.repository) : [] }))), (value) => `Checked ${value.length} component${value.length === 1 ? '' : 's'}`, !json) : installed;
  return { output: json ? `${JSON.stringify(components, null, 2)}\n` : components.map((component) => `${component.name}@${component.version} (${component.path})${component.repository ? ` - ${component.repository}` : ''}${showAvailableVersions ? ` [available: ${(component.availableVersions ?? []).join(', ')}]` : ''}`).join('\n') + (components.length ? '\n' : 'No installed components.\n'), exitCode: 0 };
}
