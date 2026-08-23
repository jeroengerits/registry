import { access, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import type { CommandResult } from '../../types.js';
import { isRecord, errorMessage } from '../../shared.js';
import { errorResult } from './shared.js';
import { frame, outcome, withSpinner } from '../ui.js';
import { renderUpdateReport } from '../update-flow.js';
import { present } from '../presentation.js';

/** Extracts a version only when the cached package JSON has the expected shape. */
function versionFromPackage(value: unknown): string | undefined {
  return isRecord(value) && typeof value.version === 'string' ? value.version : undefined;
}

/** Chooses the most useful diagnostic field from an Execa failure. */
function subprocessMessage(error: unknown): string {
  if (!isRecord(error)) return errorMessage(error);
  const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : '';
  const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return stderr || stdout || message || errorMessage(error);
}

/** Converts installer progress into a compact version comparison and stage list. */
export function formatSelfUpdateDetails(details: string, currentVersion?: string): { body: string; current: boolean } {
  const lines = details.split('\n').map((line) => line.trim()).filter(Boolean);
  const installed = lines.find((line) => line.startsWith('Checking installed version:'))?.replace('Checking installed version:', '').trim() ?? currentVersion;
  const latest = lines.find((line) => line.startsWith('Checking latest version:'))?.replace('Checking latest version:', '').trim();
  const stages = lines.filter((line) => /^(Removing installed version:|Installing latest version:|UI Registry is already up to date)/.test(line));
  const versions = renderUpdateReport([{ name: 'UI Registry', current: installed ? `v${installed}` : 'unknown', next: latest ? `v${latest}` : 'unknown', status: /already up to date/i.test(details) ? 'unchanged' : 'updated' }]);
  return { body: [versions, ...stages].join('\n\n'), current: /already up to date/i.test(details) };
}

/** Re-runs the installed launcher installer using a temporary copy. */
export async function selfUpdate(json = false): Promise<CommandResult> {
  // The launcher supplies these locations; direct source runs do not.
  const installDirectory = process.env.UI_INSTALL_DIR;
  const cacheDirectory = process.env.UI_CACHE_DIR;
  // Keep self-update unavailable when no installed launcher is active.
  if (!installDirectory || !cacheDirectory) return errorResult('Self-update is only available through an installed ui launcher.', json);

  // Locate the cached installer before creating temporary work.
  const installer = path.join(cacheDirectory, 'install.sh');
  // Report a recoverable installation problem without invoking a subprocess.
  try { await access(installer); } catch { return errorResult('Unable to find the installer in the current ui installation.', json); }

  // Copy the installer so an update cannot modify the file it is executing.
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ui-update-'));
  const temporaryInstaller = path.join(temporaryDirectory, 'install.sh');
  try {
    const currentVersion = await readFile(path.join(cacheDirectory, 'package.json'), 'utf8').then((content) => {
      const packageData: unknown = JSON.parse(content);
      return versionFromPackage(packageData);
    }).catch(() => undefined);
    // Prepare an isolated installer path for the launcher process.
    await copyFile(installer, temporaryInstaller);
    // Run the installer through Execa and surface its output in the result.
    const currentLabel = currentVersion ? `v${currentVersion}` : 'unknown';
    const result = await withSpinner(`Current version: ${currentLabel}\nChecking for UI Registry updates...`, () => execa('sh', [temporaryInstaller], { cwd: installDirectory, env: { ...process.env, UI_SELF_UPDATE: '1' } }), () => 'Version check complete');
    // Prefer installer output while keeping success useful if it is silent.
    const details = result.stdout.trim() || 'Installer and cached CLI refreshed.';
    const formatted = formatSelfUpdateDetails(details, currentVersion);
    const message = formatted.current ? 'UI Registry is already up to date.' : 'UI Registry updated.';
      return present(json, { updated: !formatted.current, currentVersion, latestVersion: formatted.current ? currentVersion : undefined }, frame('update', `${formatted.body}\n\n${outcome(message)}`, 'Next: ui help'));
  } catch (error) {
    // Normalize subprocess diagnostics into one actionable thrown error.
    throw new Error(subprocessMessage(error));
  } finally {
    // Always remove the temporary installer after success or failure.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
