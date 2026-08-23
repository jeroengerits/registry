import path from 'node:path';
import process from 'node:process';

export interface RuntimeOptions { args: string[]; cwd: string; quiet: boolean; noInput: boolean; color?: 'auto' | 'always' | 'never'; }

/** Extracts process-wide Unix options before Commander sees command-specific flags. */
export function parseRuntimeOptions(args: string[], cwd: string): RuntimeOptions {
  const remaining: string[] = [];
  let project = cwd;
  let quiet = false;
  let noInput = false;
  let color: RuntimeOptions['color'];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '-C' || argument === '--project') {
      const value = args[++index];
      if (!value) throw new Error(`${argument} requires a project path.`);
      project = value;
    } else if (argument.startsWith('--project=')) {
      project = argument.slice('--project='.length);
    } else if (argument === '--quiet') {
      quiet = true;
    } else if (argument === '--no-input') {
      noInput = true;
    } else if (argument === '--color' || argument.startsWith('--color=')) {
      const value = argument === '--color' ? args[++index] : argument.slice('--color='.length);
      if (!value) throw new Error('--color requires auto, always, or never.');
      if (value !== 'auto' && value !== 'always' && value !== 'never') throw new Error('--color must be auto, always, or never.');
      color = value;
    } else {
      remaining.push(argument);
    }
  }
  return { args: remaining, cwd: path.resolve(cwd, project), quiet, noInput, color };
}

/** Applies process-scoped CLI settings and always restores the caller's environment. */
export async function withRuntimeEnvironment<T>(options: RuntimeOptions, action: () => Promise<T>): Promise<T> {
  const previousNoInput = process.env.UI_NO_INPUT;
  const previousQuiet = process.env.UI_QUIET;
  const previousNoColor = process.env.NO_COLOR;
  const previousForceColor = process.env.FORCE_COLOR;
  if (options.noInput) process.env.UI_NO_INPUT = '1';
  if (options.quiet) process.env.UI_QUIET = '1';
  if (options.color === 'never') process.env.NO_COLOR = '1';
  if (options.color === 'always') { delete process.env.NO_COLOR; process.env.FORCE_COLOR = '1'; }
  try {
    return await action();
  } finally {
    if (previousNoInput === undefined) delete process.env.UI_NO_INPUT; else process.env.UI_NO_INPUT = previousNoInput;
    if (previousQuiet === undefined) delete process.env.UI_QUIET; else process.env.UI_QUIET = previousQuiet;
    if (previousNoColor === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = previousNoColor;
    if (previousForceColor === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = previousForceColor;
  }
}
