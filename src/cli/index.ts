import process from 'node:process';
import { Command, CommanderError } from 'commander';
import type { CommandResult } from '../types.js';
import { errorMessage } from '../shared.js';
import { colors } from './ui.js';
import { registerCommands } from './commands/registry.js';

/** Converts Commander unknown-command failures into the CLI's stable message. */
function unknownCommand(): CommandResult {
  return { output: `${colors.error('Unknown command.')} Run "ui help" for available commands.\n`, exitCode: 1 };
}

/** Parses CLI arguments and dispatches the selected command. */
export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  const commandArgs = args.length ? args : ['help'];
  let result: CommandResult | undefined;
  const program = new Command()
    .name('ui')
    .description('Install and manage components from Git repositories.')
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined });

  registerCommands(program, cwd, (commandResult) => { result = commandResult; });

  try {
    await program.parseAsync(commandArgs, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      result = error.code === 'commander.unknownCommand' || error.code === 'commander.excessArguments' ? unknownCommand() : { output: `${error.message}\n`, exitCode: error.exitCode || 1 };
    } else {
      process.stderr.write(`${errorMessage(error)}\n`);
      return 1;
    }
  }
  const output = result ?? unknownCommand();
  process.stdout.write(output.output);
  return output.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
