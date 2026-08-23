import { afterEach, describe, expect, it } from 'vitest';
import { parseRuntimeOptions, withRuntimeEnvironment } from '../src/cli/runtime.js';

const environment = ['UI_NO_INPUT', 'UI_QUIET', 'NO_COLOR', 'FORCE_COLOR'] as const;
const previous = Object.fromEntries(environment.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of environment) {
    const value = previous[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe('CLI runtime', () => {
  it('parses global options without consuming command arguments', () => {
    expect(parseRuntimeOptions(['--project', './app', '--quiet', 'list', '--json'], '/tmp/project')).toEqual({
      args: ['list', '--json'], cwd: '/tmp/project/app', quiet: true, noInput: false,
    });
  });

  it('restores process environment after a failed command', async () => {
    await expect(withRuntimeEnvironment({ args: [], cwd: '/tmp', quiet: true, noInput: true, color: 'always' }, async () => {
      expect(process.env.UI_QUIET).toBe('1');
      expect(process.env.UI_NO_INPUT).toBe('1');
      throw new Error('expected failure');
    })).rejects.toThrow('expected failure');
    expect(process.env.UI_QUIET).toBe(previous.UI_QUIET);
    expect(process.env.UI_NO_INPUT).toBe(previous.UI_NO_INPUT);
    expect(process.env.NO_COLOR).toBe(previous.NO_COLOR);
    expect(process.env.FORCE_COLOR).toBe(previous.FORCE_COLOR);
  });
});
