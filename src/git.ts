import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const runGit = promisify(execFile);
export interface GitReference { repository: string; version?: string; }
export interface GitCheckout { directory: string; version: string; commit: string; cleanup: () => Promise<void>; }

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
  if (repository.startsWith('https://github.com/') && !repository.endsWith('.git')) repository += '.git';
  return { repository, version };
}

function semver(value: string): [number, number, number] | undefined {
  const match = value.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}
export function satisfies(version: string, constraint = version): boolean {
  const actual = semver(version); if (!actual) return version === constraint;
  const exact = semver(constraint); if (exact) return actual.every((part, index) => part === exact[index]);
  const match = constraint.match(/^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/); if (!match) return false;
  return actual[0] === Number(match[1]) && (match[1] === undefined || actual[1] >= Number(match[2] ?? 0)) && (match[2] === undefined || actual[2] >= Number(match[3] ?? 0));
}
function compare(a: string, b: string): number { const av = semver(a) ?? [0, 0, 0]; const bv = semver(b) ?? [0, 0, 0]; return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2] || b.localeCompare(a); }

export async function checkoutGit(reference: GitReference): Promise<GitCheckout> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ui-registry-git-'));
  try {
    await runGit('git', ['clone', '--quiet', reference.repository, directory]);
    const rawTags = (await runGit('git', ['tag', '--list', '--sort=-version:refname'], { cwd: directory })).stdout.split(/\r?\n/).filter(Boolean);
    const tags = rawTags.map((tag) => ({ tag, version: tag.replace(/^v/, '') }));
    const version = tags.map((item) => item.version).filter((tag) => semver(tag) && (!reference.version || satisfies(tag, reference.version))).sort(compare)[0];
    if (!version) throw new Error(`Repository ${reference.repository} has no stable semver tag.`);
    const tag = tags.find((candidate) => candidate.version === version);
    if (!tag) throw new Error(`Version ${reference.version} was not found in ${reference.repository}.`);
    await runGit('git', ['checkout', '--quiet', tag.tag], { cwd: directory });
    const commit = (await runGit('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim();
    return { directory, version, commit, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw new Error(`Unable to prepare Git repository: ${error instanceof Error ? error.message : String(error)}`); }
}
