import process from 'node:process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Command, CommanderError } from 'commander';
import type { CommandResult } from '../types.js';
import { errorMessage } from '../shared.js';
import { ensureState } from '../state.js';
import { colors } from './ui.js';
import { registerCommands } from './commands/registry.js';

interface RuntimeOptions { args: string[]; cwd: string; quiet: boolean; noInput: boolean; color?: 'auto' | 'always' | 'never'; }

/** Extracts process-wide Unix options before Commander sees command-specific flags. */
function runtimeOptions(args: string[], cwd: string): RuntimeOptions {
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
    } else if (argument.startsWith('--color=')) {
      const value = argument.slice('--color='.length);
      if (value !== 'auto' && value !== 'always' && value !== 'never') throw new Error('--color must be auto, always, or never.');
      color = value;
    } else {
      remaining.push(argument);
    }
  }
  return { args: remaining, cwd: path.resolve(cwd, project), quiet, noInput, color };
}

/** Converts Commander unknown-command failures into the CLI's stable message. */
function unknownCommand(): CommandResult {
  return { output: '', error: `${colors.error('Unknown command.')} Run "ui help" for available commands.`, exitCode: 2 };
}

/** Returns whether a recognized command needs project state before dispatch. */
function requiresState(args: string[]): boolean {
  const command = args.filter((argument) => !argument.startsWith('-'));
  if (command[0] === 'component') return ['list', 'info', 'remove', 'revert', 'toggle', 'update', 'outdated', 'versions'].includes(command[1] ?? '');
  return ['list', 'show', 'remove', 'status', 'update', 'outdated', 'versions', 'undo', 'enable', 'disable'].includes(command[0] ?? '');
}

/** Parses CLI arguments and dispatches the selected command. */
export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  let options: RuntimeOptions;
  try { options = runtimeOptions(args, cwd); } catch (error) { process.stderr.write(`${errorMessage(error)}\n`); return 2; }
  const commandArgs = options.args.length ? options.args : ['help'];
  const jsonRequested = commandArgs.includes('--json');
  if (commandArgs.length === 1 && (commandArgs[0] === '--version' || commandArgs[0] === '-V')) {
    const packageUrl = new URL('../../package.json', import.meta.url);
    const packageData = JSON.parse(await readFile(packageUrl, 'utf8')) as { version: string };
    process.stdout.write(`${packageData.version}\n`);
    return 0;
  }
  let result: CommandResult | undefined;
  const program = new Command()
    .name('ui')
    .description('Install and manage components from Git repositories.')
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined });

  registerCommands(program, options.cwd, (commandResult) => { result = commandResult; });

  const previousNoInput = process.env.UI_NO_INPUT;
  const previousQuiet = process.env.UI_QUIET;
  const previousNoColor = process.env.NO_COLOR;
  const previousForceColor = process.env.FORCE_COLOR;
  if (options.noInput) process.env.UI_NO_INPUT = '1';
  if (options.quiet) process.env.UI_QUIET = '1';
  if (options.color === 'never') process.env.NO_COLOR = '1';
  if (options.color === 'always') { delete process.env.NO_COLOR; process.env.FORCE_COLOR = '1'; }
  try {
    if (requiresState(commandArgs)) await ensureState(options.cwd);
    await program.parseAsync(commandArgs, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      result = error.code === 'commander.unknownCommand' || error.code === 'commander.excessArguments' ? unknownCommand() : { output: '', error: error.message, exitCode: 2 };
    } else {
      const message = errorMessage(error);
      if (jsonRequested) process.stdout.write(`${JSON.stringify({ ok: false, error: { code: 'command_failed', message } }, null, 2)}\n`);
      else process.stderr.write(`${message}\n`);
      if (options.noInput) {
        if (previousNoInput === undefined) delete process.env.UI_NO_INPUT;
        else process.env.UI_NO_INPUT = previousNoInput;
      }
      if (previousQuiet === undefined) delete process.env.UI_QUIET; else process.env.UI_QUIET = previousQuiet;
      if (previousNoColor === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = previousNoColor;
      if (previousForceColor === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = previousForceColor;
      return 1;
    }
  }
  const output = result ?? unknownCommand();
  if (output.output && !options.quiet) process.stdout.write(output.output);
  if (output.error) process.stderr.write(`${output.error}\n`);
  if (options.noInput) {
    if (previousNoInput === undefined) delete process.env.UI_NO_INPUT;
    else process.env.UI_NO_INPUT = previousNoInput;
  }
  if (previousQuiet === undefined) delete process.env.UI_QUIET; else process.env.UI_QUIET = previousQuiet;
  if (previousNoColor === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = previousNoColor;
  if (previousForceColor === undefined) delete process.env.FORCE_COLOR; else process.env.FORCE_COLOR = previousForceColor;
  return output.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
