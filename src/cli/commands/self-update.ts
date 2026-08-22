import { access, copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import type { CommandResult } from '../../types.js';
import { errorResult } from './shared.js';
import { withSpinner } from '../ui.js';

export async function selfUpdate(): Promise<CommandResult> {
  const installDirectory = process.env.UI_INSTALL_DIR;
  const cacheDirectory = process.env.UI_CACHE_DIR;
  if (!installDirectory || !cacheDirectory) return errorResult('Self-update is only available through an installed ui launcher.');

  const installer = path.join(cacheDirectory, 'install.sh');
  try { await access(installer); } catch { return errorResult('Unable to find the installer in the current ui installation.'); }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'ui-update-'));
  const temporaryInstaller = path.join(temporaryDirectory, 'install.sh');
  try {
    await copyFile(installer, temporaryInstaller);
    const result = await withSpinner('Updating UI Registry...', () => execa('sh', [temporaryInstaller], { cwd: installDirectory, env: process.env }), () => 'UI Registry updated');
    return { output: result.stdout, exitCode: 0 };
  } catch (error) {
    const details = error as { stderr?: string; stdout?: string; message?: string };
    throw new Error(details.stderr?.trim() || details.stdout?.trim() || details.message || String(error));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
