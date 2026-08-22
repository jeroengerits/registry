import { mkdtemp, rm, writeFile, mkdir, readFile, access, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../src/cli.js';
import { validateManifest } from '../src/manifest.js';
import { validateState } from '../src/state.js';
import { parseGitReference } from '../src/git.js';

const temporaryDirectories: string[] = [];
const exec = promisify(execFile);
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });
async function tempDirectory() { const directory = await mkdtemp(path.join(os.tmpdir(), 'ui-registry-')); temporaryDirectories.push(directory); return directory; }

describe('components list', () => {
  it('handles missing state', async () => {
    const directory = await tempDirectory();
    const result = await capture(() => run(['components', 'list'], directory));
    expect(result).toEqual({ code: 0, stdout: 'No installed components.\n', stderr: '' });
  });
  it('lists sorted state', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { zeta: { version: '1.0.0', path: 'zeta' }, alpha: { version: '2.0.0', path: 'alpha' } } }));
    const result = await capture(() => run(['components', 'list'], directory));
    expect(result.stdout).toBe('alpha@2.0.0 (alpha)\nzeta@1.0.0 (zeta)\n');
  });
  it('supports JSON output', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { button: { version: '1.0.0', path: 'components/button' } } }));
    const result = await capture(() => run(['components', 'list', '--json'], directory));
    expect(JSON.parse(result.stdout)).toEqual([{ name: 'button', version: '1.0.0', path: 'components/button' }]);
  });
  it('lists components through the hooks alias', async () => {
    const directory = await tempDirectory();
    await writeFile(path.join(directory, 'ui.json'), JSON.stringify({ components: { button: { version: '1.0.0', path: 'components/button' } } }));
    const result = await capture(() => run(['hooks', 'list'], directory));
    expect(result).toEqual({ code: 0, stdout: 'button@1.0.0 (components/button)\n', stderr: '' });
  });
  it('creates a usable React component package', async () => {
    const directory = await tempDirectory();
    const result = await capture(() => run(['components', 'create', 'date-picker'], directory));
    expect(result).toEqual({ code: 0, stdout: 'Created components/date-picker\n', stderr: '' });
    expect(JSON.parse(await readFile(path.join(directory, 'components/date-picker', 'components.json'), 'utf8'))).toEqual({ schemaVersion: 1, name: 'date-picker', files: [{ source: 'src/date-picker.tsx', target: 'components/date-picker.tsx' }], dependencies: {}, components: [] });
    expect(JSON.parse(await readFile(path.join(directory, 'components/date-picker', 'package.json'), 'utf8'))).toEqual({ name: 'date-picker', version: '0.1.0', private: true, type: 'module' });
    await expect(stat(path.join(directory, 'components/date-picker', 'src/date-picker.tsx'))).resolves.toBeDefined();
    expect(await readFile(path.join(directory, 'components/date-picker', 'src/date-picker.tsx'), 'utf8')).toContain('export function DatePicker');
  });
  it('rejects invalid names and existing component packages', async () => {
    const directory = await tempDirectory();
    expect((await capture(() => run(['components', 'create', 'Date Picker'], directory))).code).toBe(1);
    expect((await capture(() => run(['components', 'create', 'button'], directory))).code).toBe(0);
    const duplicate = await capture(() => run(['components', 'create', 'button'], directory));
    expect(duplicate.code).toBe(1);
    expect(`${duplicate.stdout}${duplicate.stderr}`).toContain('already exists');
  });
});

describe('validation', () => {
  it('validates state schema', () => {
    expect(() => validateState({ components: { button: { version: '1', path: 'button' } } })).not.toThrow();
    expect(() => validateState({ components: { button: { version: 1 } } })).toThrow(/version.*path/);
  });
  it('validates manifests', async () => {
    expect(validateManifest({ schemaVersion: 1, name: 'button', files: [], dependencies: {}, components: [] })).toEqual({ schemaVersion: 1, name: 'button', files: [], dependencies: {}, components: [] });
    expect(() => validateManifest({ schemaVersion: 1, name: 'Button', files: [], dependencies: {}, components: [] })).toThrow(/lowercase kebab-case/);
    expect(() => validateManifest({ schemaVersion: 1, name: 'button', files: [{ source: '../button.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] })).toThrow(/stay within the project/);
    expect(() => validateManifest({ schemaVersion: 1, name: 'button', files: [], dependencies: { react: '' }, components: [] })).toThrow(/non-empty ranges/);
    expect(() => validateManifest({ schemaVersion: 1, name: 'button', files: [{ source: 'src/button.tsx', target: 'components/button.tsx' }, { source: 'src/other.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] })).toThrow(/duplicate target/);
    const directory = await tempDirectory();
    const result = await capture(() => run(['manifest', 'validate', 'missing.json'], directory));
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unable to read manifest');
  });
});

describe('local Git installation', () => {
  it('normalizes references and installs a tagged fixture without network access', async () => {
    const repository = await tempDirectory();
    await mkdir(path.join(repository, 'src'), { recursive: true });
    await writeFile(path.join(repository, 'src', 'button.tsx'), 'export const Button = 1;\n');
    await writeFile(path.join(repository, 'components.json'), JSON.stringify({ schemaVersion: 1, name: 'button', description: 'button', files: [{ source: 'src/button.tsx', target: 'components/button.tsx' }], dependencies: {}, components: [] }));
    await exec('git', ['init', '-q', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Test']);
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-qm', 'fixture']);
    await exec('git', ['-C', repository, 'tag', 'v1.2.3']);
    const project = await tempDirectory();
    expect(parseGitReference(`https://example.invalid/ui.git#1.2.3`)).toEqual({ repository: 'https://example.invalid/ui.git', version: '1.2.3' });
    const dryRun = await capture(() => run(['add', repository, '--dry-run', '--json'], project));
    expect(dryRun.code, dryRun.stderr).toBe(0);
    expect(JSON.parse(dryRun.stdout).components[0].name).toBe('button');
    const added = await capture(() => run(['add', `${repository}#1.2.3`, '--yes'], project));
    expect(added.code).toBe(0);
    expect(await readFile(path.join(project, 'components/button.tsx'), 'utf8')).toContain('Button');
    const removed = await capture(() => run(['remove', 'button'], project));
    expect(removed.code).toBe(0);
  });
});

describe('manifest generation and recursive dependencies', () => {
  async function gitRepository(name: string, manifest: object, files: Record<string, string>, version = '1.0.0') {
    const repository = await tempDirectory();
    for (const [file, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(repository, file)), { recursive: true }); await writeFile(path.join(repository, file), content); }
    await writeFile(path.join(repository, 'components.json'), JSON.stringify(manifest));
    await exec('git', ['init', '-q', repository]); await exec('git', ['-C', repository, 'config', 'user.email', 'test@example.invalid']); await exec('git', ['-C', repository, 'config', 'user.name', 'Test']); await exec('git', ['-C', repository, 'add', '.']); await exec('git', ['-C', repository, 'commit', '-qm', name]); await exec('git', ['-C', repository, 'tag', version]);
    return repository;
  }
  it('installs recursive dependencies and preserves npm dependency objects', async () => {
    const child = await gitRepository('child', { schemaVersion: 1, name: 'child', files: [{ source: 'src/child.ts', target: 'components/child.ts' }], dependencies: { zod: '^3.0.0' }, components: [] }, { 'src/child.ts': 'export const child = 1;\n' });
    const parent = await gitRepository('parent', { schemaVersion: 1, name: 'parent', files: [{ source: 'src/parent.ts', target: 'components/parent.ts' }], dependencies: { react: '^19.0.0' }, components: [{ repository: child, version: '^1' }] }, { 'src/parent.ts': 'export const parent = 1;\n' });
    const project = await tempDirectory(); const result = await capture(() => run(['add', parent, '--yes'], project));
    expect(result.code).toBe(0); expect(await readFile(path.join(project, 'components/child.ts'), 'utf8')).toContain('child'); expect(await readFile(path.join(project, 'ui.json'), 'utf8')).toContain('"repository"');
  });
  it('detects recursive dependency cycles before writing files', async () => {
    const a = await tempDirectory(); const b = await tempDirectory();
    const make = async (directory: string, name: string, dependency: string) => { await mkdir(path.join(directory, 'src')); await writeFile(path.join(directory, 'src', `${name}.ts`), name); await writeFile(path.join(directory, 'components.json'), JSON.stringify({ schemaVersion: 1, name, files: [{ source: `src/${name}.ts`, target: `components/${name}.ts` }], dependencies: {}, components: [{ repository: dependency }] })); await exec('git', ['init', '-q', directory]); await exec('git', ['-C', directory, 'config', 'user.email', 'test@example.invalid']); await exec('git', ['-C', directory, 'config', 'user.name', 'Test']); await exec('git', ['-C', directory, 'add', '.']); await exec('git', ['-C', directory, 'commit', '-qm', name]); await exec('git', ['-C', directory, 'tag', '1.0.0']); };
    await make(a, 'a', b); await make(b, 'b', a); const project = await tempDirectory(); const result = await capture(() => run(['add', a, '--yes'], project)); expect(result.code).toBe(1); await expect(access(path.join(project, 'components/a.ts'))).rejects.toThrow();
  });
  it('generates and checks a manifest from a repository directory', async () => {
    const repository = await tempDirectory(); await mkdir(path.join(repository, 'src')); await mkdir(path.join(repository, 'src', '__tests__')); await writeFile(path.join(repository, 'package.json'), JSON.stringify({ name: 'generated', description: 'Generated', dependencies: { react: '^19.0.0' } })); await writeFile(path.join(repository, 'src', 'index.tsx'), 'export {}'); await writeFile(path.join(repository, 'src', '__tests__', 'index.test.ts'), 'test');
    expect((await capture(() => run(['manifest', 'generate', repository], repository))).code).toBe(0); const manifest = JSON.parse(await readFile(path.join(repository, 'components.json'), 'utf8')); expect(manifest.name).toBe('generated'); expect(manifest.files).toEqual([{ source: 'src/index.tsx', target: 'src/index.tsx' }]); expect((await capture(() => run(['manifest', 'check', path.join(repository, 'components.json')], repository))).code).toBe(0);
  });
  it('protects modified files and updates all installed components', async () => {
    const repository = await gitRepository('update', { schemaVersion: 1, name: 'update', files: [{ source: 'src/update.ts', target: 'components/update.ts' }], dependencies: {}, components: [] }, { 'src/update.ts': 'old' });
    const project = await tempDirectory(); expect((await capture(() => run(['add', repository, '--yes'], project))).code).toBe(0); await writeFile(path.join(project, 'components/update.ts'), 'local change');
    const protectedResult = await capture(() => run(['update'], project)); expect(protectedResult.code).toBe(1); expect(await readFile(path.join(project, 'components/update.ts'), 'utf8')).toBe('local change');
    await exec('git', ['-C', repository, 'tag', '-d', '1.0.0']); await writeFile(path.join(repository, 'src/update.ts'), 'new'); await exec('git', ['-C', repository, 'add', '.']); await exec('git', ['-C', repository, 'commit', '-qm', 'new']); await exec('git', ['-C', repository, 'tag', '2.0.0']);
    expect((await capture(() => run(['update'], project))).code).toBe(1); const updated = await capture(() => run(['update', 'update', '--overwrite'], project)); expect(updated.code, updated.stderr).toBe(0); expect(await readFile(path.join(project, 'components/update.ts'), 'utf8')).toBe('new');
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
