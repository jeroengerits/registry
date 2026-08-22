import type { CommandResult } from './types.js';
import { readState } from './state.js';
import { validateManifestFile } from './manifest.js';

export async function listComponents(cwd: string, json: boolean): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) {
    return { output: json ? JSON.stringify([]) : 'No installed components.\n', exitCode: 0 };
  }
  const components = Object.entries(state.components)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, details]) => ({ name, ...details }));
  return {
    output: json ? `${JSON.stringify(components, null, 2)}\n` : components.map((component) => `${component.name}@${component.version} (${component.path})`).join('\n') + (components.length ? '\n' : 'No installed components.\n'),
    exitCode: 0,
  };
}

export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) return { output: 'Usage: ui components info <name> [--json]\n', exitCode: 1 };
  const state = await readState(cwd);
  const component = state?.components[name];
  if (!component) return { output: `Component "${name}" is not installed.\n`, exitCode: 1 };
  return { output: json ? `${JSON.stringify({ name, ...component }, null, 2)}\n` : `${name}@${component.version}\nPath: ${component.path}\n`, exitCode: 0 };
}

export async function doctor(cwd: string): Promise<CommandResult> {
  await readState(cwd);
  return { output: 'ui.json is valid.\n', exitCode: 0 };
}

export async function validateManifestCommand(file?: string): Promise<CommandResult> {
  if (!file) return { output: 'Usage: ui manifest validate <file>\n', exitCode: 1 };
  await validateManifestFile(file);
  return { output: `Manifest is valid: ${file}\n`, exitCode: 0 };
}
