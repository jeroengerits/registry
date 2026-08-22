import { access, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import type { CommandResult } from '../../types.js';
import { errorResult } from './shared.js';
import { frame, outcome, table, withSpinner } from '../ui.js';

/** Converts installer progress into a compact version comparison and stage list. */
export function formatSelfUpdateDetails(details: string, currentVersion?: string): { body: string; current: boolean } {
  const lines = details.split('\n').map((line) => line.trim()).filter(Boolean);
  const installed = lines.find((line) => line.startsWith('Checking installed version:'))?.replace('Checking installed version:', '').trim() ?? currentVersion;
  const latest = lines.find((line) => line.startsWith('Checking latest version:'))?.replace('Checking latest version:', '').trim();
  const stages = lines.filter((line) => /^(Removing installed version:|Installing latest version:|UI Registry is already up to date)/.test(line));
  const versions = table(['Current', 'Latest'], [[installed ? `v${installed}` : 'unknown', latest ? `v${latest}` : 'unknown']]);
  return { body: [versions, ...stages].join('\n\n'), current: /already up to date/i.test(details) };
}

/** Re-runs the installed launcher installer using a temporary copy. */
export async function selfUpdate(): Promise<CommandResult> {
  // The launcher supplies these locations; direct source runs do not.
  const installDirectory = process.env.UI_INSTALL_DIR;
  const cacheDirectory = process.env.UI_CACHE_DIR;
  // Keep self-update unavailable when no installed launcher is active.
  if (!installDirectory || !cacheDirectory) return errorResult('Self-update is only available through an installed ui launcher.');

  // Locate the cached installer before creating temporary work.
  const installer = path.join(cacheDirectory, 'install.sh');
  // Report a recoverable installation problem without invoking a subprocess.
  try { await access(installer); } catch { return errorResult('Unable to find the installer in the current ui installation.'); }

  // Copy the installer so an update cannot modify the file it is executing.
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ui-update-'));
  const temporaryInstaller = path.join(temporaryDirectory, 'install.sh');
  try {
    const currentVersion = await readFile(path.join(cacheDirectory, 'package.json'), 'utf8').then((content) => JSON.parse(content).version as string).catch(() => undefined);
    // Prepare an isolated installer path for the launcher process.
    await copyFile(installer, temporaryInstaller);
    // Run the installer through Execa and surface its output in the result.
    const result = await withSpinner('Checking for UI Registry updates...', () => execa('sh', [temporaryInstaller], { cwd: installDirectory, env: { ...process.env, UI_SELF_UPDATE: '1' } }), () => 'Version check complete');
    // Prefer installer output while keeping success useful if it is silent.
    const details = result.stdout.trim() || 'Installer and cached CLI refreshed.';
    const formatted = formatSelfUpdateDetails(details, currentVersion);
    const message = formatted.current ? 'UI Registry is already up to date.' : 'UI Registry updated.';
    return { output: frame('self-update', `${formatted.body}\n\n${outcome(message)}`, 'Next: ui help'), exitCode: 0 };
  } catch (error) {
    // Normalize subprocess diagnostics into one actionable thrown error.
    const details = error as { stderr?: string; stdout?: string; message?: string };
    throw new Error(details.stderr?.trim() || details.stdout?.trim() || details.message || String(error));
  } finally {
    // Always remove the temporary installer after success or failure.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
