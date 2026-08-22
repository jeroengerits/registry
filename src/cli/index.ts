import process from 'node:process';
import { Command, CommanderError } from 'commander';
import { addComponent, componentHelp, help, infoComponent, listComponent, removeComponent, selfUpdate, toggleComponent, updateComponent } from './commands.js';
import type { CommandResult } from '../types.js';
import { chooseComponentCommand, interactive, promptRepository } from './ui.js';

/** Converts Commander unknown-command failures into the CLI's stable message. */
function unknownCommand(): CommandResult {
  return { output: 'Unknown command. Run "ui help" for available commands.\n', exitCode: 1 };
}

/** Parses CLI arguments and dispatches the selected command. */
export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  if (!args.length) { process.stdout.write(help().output); return 0; }
  let result: CommandResult | undefined;
  const program = new Command()
    .name('ui')
    .description('Install and manage components from Git repositories.')
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined });

  program.command('help').description('Show command help.').action(() => { result = help(); });
  program.command('self-update').description('Update the installed UI Registry CLI.').action(async () => { result = await selfUpdate(); });

  const component = program.command('component').description('Manage installed components.');
  component.action(async () => {
    if (!interactive()) { result = componentHelp(); return; }
    const command = await chooseComponentCommand();
    if (command === 'list') result = await listComponent(cwd, false);
    if (command === 'info') result = await infoComponent(cwd);
    if (command === 'remove') result = await removeComponent(cwd);
    if (command === 'toggle') result = await toggleComponent(cwd);
    if (command === 'update') result = await updateComponent(cwd);
    if (command === 'add') result = await addComponent(cwd, [await promptRepository()], { dryRun: false, force: false, update: false, json: false });
  });
  component.command('list')
    .description('List installed components.')
    .option('--json', 'Print machine-readable JSON.')
    .option('--available-versions', 'Show all stable Git tags.')
    .action(async (options: { json?: boolean; availableVersions?: boolean }) => { result = await listComponent(cwd, Boolean(options.json), Boolean(options.availableVersions)); });
  component.command('info [name]')
    .description('Show an installed component.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (name: string | undefined, options: { json?: boolean }) => { result = await infoComponent(cwd, name, Boolean(options.json)); });
  component.command('add [repositories...]')
    .description('Install one or more components.')
    .option('--version <version>', 'Install an exact stable Git tag.')
    .option('--dry-run', 'Preview changes without writing files.')
    .option('--force', 'Overwrite an installed component.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (repositories: string[], options: { version?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => {
      result = await addComponent(cwd, repositories ?? [], { dryRun: Boolean(options.dryRun), force: Boolean(options.force), update: false, version: options.version, json: Boolean(options.json) });
    });
  component.command('remove [name]')
    .description('Remove an installed component and its files.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (name: string | undefined, options: { json?: boolean }) => { result = await removeComponent(cwd, name, Boolean(options.json)); });
  component.command('toggle [name]')
    .description('Toggle whether an installed component is enabled.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (name: string | undefined, options: { json?: boolean }) => { result = await toggleComponent(cwd, name, Boolean(options.json)); });
  component.command('update [name]')
    .description('Update to the newest compatible Git tag.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (name: string | undefined, options: { json?: boolean }) => { result = await updateComponent(cwd, name, Boolean(options.json)); });

  try {
    await program.parseAsync(args, { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      result = error.code === 'commander.unknownCommand' || error.code === 'commander.excessArguments' ? unknownCommand() : { output: `${error.message}\n`, exitCode: error.exitCode || 1 };
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }
  const output = result ?? unknownCommand();
  process.stdout.write(output.output);
  return output.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
