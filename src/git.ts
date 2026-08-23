import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { errorMessage } from './shared.js';

/** Executes Git commands through Execa so failures retain useful context. */
const runGit = execa;

/** A repository URL plus an optional exact or compatible version constraint. */
export interface GitReference { repository: string; version?: string; }

/** Temporary checkout details and its cleanup operation. */
export interface GitCheckout { directory: string; version: string; versions: string[]; commit: string; cleanup: () => Promise<void>; }

/** Normalizes GitHub shorthand and extracts an optional version constraint. */
export function parseGitReference(value: string, baseDirectory = process.cwd()): GitReference {
  const input = value.trim();
  if (!input) throw new Error('A Git repository reference is required.');
  const hash = input.lastIndexOf('#');
  const at = input.lastIndexOf('@');
  const atVersion = at > -1 && /^(?:v?\d+\.\d+\.\d+)$/.test(input.slice(at + 1));
  const split = hash > -1 ? hash : (atVersion ? at : -1);
  let repository = split > -1 ? input.slice(0, split) : input;
  const version = split > -1 ? input.slice(split + 1) : undefined;
  if (!repository || (version !== undefined && !version)) throw new Error(`Invalid Git reference: ${value}`);
  if (repository.startsWith('file://')) repository = fileURLToPath(repository);
  if (repository === '.' || repository === '..' || repository.startsWith(`.${path.sep}`) || repository.startsWith('./') || repository.startsWith('../') || path.isAbsolute(repository)) {
    return { repository: path.resolve(baseDirectory, repository), version };
  }
  if (repository.startsWith('git@github.com:')) repository = `https://github.com/${repository.slice('git@github.com:'.length)}`;
  else if (repository.startsWith('github.com/')) repository = `https://${repository}`;
  else if (/^[^/\s]+\/[^/\s]+$/.test(repository)) repository = `https://github.com/${repository}`;
  if (repository.startsWith('https://github.com/') && !repository.endsWith('.git')) repository += '.git';
  return { repository, version };
}

/** Parses only stable three-part semantic versions used by registry tags. */
function semver(value: string): [number, number, number] | undefined {
  const match = value.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** Compares parsed semantic-version tuples from oldest to newest. */
function compareParts(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** Checks an exact, major, or major/minor compatibility constraint. */
export function satisfies(version: string, constraint = version): boolean {
  const actual = semver(version); if (!actual) return version === constraint;
  const exact = semver(constraint); if (exact) return actual.every((part, index) => part === exact[index]);
  const match = constraint.match(/^\^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/); if (!match) return false;
  const major = Number(match[1]);
  const minor = match[2] === undefined ? undefined : Number(match[2]);
  const patch = match[3] === undefined ? undefined : Number(match[3]);
  // A caret range includes its lower bound and excludes the next compatible release.
  const lower: [number, number, number] = [major, minor ?? 0, patch ?? 0];
  const upper: [number, number, number] = major > 0 ? [major + 1, 0, 0] : minor === undefined ? [1, 0, 0] : minor > 0 ? [0, minor + 1, 0] : [0, 0, (patch ?? 0) + 1];
  return compareParts(actual, lower) >= 0 && compareParts(actual, upper) < 0;
}

/** Converts a selected version into the default update range for installed state. */
export function updateConstraint(version: string, requested?: string): string {
  return requested?.startsWith('^') ? requested : `^${version.replace(/^v/, '').split('.')[0]}`;
}
/** Sorts versions newest-first, with lexical fallback for invalid values. */
function compare(a: string, b: string): number { const av = semver(a) ?? [0, 0, 0]; const bv = semver(b) ?? [0, 0, 0]; return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2] || b.localeCompare(a); }

/** Clones a repository, selects a stable tag, and returns cleanup metadata. */
export async function checkoutGit(reference: GitReference, cacheRoot?: string): Promise<GitCheckout> {
  if (path.isAbsolute(reference.repository)) return checkoutLocal(reference);
  const temporaryDirectory = cacheRoot ? undefined : await mkdtemp(path.join(os.tmpdir(), 'ui-registry-git-'));
  const cacheKey = createHash('sha256').update(reference.repository).digest('hex').slice(0, 16);
  const directory = cacheRoot ? path.join(cacheRoot, `${cacheKey}-${reference.version ?? 'latest'}`) : temporaryDirectory!;
  try {
    if (cacheRoot) {
      await mkdir(cacheRoot, { recursive: true });
      await rm(directory, { recursive: true, force: true });
    }
    await runGit('git', ['clone', '--quiet', reference.repository, directory]);
    // Keep the original tag spelling so checkout works for both v1.2.3 and 1.2.3.
    const rawTags = (await runGit('git', ['tag', '--list', '--sort=-version:refname'], { cwd: directory })).stdout.split(/\r?\n/).filter(Boolean);
    const tags = rawTags.map((tag) => ({ tag, version: tag.replace(/^v/, '') }));
    const versions = tags.map((item) => item.version).filter((tag) => semver(tag)).sort(compare);
    // Select the newest tag that satisfies the requested range.
    const version = versions.filter((tag) => !reference.version || satisfies(tag, reference.version))[0];
    if (!version) throw new Error(`Repository ${reference.repository} has no stable semver tag.`);
    const tag = tags.find((candidate) => candidate.version === version);
    if (!tag) throw new Error(`Version ${reference.version} was not found in ${reference.repository}.`);
    await runGit('git', ['checkout', '--quiet', tag.tag], { cwd: directory });
    const commit = (await runGit('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim();
    return { directory, version, versions, commit, cleanup: cacheRoot ? async () => undefined : () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw new Error(`Unable to prepare Git repository: ${errorMessage(error)}`); }
}

/** Reads a local component directory without cloning or deleting the caller's files. */
async function checkoutLocal(reference: GitReference): Promise<GitCheckout> {
  const directory = reference.repository;
  const information = await stat(directory).catch(() => undefined);
  if (!information?.isDirectory()) throw new Error(`Local component path is not a directory: ${directory}`);
  let versions: string[] = [];
  try {
    const tags = (await runGit('git', ['tag', '--list'], { cwd: directory })).stdout.split(/\r?\n/).filter(Boolean).map((tag) => tag.replace(/^v/, '')).filter((tag) => semver(tag));
    versions = tags.sort(compare);
  } catch {
    // A plain directory is valid; it simply has no Git version history.
  }
  const version = versions.find((candidate) => !reference.version || satisfies(candidate, reference.version)) ?? reference.version ?? 'local';
  if (reference.version && versions.length && !satisfies(version, reference.version)) throw new Error(`Local component ${directory} has no version matching ${reference.version}.`);
  let commit = '';
  try { commit = (await runGit('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim(); } catch { /* Plain local directories have no commit identity. */ }
  return { directory, version, versions, commit, cleanup: async () => undefined };
}

/** Lists stable semantic-version tags without retaining the checkout. */
export async function availableVersions(repository: string): Promise<string[]> {
  const output = await runGit('git', ['ls-remote', '--tags', '--refs', repository]);
  return output.stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^[0-9a-f]+\s+refs\/tags\/(.+)$/)?.[1])
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => tag.replace(/^v/, ''))
    .filter((version) => semver(version))
    .sort(compare);
}

/** Caches tag metadata for one command invocation without sharing stale data globally. */
export function createVersionLookup(): (repository: string) => Promise<string[]> {
  // Cache promises, not just resolved values, so concurrent callers share one Git request.
  const cache = new Map<string, Promise<string[]>>();
  return (repository) => {
    const cached = cache.get(repository);
    if (cached) return cached;
    const lookup = availableVersions(repository);
    cache.set(repository, lookup);
    return lookup;
  };
}
