import { access, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import type { CommandResult } from '../../types.js';
import { isRecord, errorMessage } from '../../shared.js';
import { errorResult } from './shared.js';
import { confirmAction, interactive, withSpinner } from '../ui.js';
import { renderUpdateIntent, renderUpdateReport, renderUpdateSuccess, type UpdateItem } from '../update-flow.js';
import { cancelled, failure, present } from '../presentation.js';

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

/** Extracts the current/latest versions needed for the update decision. */
export function parseSelfUpdateDetails(details: string, currentVersion?: string): { current?: string; latest?: string } {
  const lines = details.split('\n').map((line) => line.trim()).filter(Boolean);
  const current = lines.find((line) => line.startsWith('Checking installed version:'))?.replace('Checking installed version:', '').trim() ?? currentVersion;
  const latest = lines.find((line) => line.startsWith('Checking latest version:'))?.replace('Checking latest version:', '').trim();
  return { current, latest };
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
  let currentVersion: string | undefined;
  try {
    currentVersion = await readFile(path.join(cacheDirectory, 'package.json'), 'utf8').then((content) => {
      const packageData: unknown = JSON.parse(content);
      return versionFromPackage(packageData);
    }).catch(() => undefined);
    // Prepare an isolated installer path for the launcher process.
    await copyFile(installer, temporaryInstaller);
    // Show the installed version before the interactive update lifecycle begins.
    const currentLabel = currentVersion ? `v${currentVersion}` : 'unknown';
    if (interactive() && !json) process.stdout.write(`UI Registry ${currentLabel}\n\n`);

    // Ask the installer to download and inspect the latest package without mutating.
    const check = await withSpinner(
      'Checking for updates...',
      () => execa('sh', [temporaryInstaller], { cwd: installDirectory, env: { ...process.env, UI_SELF_UPDATE: '1', UI_CHECK_ONLY: '1' } }),
      () => 'Checked for updates',
      !json,
    );

    // Prefer installer output while keeping the decision data explicit.
    const details = check.stdout.trim();
    const versions = parseSelfUpdateDetails(details, currentVersion);
    if (!versions.latest) throw new Error('The installer did not report a latest version.');

    // Finish successfully without prompting or mutating when already current.
    if (versions.current === versions.latest) {
      const human = `✓ You're up to date\n\n  v${versions.latest} is the latest version.\n`;
      return present(json, { updated: false, currentVersion: versions.current, latestVersion: versions.latest }, human);
    }

    // Show the same availability block used by component updates.
    const change: UpdateItem = { name: 'UI Registry', current: `v${versions.current ?? 'unknown'}`, next: `v${versions.latest}`, status: 'updated' };
    if (interactive() && !json) {
      process.stdout.write(`${renderUpdateIntent([change])}\n\n`);
      if (!(await confirmAction('Update now?', true))) return cancelled(false);
    }

    // Perform the real installation only after the check and confirmation.
    const update = await withSpinner(
      `Updating ${change.current} -> ${change.next}...`,
      () => execa('sh', [temporaryInstaller], { cwd: installDirectory, env: { ...process.env, UI_SELF_UPDATE: '1' } }),
      () => `Updated to ${change.next}`,
      !json,
    );

    // Verify the installer left the cache at the version it promised.
    const installedVersion = await readFile(path.join(cacheDirectory, 'package.json'), 'utf8').then((content) => versionFromPackage(JSON.parse(content))).catch(() => undefined);
    if (installedVersion !== versions.latest) throw new Error(`Verification found ${installedVersion ?? 'no installed version'} instead of ${versions.latest}.`);

    // Return the canonical success block and machine-readable transition.
    void update;
    return present(json, { updated: true, currentVersion: versions.current, latestVersion: versions.latest }, renderUpdateSuccess([change]));
  } catch (error) {
    // Keep update failures concise and explain the installation safety guarantee.
    const reason = subprocessMessage(error);
    return failure(json, `Update failed\n\nCurrent version: ${currentVersion ? `v${currentVersion}` : 'unknown'}\nReason: ${reason}\n\nYour existing installation was not changed.`, 'update_failed');
  } finally {
    // Always remove the temporary installer after success or failure.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
