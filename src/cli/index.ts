import process from 'node:process';
import path from 'node:path';
import { Command, CommanderError } from 'commander';
import type { CommandResult } from '../types.js';
import { errorMessage } from '../shared.js';
import { colors } from './ui.js';
import { registerCommands } from './commands/registry.js';

interface RuntimeOptions { args: string[]; cwd: string; quiet: boolean; noInput: boolean; }

/** Extracts process-wide Unix options before Commander sees command-specific flags. */
function runtimeOptions(args: string[], cwd: string): RuntimeOptions {
  const remaining: string[] = [];
  let project = cwd;
  let quiet = false;
  let noInput = false;
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
    } else {
      remaining.push(argument);
    }
  }
  return { args: remaining, cwd: path.resolve(cwd, project), quiet, noInput };
}

/** Converts Commander unknown-command failures into the CLI's stable message. */
function unknownCommand(): CommandResult {
  return { output: '', error: `${colors.error('Unknown command.')} Run "ui help" for available commands.`, exitCode: 1 };
}

/** Parses CLI arguments and dispatches the selected command. */
export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  let options: RuntimeOptions;
  try { options = runtimeOptions(args, cwd); } catch (error) { process.stderr.write(`${errorMessage(error)}\n`); return 2; }
  const commandArgs = options.args.length ? options.args : ['help'];
  let result: CommandResult | undefined;
  const program = new Command()
    .name('ui')
    .description('Install and manage components from Git repositories.')
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined });

  registerCommands(program, options.cwd, (commandResult) => { result = commandResult; });

  const previousNoInput = process.env.UI_NO_INPUT;
  if (options.noInput) process.env.UI_NO_INPUT = '1';
  try {
    await program.parseAsync(commandArgs, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      result = error.code === 'commander.unknownCommand' || error.code === 'commander.excessArguments' ? unknownCommand() : { output: '', error: error.message, exitCode: error.exitCode || 1 };
    } else {
      process.stderr.write(`${errorMessage(error)}\n`);
      if (options.noInput) {
        if (previousNoInput === undefined) delete process.env.UI_NO_INPUT;
        else process.env.UI_NO_INPUT = previousNoInput;
      }
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
  return output.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
