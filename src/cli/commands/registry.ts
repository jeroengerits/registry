import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import type { CommandResult } from '../../types.js';
import { addComponent, changelog, clearCache, componentHelp, componentVersions, completion, doctor, help, infoComponent, initProject, listComponent, outdatedComponents, removeComponent, revertComponent, rollbackStatus, selfUpdate, setComponentEnabled, toggleComponent, updateComponent } from './index.js';

export interface CommandOption { flags: string; description: string; }

/** Single source of truth for Commander registration and generated help. */
export interface CommandDefinition {
  path: string;
  description: string;
  usage?: string;
  hidden?: boolean;
  options?: CommandOption[];
  register: (parent: Command, cwd: string, setResult: (result: CommandResult) => void, definition: CommandDefinition) => void;
}

const jsonOption = { flags: '--json', description: 'Print machine-readable JSON.' };

/** Expands a literal stdin source into newline-delimited component references. */
export async function expandSources(repositories: string[], readStdin = () => readFile('/dev/stdin', 'utf8')): Promise<string[]> {
  if (!repositories.includes('-')) return repositories;
  const input = await readStdin();
  return repositories.flatMap((repository) => repository === '-' ? input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [repository]);
}

/** Applies metadata-defined descriptions and options to a Commander command. */
function configure(command: Command, definition: CommandDefinition): Command {
  command.description(definition.description);
  definition.options?.forEach((option) => command.option(option.flags, option.description));
  return command;
}
const componentDefinitions: CommandDefinition[] = [
  { path: 'component list', usage: '[--json] [--versions]', description: 'List installed components.', options: [jsonOption, { flags: '--versions', description: 'Show stable versions for each installed component.' }, { flags: '--available-versions', description: 'Deprecated alias for --versions.' }], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('list'), definition); command.action(async (options: { json?: boolean; versions?: boolean; availableVersions?: boolean }) => setResult(await listComponent(cwd, Boolean(options.json), Boolean(options.versions || options.availableVersions)))); } },
  { path: 'component info', usage: '[name] [--json]', description: 'Show an installed component.', options: [jsonOption], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('info [name]'), definition); command.action(async (name: string | undefined, options: { json?: boolean }) => setResult(await infoComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component add', usage: '<repository-or-path> [options]', description: 'Install a component from GitHub or a local path.', options: [ { flags: '--version <version>', description: 'Install a specific version.' }, { flags: '--dry-run', description: 'Preview changes without writing files.' }, { flags: '--force', description: 'Overwrite an installed component.' }, jsonOption ], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('add [repositories...]'), definition); command.action(async (repositories: string[], options: { version?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => setResult(await addComponent(cwd, await expandSources(repositories ?? []), { dryRun: Boolean(options.dryRun), force: Boolean(options.force), update: false, version: options.version, json: Boolean(options.json) }))); } },
  { path: 'component remove', usage: '[name] [--dry-run] [--yes] [--json]', description: 'Remove an installed component and its files.', options: [{ flags: '--dry-run', description: 'Preview removal without changing files.' }, { flags: '--yes', description: 'Confirm removal without prompting.' }, jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('remove [name]').description('Remove an installed component and its files.'); command.option('--dry-run', 'Preview removal without changing files.').option('--yes', 'Confirm removal without prompting.').option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean; yes?: boolean; dryRun?: boolean }) => setResult(await removeComponent(cwd, name, Boolean(options.json), Boolean(options.yes), Boolean(options.dryRun)))); } },
    { path: 'component revert', usage: '[--list] [--json]', description: 'Revert or inspect the last component update.', options: [{ flags: '--list', description: 'Show whether an undo point is available.' }, jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('revert').description('Revert or inspect the last component update.'); command.option('--list', 'Show whether an undo point is available.').option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean; list?: boolean }) => setResult(await (options.list ? rollbackStatus(cwd, Boolean(options.json)) : revertComponent(cwd, Boolean(options.json))))); } },
  { path: 'component toggle', usage: '[name] [--json]', description: 'Toggle an installed component.', hidden: true, options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('toggle [name]', { hidden: true }); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await toggleComponent(cwd, name, Boolean(options.json)))); } },
    { path: 'component update', usage: '[name] [--version <version>] [--dry-run] [--json]', description: 'Update to the latest compatible or specified version.', options: [{ flags: '--version <version>', description: 'Update to one stable version.' }, { flags: '--dry-run', description: 'Preview updates without writing files.' }, jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('update [name]').description('Update to the latest compatible or specified version.'); command.option('--version <version>', 'Update to one stable version.').option('--dry-run', 'Preview updates without writing files.').option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean; version?: string; dryRun?: boolean }) => setResult(await updateComponent(cwd, name, Boolean(options.json), options.version, Boolean(options.dryRun)))); } },
  { path: 'component outdated', usage: '[--json]', description: 'Show available component updates.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('outdated').description('Show available component updates.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await outdatedComponents(cwd, Boolean(options.json)))); } },
  { path: 'component versions', usage: '<name> [--json]', description: 'Show available versions for a component.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('versions <name>').description('Show available versions for a component.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string, options: { json?: boolean }) => setResult(await componentVersions(cwd, name, Boolean(options.json)))); } },
];

export const commandDefinitions: CommandDefinition[] = [
  { path: 'component', description: 'Manage project components.', register: () => undefined },
  { path: 'help', usage: '[command...]', description: 'Show help for a command.', register: (program, _cwd, setResult) => { program.command('help [command...]').description('Show help for a command.').action((command: string[]) => setResult(help(command?.join(' ')))); } },
  { path: 'init', usage: '[--json]', description: 'Initialize a new UI project.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('init').description('Initialize a new UI project.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await initProject(cwd, Boolean(options.json)))); } },
  { path: 'self-update', usage: '[--json]', description: 'Update the UI Registry CLI.', options: [jsonOption], register: (program, _cwd, setResult) => { const command = program.command('self-update').description('Update the UI Registry CLI.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await selfUpdate(Boolean(options.json)))); } },
  { path: 'doctor', usage: '[--json]', description: 'Check project configuration.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('doctor').description('Check project configuration.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await doctor(cwd, Boolean(options.json)))); } },
  { path: 'completion', usage: '<bash|zsh|fish>', description: 'Print shell completion scripts.', register: (program, _cwd, setResult) => { program.command('completion <shell>').description('Print shell completion scripts.').action((shell: string) => setResult(completion(shell))); } },
  { path: 'clear-cache', usage: '[--yes] [--json]', description: 'Remove cached remote component sources.', options: [{ flags: '--yes', description: 'Confirm cache removal without prompting.' }, jsonOption], register: (program, cwd, setResult) => { const command = program.command('clear-cache').description('Remove cached remote component sources.'); command.option('--yes', 'Confirm cache removal without prompting.').option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean; yes?: boolean }) => setResult(await clearCache(cwd, Boolean(options.json), Boolean(options.yes)))); } },
  { path: 'changelog', usage: '[version] [--json]', description: 'Show release changes.', options: [jsonOption], register: (program, _cwd, setResult) => { const command = program.command('changelog [version]').description('Show release changes.'); command.option(jsonOption.flags, jsonOption.description).action(async (version: string | undefined, options: { json?: boolean }) => setResult(await changelog(version, Boolean(options.json)))); } },
  ...componentDefinitions,
];

/** Registers all visible and compatibility commands from the single metadata source. */
export function registerCommands(program: Command, cwd: string, setResult: (result: CommandResult) => void): void {
  program.command('cli-update', { hidden: true }).action(async () => setResult(await selfUpdate()));
  program.command('components', { hidden: true }).action(async () => setResult(await listComponent(cwd, false)));
  const component = program.command('component').description('Manage installed components.').action(() => setResult(componentHelp()));
  componentDefinitions.forEach((definition) => definition.register(component, cwd, setResult, definition));
  commandDefinitions.filter((definition) => !definition.path.startsWith('component ')).forEach((definition) => definition.register(program, cwd, setResult, definition));

  // Generate root aliases from the same definitions used by `component`.
  componentDefinitions.filter((definition) => ['add', 'list', 'remove', 'update', 'outdated', 'versions'].includes(definition.path.split(' ')[1] ?? '')).forEach((definition) => definition.register(program, cwd, setResult, definition));
  program.command('show [name]').description('Show an installed component.').option('--json', 'Print machine-readable JSON.').action(async (name: string | undefined, options: { json?: boolean }) => setResult(await infoComponent(cwd, name, Boolean(options.json))));
  program.command('status').description('Show installed component status.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean }) => setResult(await listComponent(cwd, Boolean(options.json))));
  program.command('undo').description('Undo or inspect the last component update.').option('--list', 'Show whether an undo point is available.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean; list?: boolean }) => setResult(await (options.list ? rollbackStatus(cwd, Boolean(options.json)) : revertComponent(cwd, Boolean(options.json)))));
  program.command('enable <name>').description('Enable a component.').option('--json', 'Print machine-readable JSON.').action(async (name: string, options: { json?: boolean }) => setResult(await setComponentEnabled(cwd, name, true, Boolean(options.json))));
  program.command('disable <name>').description('Disable a component.').option('--json', 'Print machine-readable JSON.').action(async (name: string, options: { json?: boolean }) => setResult(await setComponentEnabled(cwd, name, false, Boolean(options.json))));
}

export function focusedDefinition(path: string): CommandDefinition | undefined {
  // Accept both `component list` and the focused `list` help shorthand.
  return commandDefinitions.find((definition) => definition.path === path || definition.path === `component ${path}`);
}
