import process from 'node:process';
import { Command, CommanderError } from 'commander';
import { addComponent, componentHelp, componentVersions, disableComponent, doctor, enableComponent, help, infoComponent, initProject, listComponent, outdatedComponents, removeComponent, selfUpdate, toggleComponent, updateComponent } from './commands/index.js';
import type { CommandResult } from '../types.js';
import { errorMessage } from '../shared.js';
import { colors, frame, outcome } from './ui.js';

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

  program.command('help [command...]').description('Show help for a command.').action((command: string[]) => { result = help(command?.join(' ')); });
  program.command('init').description('Initialize a new UI project.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean }) => { result = await initProject(cwd, Boolean(options.json)); });
  program.command('update').description('Update the UI Registry CLI.').action(async () => { result = await selfUpdate(); });
  program.command('self-update', { hidden: true }).action(async () => { result = await selfUpdate(); });
  program.command('components', { hidden: true }).action(async () => { result = await listComponent(cwd, false); });
  program.command('hooks').description('Manage project hooks.').action(() => { result = { output: frame('hooks', outcome('No hooks configured yet.', 'warning'), 'Next: ui component list'), exitCode: 0 }; });
  program.command('doctor').description('Check project configuration.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean }) => { result = await doctor(cwd, Boolean(options.json)); });

  const component = program.command('component').description('Manage installed components.');
  component.action(() => { result = componentHelp(); });
  component.command('list')
    .description('List installed components.')
    .option('--json', 'Print machine-readable JSON.')
    .option('--versions', 'Show stable versions for each installed component.')
    .option('--available-versions', 'Deprecated alias for --versions.')
     .action(async (options: { json?: boolean; versions?: boolean; availableVersions?: boolean }) => { result = await listComponent(cwd, Boolean(options.json), Boolean(options.versions || options.availableVersions)); });
  component.command('info [name]')
    .description('Show an installed component.')
    .option('--json', 'Print machine-readable JSON.')
    .action(async (name: string | undefined, options: { json?: boolean }) => { result = await infoComponent(cwd, name, Boolean(options.json)); });
  component.command('add [repositories...]')
    .description('Install a component from a GitHub repository.')
    .option('--version <version>', 'Install a specific version.')
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
   component.command('enable [name]')
     .description('Enable an installed component.')
     .option('--json', 'Print machine-readable JSON.')
     .action(async (name: string | undefined, options: { json?: boolean }) => { result = await enableComponent(cwd, name, Boolean(options.json)); });
   component.command('disable [name]')
     .description('Disable an installed component.')
     .option('--json', 'Print machine-readable JSON.')
     .action(async (name: string | undefined, options: { json?: boolean }) => { result = await disableComponent(cwd, name, Boolean(options.json)); });
   component.command('toggle [name]', { hidden: true })
     .option('--json', 'Print machine-readable JSON.')
     .action(async (name: string | undefined, options: { json?: boolean }) => { result = await toggleComponent(cwd, name, Boolean(options.json)); });
  component.command('update [name]')
     .description('Update to the latest compatible version.')
     .option('--json', 'Print machine-readable JSON.')
     .action(async (name: string | undefined, options: { json?: boolean }) => { result = await updateComponent(cwd, name, Boolean(options.json)); });
   component.command('outdated')
     .description('Show available component updates.')
     .option('--json', 'Print machine-readable JSON.')
     .action(async (options: { json?: boolean }) => { result = await outdatedComponents(cwd, Boolean(options.json)); });
   component.command('versions <name>')
     .description('Show available versions for a component.')
     .option('--json', 'Print machine-readable JSON.')
     .action(async (name: string, options: { json?: boolean }) => { result = await componentVersions(cwd, name, Boolean(options.json)); });

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
