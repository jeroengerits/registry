import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { errorMessage } from './shared.js';

/** Executes Git commands through Execa so failures retain useful context. */
const runGit = execa;

/** A repository URL plus an optional exact or compatible version constraint. */
export interface GitReference { repository: string; version?: string; }

/** Temporary checkout details and its cleanup operation. */
export interface GitCheckout { directory: string; version: string; versions: string[]; commit: string; cleanup: () => Promise<void>; }

/** Normalizes GitHub shorthand and extracts an optional version constraint. */
export function parseGitReference(value: string): GitReference {
  const input = value.trim();
  if (!input) throw new Error('A Git repository reference is required.');
  const hash = input.lastIndexOf('#');
  const at = input.lastIndexOf('@');
  const atVersion = at > -1 && /^(?:v?\d+\.\d+\.\d+)$/.test(input.slice(at + 1));
  const split = hash > -1 ? hash : (atVersion ? at : -1);
  let repository = split > -1 ? input.slice(0, split) : input;
  const version = split > -1 ? input.slice(split + 1) : undefined;
  if (!repository || (version !== undefined && !version)) throw new Error(`Invalid Git reference: ${value}`);
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
  const lower: [number, number, number] = [major, minor ?? 0, patch ?? 0];
  const upper: [number, number, number] = major > 0 ? [major + 1, 0, 0] : minor === undefined ? [1, 0, 0] : minor > 0 ? [0, minor + 1, 0] : [0, 0, (patch ?? 0) + 1];
  return compareParts(actual, lower) >= 0 && compareParts(actual, upper) < 0;
}
/** Sorts versions newest-first, with lexical fallback for invalid values. */
function compare(a: string, b: string): number { const av = semver(a) ?? [0, 0, 0]; const bv = semver(b) ?? [0, 0, 0]; return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2] || b.localeCompare(a); }

/** Clones a repository, selects a stable tag, and returns cleanup metadata. */
export async function checkoutGit(reference: GitReference): Promise<GitCheckout> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ui-registry-git-'));
  try {
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
    return { directory, version, versions, commit, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw new Error(`Unable to prepare Git repository: ${errorMessage(error)}`); }
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
  const cache = new Map<string, Promise<string[]>>();
  return (repository) => {
    const cached = cache.get(repository);
    if (cached) return cached;
    const lookup = availableVersions(repository);
    cache.set(repository, lookup);
    return lookup;
  };
}
