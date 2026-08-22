import type { CommandResult } from '../types.js';
import { generateManifest, validateManifestFile } from '../manifest.js';
import { errorResult } from './shared.js';

export async function validateManifestCommand(file?: string): Promise<CommandResult> {
  if (!file) return errorResult('Usage: ui manifest check <components.json>');
  await validateManifestFile(file);
  return { output: `Manifest is valid: ${file}\n`, exitCode: 0 };
}

export async function generateManifestCommand(directory?: string, output?: string): Promise<CommandResult> {
  if (!directory) return errorResult('Usage: ui manifest generate <repository-directory> [output]');
  await generateManifest(directory, output);
  return { output: `Manifest generated: ${output ?? `${directory}/components.json`}\n`, exitCode: 0 };
}
