import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from './paths.js';

/** Walks every existing path segment to prevent symlink-based boundary escapes. */
async function assertNoSymlinks(file: string, label: string, required: boolean, boundary?: string): Promise<boolean> {
  const absolute = path.resolve(file);
  const base = path.resolve(boundary ?? path.dirname(absolute));
  const relative = path.relative(base, absolute);
  let current = base;
  try {
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`${label} must not contain symlinks.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  // Check parent directories as well as the final file; a safe filename can still sit inside a symlink.
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const information = await lstat(current);
      if (information.isSymbolicLink()) throw new Error(`${label} must not contain symlinks.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (current === absolute && !required) return false;
        if (current !== absolute && !required) return true;
      }
      throw error;
    }
  }
  return true;
}

/** Resolves a project or checkout path after rejecting symlink components. */
export async function safeFilePath(root: string, relative: string, label: string, required = true): Promise<string> {
  const file = safeJoin(root, relative, label);
  const exists = await assertNoSymlinks(file, label, required, root);
  if (required && !exists) throw new Error(`${label} does not exist.`);
  return file;
}

/** Checks whether a project-relative file exists without following symlinks. */
export async function projectFileExists(root: string, relative: string, label: string): Promise<boolean> {
  return assertNoSymlinks(safeJoin(root, relative, label), label, false, root);
}

/** Copies a regular file only when neither path crosses a symlink. */
export async function copySafeFile(source: string, destination: string, label = 'file'): Promise<void> {
  await assertNoSymlinks(source, `${label} source`, true);
  await assertNoSymlinks(destination, `${label} destination`, false, path.dirname(destination));
  // Create parents only after validating the destination's existing path segments.
  await mkdir(path.dirname(destination), { recursive: true });
  await assertNoSymlinks(destination, `${label} destination`, false, path.dirname(destination));
  await copyFile(source, destination);
}

/** Removes a project-relative file without following symlinks. */
export async function removeSafeFile(root: string, relative: string, label: string): Promise<void> {
  const file = await safeFilePath(root, relative, label, false);
  if (await projectFileExists(root, relative, label)) await unlink(file);
}

/** Removes an already-resolved file after checking its existing path. */
export async function removeSafePath(file: string, label = 'file'): Promise<void> {
  if (await assertNoSymlinks(file, label, false)) await unlink(file);
}

/** Computes the SHA-256 digest of a regular, non-symlink file. */
export async function sha256File(file: string, label = 'file'): Promise<string> {
  await assertNoSymlinks(file, label, true);
  const hash = createHash('sha256');
  const { readFile } = await import('node:fs/promises');
  hash.update(await readFile(file));
  return hash.digest('hex');
}

/** Returns the integrity status for a project-relative installed file. */
export async function checkProjectFile(root: string, relative: string, expectedHash?: string): Promise<'ok' | 'missing' | 'changed'> {
  try {
    const file = await safeFilePath(root, relative, 'component file');
    if (!expectedHash) return 'ok';
    return await sha256File(file, 'component file') === expectedHash ? 'ok' : 'changed';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error instanceof Error && /does not exist/.test(error.message))) return 'missing';
    throw error;
  }
}
