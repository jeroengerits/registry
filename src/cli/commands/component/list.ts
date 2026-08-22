import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { availableVersions } from '../../../git.js';
import { colors, frame, outcome, status, table, withSpinner } from '../../ui.js';
import { present } from '../../presentation.js';

/** Lists installed components in table form or as machine-readable JSON. */
export async function listComponent(cwd: string, json: boolean, showAvailableVersions = false): Promise<CommandResult> {
  // Read the normalized state so legacy records already have enabled=true.
  const state = await readState(cwd);
  // Keep missing state useful for both scripts and human users.
  if (!state) return { output: json ? '[]\n' : `${outcome('No installed components.', 'warning')}\n`, exitCode: 0 };
  // Sort names for stable output and predictable automation.
  const installed = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details }));
  // Fetch remote tags only when the caller explicitly asks for them.
  const components: Array<typeof installed[number] & { availableVersions?: string[] }> = showAvailableVersions ? await withSpinner('Checking available component versions...', () => Promise.all(installed.map(async (component) => ({ ...component, availableVersions: component.repository ? await availableVersions(component.repository) : [] }))), (value) => `Checked ${value.length} component${value.length === 1 ? '' : 's'}`, !json) : installed;
  // Return structured data before constructing any terminal presentation.
  if (json) return present(true, components, '');
  // Keep an empty registry concise in human-readable mode.
  if (!components.length) return { output: `${outcome('No installed components.', 'warning')}\n`, exitCode: 0 };
  // Calculate the summary counts once for the compact header.
  const enabled = components.filter((component) => component.enabled).length;
  // Build a stable table body before applying the shared command frame.
  const lines = [`${components.length} components`, `${enabled} enabled  ·  ${components.length - enabled} disabled${state.version ? `  ·  app v${state.version}` : ''}`, '', table(['Component', 'Version', 'State', 'Location'], components.map((component) => [component.name, `v${component.version}`, status(component.enabled), component.path]))];
  // Add optional metadata below the primary table.
  for (const component of components) {
    if (component.repository) lines.push('', `${component.name}: ${colors.muted(component.repository)}`);
    if (showAvailableVersions) lines.push(`             ${colors.muted(`Available: ${(component.availableVersions ?? []).join(', ') || 'none'}`)}`);
  }
  // Keep the status legend and next action visible without extra prompts.
  return { output: frame('component list', lines.join('\n'), 'Next: ui component'), exitCode: 0 };
}
