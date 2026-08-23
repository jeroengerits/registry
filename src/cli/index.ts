import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { Command, CommanderError } from 'commander';
import type { CommandResult } from '../types.js';
import { errorMessage } from '../shared.js';
import { ensureState } from '../state.js';
import { colors } from './ui.js';
import { parseRuntimeOptions, withRuntimeEnvironment, type RuntimeOptions } from './runtime.js';
import { registerCommands } from './commands/registry.js';

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
  try { options = parseRuntimeOptions(args, cwd); } catch (error) { process.stderr.write(`${errorMessage(error)}\n`); return 2; }
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

  try {
    await withRuntimeEnvironment(options, async () => {
      if (requiresState(commandArgs)) await ensureState(options.cwd);
      await program.parseAsync(commandArgs, { from: 'user' });
    });
  } catch (error) {
    if (error instanceof CommanderError) {
      const commandError = error.code === 'commander.unknownCommand' || error.code === 'commander.excessArguments' ? unknownCommand() : { output: '', error: error.message, exitCode: 2 };
      if (jsonRequested) {
        process.stdout.write(`${JSON.stringify({ ok: false, error: { code: 'invalid_usage', message: commandError.error } }, null, 2)}\n`);
        return 2;
      }
      result = commandError;
    } else {
      const message = errorMessage(error);
      if (jsonRequested) process.stdout.write(`${JSON.stringify({ ok: false, error: { code: 'command_failed', message } }, null, 2)}\n`);
      else process.stderr.write(`${message}\n`);
      return 1;
    }
  }
  const output = result ?? unknownCommand();
  if (output.output && !options.quiet) process.stdout.write(output.output);
  if (output.error) process.stderr.write(`${output.error}\n`);
  return output.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
