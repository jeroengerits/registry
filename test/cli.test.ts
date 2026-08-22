import { mkdtemp, rm, writeFile, mkdir, readFile, access, symlink, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../src/cli/index.js';
import { initializeState, validateState } from '../src/state.js';
import { availableVersions, parseGitReference, satisfies } from '../src/git.js';
import { formatSelfUpdateDetails } from '../src/cli/commands/self-update.js';
import { errorMessage, isErrnoError, isRecord } from '../src/shared.js';
import { copySafeFile, safeFilePath } from '../src/filesystem.js';

const temporaryDirectories: string[] = [];
const exec = promisify(execFile);
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });
async function tempDirectory() { const directory = await mkdtemp(path.join(os.tmpdir(), 'ui-registry-')); temporaryDirectories.push(directory); return directory; }

describe('component list', () => {
  it('handles missing state', async () => {
    const directory = await tempDirectory();
    const result = await capture(() => run(['component', 'list'], directory));
    expect(result).toEqual({ code: 0, stdout: '! No installed components.\n', stderr: '' });
  });
  it('lists sorted state', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { zeta: { version: '1.0.0', path: 'zeta', repository: 'https://github.com/example/zeta.git' }, alpha: { version: '2.0.0', path: 'alpha' } } }));
    const result = await capture(() => run(['component', 'list'], directory));
    expect(result.stdout).toContain('UI Registry  /  component list');
    expect(result.stdout).toContain('2 components');
    expect(result.stdout).toContain('2 enabled  ·  0 disabled');
    expect(result.stdout).toContain('alpha');
    expect(result.stdout).toContain('v2.0.0');
    expect(result.stdout).toContain('zeta');
    expect(result.stdout).toContain('v1.0.0');
    expect(result.stdout).toContain('Next: ui component');
  });
  it('supports JSON output', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { button: { version: '1.0.0', path: 'components/button' } } }));
    const result = await capture(() => run(['component', 'list', '--json'], directory));
    expect(JSON.parse(result.stdout)).toEqual([{ name: 'button', enabled: true, version: '1.0.0', path: 'components/button' }]);
  });
  it('shows component status in info output', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { button: { enabled: false, version: '1.0.0', path: 'components/button', files: [{ path: 'components/button', sha256: '' }] } } }));
    const result = await capture(() => run(['component', 'info', 'button'], directory));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('button  ○ disabled');
    expect(result.stdout).toContain('UI Registry  /  component details  /  button');
  });
});

describe('help', () => {
  it('shows a scannable root command reference', async () => {
    const result = await capture(() => run(['help']));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('ui component add');
    expect(result.stdout).toContain('update                Update UI Registry');
    expect(result.stdout).toContain('hooks                 Manage project hooks');
    expect(result.stdout).toContain('component outdated');
    expect(result.stdout).not.toContain('component.json must be in the repository root');
  });
  it('shows help with no arguments', async () => {
    const result = await capture(() => run([]));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('UI Registry');
  });
  it('shows focused command help', async () => {
    const result = await capture(() => run(['help', 'component', 'add']));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('ui component add <repository> [options]');
    expect(result.stdout).toContain('owner/repository');
  });
  it('shows focused help for every documented command', async () => {
    const commands = ['init', 'update', 'hooks', 'doctor', 'component', 'component list', 'component info', 'component add', 'component remove', 'component update', 'component outdated', 'component versions', 'component enable', 'component disable'];
    for (const command of commands) {
      const result = await capture(() => run(['help', ...command.split(' ')]));
      expect(result.code, command).toBe(0);
      expect(result.stdout, command).not.toContain('Unknown help topic');
    }
  });
  it('keeps JSON command output independently parseable', async () => {
    const directory = await tempDirectory();
    const initialized = await capture(() => run(['init', '--json'], directory));
    expect(JSON.parse(initialized.stdout)).toMatchObject({ initialized: true, file: 'ui.json' });
    const diagnosis = await capture(() => run(['doctor', '--json'], directory));
    expect(JSON.parse(diagnosis.stdout).checks).toEqual([{ check: 'Project initialized', status: 'ok' }]);
  });
  it('shows the hooks namespace status', async () => {
    const result = await capture(() => run(['hooks']));
    expect(result).toEqual({ code: 0, stdout: expect.stringContaining('No hooks configured yet.'), stderr: '' });
  });
  it('initializes a project state file once', async () => {
    const directory = await tempDirectory();
    const initialized = await capture(() => run(['init'], directory));
    expect(initialized.code).toBe(0);
    expect(initialized.stdout).toContain('Project ready.');
    expect(JSON.parse(await readFile(path.join(directory, 'ui.json'), 'utf8'))).toEqual({ components: {} });
    const duplicate = await capture(() => run(['init'], directory));
    expect(duplicate.code).toBe(0);
    expect(duplicate.stdout).toContain('already initialized');
  });
  it('shows component namespace commands without a TTY', async () => {
    const result = await capture(() => run(['component']));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Component commands');
    expect(result.stdout).toContain('ui component update [name] [--json]');
  });
  it('rejects unknown commands with a useful usage message', async () => {
    const result = await capture(() => run(['component', 'unknown']));
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('Unknown command. Run "ui help" for available commands.\n');
  });
  it('reports missing command arguments', async () => {
    const info = await capture(() => run(['component', 'info']));
    const add = await capture(() => run(['component', 'add']));
    const remove = await capture(() => run(['component', 'remove']));
    const update = await capture(() => run(['component', 'update']));
    const toggle = await capture(() => run(['component', 'toggle']));
    expect(info).toEqual({ code: 1, stdout: 'Usage: ui component info <name> [--json]\n', stderr: '' });
    expect(add).toEqual({ code: 1, stdout: 'Usage: ui component add <repository> [--version <version>] [--dry-run] [--force] [--json]\n', stderr: '' });
    expect(remove).toEqual({ code: 1, stdout: 'Usage: ui component remove <name> [--json]\n', stderr: '' });
    expect(update).toEqual({ code: 1, stdout: 'No updatable components are installed.\n', stderr: '' });
    expect(toggle).toEqual({ code: 1, stdout: 'Usage: ui component toggle <name> [--json]\n', stderr: '' });
  });
  it('rejects self-update outside an installed launcher', async () => {
    const installDirectory = process.env.UI_INSTALL_DIR;
    const cacheDirectory = process.env.UI_CACHE_DIR;
    delete process.env.UI_INSTALL_DIR;
    delete process.env.UI_CACHE_DIR;
    try {
      const result = await capture(() => run(['self-update']));
      expect(result).toEqual({ code: 1, stdout: 'Self-update is only available through an installed ui launcher.\n', stderr: '' });
    } finally {
      if (installDirectory === undefined) delete process.env.UI_INSTALL_DIR; else process.env.UI_INSTALL_DIR = installDirectory;
      if (cacheDirectory === undefined) delete process.env.UI_CACHE_DIR; else process.env.UI_CACHE_DIR = cacheDirectory;
    }
  });
  it('shows self-update version status', () => {
    const updated = formatSelfUpdateDetails('Checking installed version: 0.0.1\nChecking latest version: 0.0.2\nRemoving installed version: 0.0.1\nInstalling latest version: 0.0.2');
    expect(updated.current).toBe(false);
    expect(updated.body).toContain('v0.0.1');
    expect(updated.body).toContain('v0.0.2');
    expect(updated.body).toContain('Removing installed version: 0.0.1');
    const current = formatSelfUpdateDetails('Checking installed version: 0.0.1\nChecking latest version: 0.0.1\nUI Registry is already up to date at v0.0.1.');
    expect(current.current).toBe(true);
    expect(current.body).toContain('v0.0.1');
    expect(current.body).toContain('already up to date');
    const fallback = formatSelfUpdateDetails('Checking latest version: 0.0.2\nInstalling latest version: 0.0.2', '0.0.1');
    expect(fallback.current).toBe(false);
    expect(fallback.body).toContain('v0.0.1');
  });
});

describe('validation', () => {
  it('validates state schema', () => {
    expect(() => validateState({ components: { button: { version: '1', path: 'button' } } })).not.toThrow();
    expect(() => validateState({ components: { button: { version: 1 } } })).toThrow(/version.*path/);
  });

  it('initializes state exclusively when concurrent callers race', async () => {
    const directory = await tempDirectory();
    const results = await Promise.all([
      initializeState(directory, { components: {} }),
      initializeState(directory, { components: {} }),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(JSON.parse(await readFile(path.join(directory, 'ui.json'), 'utf8'))).toEqual({ components: {} });
  });
});

describe('shared helpers', () => {
  it('narrows records and filesystem errors safely', () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
    expect(isErrnoError(error)).toBe(true);
    expect(isErrnoError('missing')).toBe(false);
  });

  it('formats errors consistently', () => {
    expect(errorMessage(new Error('failed'))).toBe('failed');
    expect(errorMessage('failed')).toBe('failed');
  });
});

describe('local Git installation', () => {
  it('uses standard caret compatibility semantics', () => {
    expect(satisfies('0.9.0', '^0')).toBe(true);
    expect(satisfies('1.0.0', '^0')).toBe(false);
    expect(satisfies('0.1.9', '^0.1')).toBe(true);
    expect(satisfies('0.2.0', '^0.1')).toBe(false);
    expect(satisfies('0.0.1', '^0.0.1')).toBe(true);
    expect(satisfies('0.0.2', '^0.0.1')).toBe(false);
  });

  it('reads stable versions from remote tag metadata without cloning', async () => {
    const repository = await tempDirectory();
    await writeFile(path.join(repository, 'README.md'), 'fixture\n');
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'fixture']);
    await exec('git', ['-C', repository, 'tag', 'v1.2.3']);
    await exec('git', ['-C', repository, 'tag', '1.10.0']);
    await exec('git', ['-C', repository, 'tag', 'next']);
    expect(await availableVersions(repository)).toEqual(['1.10.0', '1.2.3']);
  });

  it('normalizes references and installs a tagged fixture without network access', async () => {
    const repository = await tempDirectory();
    await mkdir(path.join(repository, 'src'), { recursive: true });
    await writeFile(path.join(repository, 'src', 'button.tsx'), 'export const Button = 1;\n');
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', description: 'button', files: [{ source: 'src/button.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'fixture']);
    await exec('git', ['-C', repository, 'tag', 'v1.2.3']);
    const project = await tempDirectory();
    expect(parseGitReference(`https://example.invalid/ui.git#1.2.3`)).toEqual({ repository: 'https://example.invalid/ui.git', version: '1.2.3' });
    const dryRun = await capture(() => run(['component', 'add', repository, '--dry-run', '--json'], project));
    expect(dryRun.code, dryRun.stderr).toBe(0);
    expect(JSON.parse(dryRun.stdout).components[0].name).toBe('button');
    const added = await capture(() => run(['component', 'add', repository, '--version=1.2.3'], project));
    expect(added.code).toBe(0);
    expect(added.stdout).toContain('Added button@1.2.3');
    expect(added.stdout).toContain('1 component added');
    expect(await readFile(path.join(project, 'components/button.tsx'), 'utf8')).toContain('Button');
    const available = await capture(() => run(['component', 'list', '--available-versions'], project));
    expect(available.stdout).toContain('Available: 1.2.3');
    const toggled = await capture(() => run(['component', 'toggle', 'button'], project));
    expect(toggled.code).toBe(0);
    expect(toggled.stdout).toContain('● enabled  →  ○ disabled');
    expect(toggled.stdout).toContain('button is disabled');
    expect(JSON.parse(await readFile(path.join(project, 'ui.json'), 'utf8')).components.button.enabled).toBe(false);
    const toggledJson = await capture(() => run(['component', 'toggle', 'button', '--json'], project));
    expect(JSON.parse(toggledJson.stdout)).toMatchObject({ name: 'button', previousStatus: 'disabled', status: 'enabled', component: { enabled: true } });
    const duplicate = await capture(() => run(['component', 'add', repository], project));
    expect(duplicate).toEqual({ code: 1, stdout: '', stderr: 'Component "button" is already installed. Use --force to overwrite it.\n' });
    const forced = await capture(() => run(['component', 'add', repository, '--force'], project));
    expect(forced.code).toBe(0);
    const removed = await capture(() => run(['component', 'remove', 'button'], project));
    expect(removed.code).toBe(0);
    expect(removed.stdout).toContain('Removed button.');
    expect(removed.stdout).toContain('files removed');
    await expect(access(path.join(project, 'components/button.tsx'))).rejects.toThrow();
    const missing = await capture(() => run(['component', 'remove', 'button'], project));
    expect(missing).toEqual({ code: 1, stdout: 'Component "button" is not installed.\n', stderr: '' });
  });

  it('records file hashes and doctor detects changed and missing files', async () => {
    const repository = await tempDirectory();
    await mkdir(path.join(repository, 'src'), { recursive: true });
    await writeFile(path.join(repository, 'src/button.tsx'), 'export const Button = 1;\n');
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', files: [{ source: 'src/button.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'fixture']);
    await exec('git', ['-C', repository, 'tag', '1.0.0']);
    const project = await tempDirectory();
    expect((await capture(() => run(['component', 'add', repository], project))).code).toBe(0);
    const state = JSON.parse(await readFile(path.join(project, 'ui.json'), 'utf8'));
    expect(state.components.button.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await capture(() => run(['doctor'], project))).code).toBe(0);
    await writeFile(path.join(project, 'components/button.tsx'), 'changed\n');
    expect((await capture(() => run(['doctor'], project))).stdout).toContain('changed');
    await rm(path.join(project, 'components/button.tsx'));
    expect((await capture(() => run(['doctor'], project))).stdout).toContain('missing');
  });

  it('rejects symlinked install sources and destinations', async () => {
    const sourceRoot = await tempDirectory();
    const outside = await tempDirectory();
    await writeFile(path.join(outside, 'file.ts'), 'outside');
    await symlink(path.join(outside, 'file.ts'), path.join(sourceRoot, 'file.ts'));
    await expect(safeFilePath(sourceRoot, 'file.ts', 'source')).rejects.toThrow(/symlinks/);

    const project = await tempDirectory();
    const source = path.join(sourceRoot, 'regular.ts');
    await writeFile(source, 'regular');
    await symlink(outside, path.join(project, 'components'));
    await expect(copySafeFile(source, path.join(project, 'components/file.ts'), 'file')).rejects.toThrow(/symlinks/);
  });

  it('rejects traversal paths before touching the filesystem', async () => {
    await expect(safeFilePath(await tempDirectory(), '../outside', 'target', false)).rejects.toThrow(/safe relative path|stay within/);
  });
  it('rejects repositories without a root component.json', async () => {
    const repository = await tempDirectory();
    await writeFile(path.join(repository, 'README.md'), 'not a component\n');
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'invalid component']);
    await exec('git', ['-C', repository, 'tag', '1.0.0']);
    const project = await tempDirectory();
    const result = await capture(() => run(['component', 'add', repository], project));
    expect(result.code).toBe(1);
    expect(result).toEqual({ code: 1, stdout: '', stderr: 'Provided source is not a component: missing component.json.\n' });
    await expect(access(path.join(project, 'ui.json'))).rejects.toThrow();
  });
  it('stores the root app version and updates within the component major version', async () => {
    const repository = await tempDirectory();
    await mkdir(path.join(repository, 'src'), { recursive: true });
    await writeFile(path.join(repository, 'src', 'button.tsx'), 'export const Button = 1;\n');
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', files: [{ source: 'src/button.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'v1.0.0']);
    await exec('git', ['-C', repository, 'tag', '1.0.0']);
    const project = await tempDirectory();
    await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'example-app', version: '2.0.0' }));
    const added = await capture(() => run(['component', 'add', `${repository}#^1`], project));
    expect(added.code).toBe(0);
    expect(JSON.parse(await readFile(path.join(project, 'ui.json'), 'utf8'))).toMatchObject({ version: '2.0.0', components: { button: { version: '1.0.0', constraint: '^1' } } });
    await writeFile(path.join(repository, 'src', 'button.tsx'), 'export const Button = 2;\n');
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'v1.1.0']);
    await exec('git', ['-C', repository, 'tag', '1.1.0']);
    const updated = await capture(() => run(['component', 'update', 'button'], project));
    expect(updated.code).toBe(0);
    expect(updated.stdout).toContain('Updated button@1.1.0');
    expect(updated.stdout).toContain('1 component updated');
    expect(await readFile(path.join(project, 'components/button.tsx'), 'utf8')).toContain('Button = 2');
    expect(JSON.parse(await readFile(path.join(project, 'ui.json'), 'utf8')).components.button.enabled).toBe(true);
  });
  it('removes stale files and rolls the update back when dependencies fail', async () => {
    const repository = await tempDirectory();
    await mkdir(path.join(repository, 'src'), { recursive: true });
    await writeFile(path.join(repository, 'src/old.ts'), 'old\n');
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', files: [{ source: 'src/old.ts', target: 'components/old.ts' }], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'initial']);
    await exec('git', ['-C', repository, 'tag', '1.0.0']);
    const project = await tempDirectory();
    expect((await capture(() => run(['component', 'add', repository], project))).code).toBe(0);

    await rm(path.join(repository, 'src/old.ts'));
    await writeFile(path.join(repository, 'src/new.ts'), 'new\n');
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', files: [{ source: 'src/new.ts', target: 'components/new.ts' }], dependencies: { 'not a valid package': '1.0.0' }, components: [] }));
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'breaking update']);
    await exec('git', ['-C', repository, 'tag', '1.1.0']);

    const failed = await capture(() => run(['component', 'update', 'button'], project));
    expect(failed.code).toBe(1);
    expect(await readFile(path.join(project, 'components/old.ts'), 'utf8')).toBe('old\n');
    await expect(access(path.join(project, 'components/new.ts'))).rejects.toThrow();
    expect(JSON.parse(await readFile(path.join(project, 'ui.json'), 'utf8')).components.button.version).toBe('1.0.0');
    expect((await readdir(project)).filter((file) => file.startsWith('.ui-stage-'))).toEqual([]);
  });
  it('filters outdated versions by the persisted constraint', async () => {
    const repository = await tempDirectory();
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'button', files: [], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'versions']);
    await exec('git', ['-C', repository, 'tag', '1.1.0']);
    await exec('git', ['-C', repository, 'tag', '2.0.0']);
    const project = await tempDirectory();
    await writeFile(path.join(project, 'ui.json'), JSON.stringify({ components: { button: { version: '1.0.0', constraint: '^1', path: '', repository } } }));
    const outdated = await capture(() => run(['component', 'outdated', '--json'], project));
    expect(JSON.parse(outdated.stdout)).toEqual([{ name: 'button', current: 'v1.0.0', latest: 'v1.1.0' }]);
  });
  it('rejects invalid component.json before writing files', async () => {
    const repository = await tempDirectory();
    await writeFile(path.join(repository, 'component.json'), JSON.stringify({ schemaVersion: 1, name: 'Invalid Name' }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'invalid manifest']);
    await exec('git', ['-C', repository, 'tag', '1.0.0']);
    const project = await tempDirectory();
    const result = await capture(() => run(['component', 'add', repository], project));
    expect(result).toEqual({ code: 1, stdout: '', stderr: 'component.json requires schemaVersion 1, a lowercase kebab-case name, files, dependencies, and components.\n' });
    await expect(access(path.join(project, 'ui.json'))).rejects.toThrow();
  });
});

describe('manifest generation and recursive dependencies', () => {
  async function gitRepository(name: string, manifest: object, files: Record<string, string>, version = '1.0.0') {
    const repository = await tempDirectory();
    for (const [file, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(repository, file)), { recursive: true }); await writeFile(path.join(repository, file), content); }
    await writeFile(path.join(repository, 'component.json'), JSON.stringify(manifest));
    await exec('git', ['init', '-q', repository]); await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']); await exec('git', ['-C', repository, 'config', 'user.name', 'Test']); await exec('git', ['-C', repository, 'add', '.']); await exec('git', ['-C', repository, 'commit', '-qm', name]); await exec('git', ['-C', repository, 'tag', version]);
    return repository;
  }
  it('installs recursive dependencies and preserves npm dependency objects', async () => {
    const child = await gitRepository('child', { schemaVersion: 1, name: 'child', files: [{ source: 'src/child.ts', target: 'components/child.ts' }], dependencies: { zod: '^3.0.0' }, components: [] }, { 'src/child.ts': 'export const child = 1;\n' });
    const parent = await gitRepository('parent', { schemaVersion: 1, name: 'parent', files: [{ source: 'src/parent.ts', target: 'components/parent.ts' }], dependencies: { react: '^19.0.0' }, components: [{ repository: child, version: '^1' }] }, { 'src/parent.ts': 'export const parent = 1;\n' });
    const project = await tempDirectory(); const result = await capture(() => run(['component', 'add', parent], project));
    expect(result.code).toBe(0); expect(await readFile(path.join(project, 'components/child.ts'), 'utf8')).toContain('child'); expect(await readFile(path.join(project, 'ui.json'), 'utf8')).toContain('"repository"');
  });
  it('detects recursive dependency cycles before writing files', async () => {
    const a = await tempDirectory(); const b = await tempDirectory();
    const make = async (directory: string, name: string, dependency: string) => { await mkdir(path.join(directory, 'src')); await writeFile(path.join(directory, 'src', `${name}.ts`), name); await writeFile(path.join(directory, 'component.json'), JSON.stringify({ schemaVersion: 1, name, files: [{ source: `src/${name}.ts`, target: `components/${name}.ts` }], dependencies: {}, components: [{ repository: dependency }] })); await exec('git', ['init', '-q', directory]); await exec('git', ['-C', directory, 'config', 'user.email', 'test@example.invalid']); await exec('git', ['-C', directory, 'config', 'user.name', 'Test']); await exec('git', ['-C', directory, 'add', '.']); await exec('git', ['-C', directory, 'commit', '-qm', name]); await exec('git', ['-C', directory, 'tag', '1.0.0']); };
    await make(a, 'a', b); await make(b, 'b', a); const project = await tempDirectory(); const result = await capture(() => run(['component', 'add', a], project)); expect(result.code).toBe(1); await expect(access(path.join(project, 'components/a.ts'))).rejects.toThrow();
  });
});

async function capture(action: () => Promise<number>) {
  let stdout = '';
  let stderr = '';
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = ((chunk: string) => { stdout += chunk; return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => { stderr += chunk; return true; }) as typeof process.stderr.write;
  try { return { code: await action(), stdout, stderr }; } finally { process.stdout.write = originalOut; process.stderr.write = originalErr; }
}
