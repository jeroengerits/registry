import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../src/cli.js';
import { validateManifest } from '../src/manifest.js';
import { validateState } from '../src/state.js';

const temporaryDirectories: string[] = [];
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
});

describe('validation', () => {
  it('validates state schema', () => {
    expect(() => validateState({ components: { button: { version: '1', path: 'button' } } })).not.toThrow();
    expect(() => validateState({ components: { button: { version: 1 } } })).toThrow(/version.*path/);
  });
  it('validates manifests', async () => {
    expect(validateManifest({ version: '1.0.0', path: 'button' })).toEqual({ version: '1.0.0', path: 'button' });
    const directory = await tempDirectory();
    const result = await capture(() => run(['manifest', 'validate', 'missing.json'], directory));
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unable to read manifest');
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
