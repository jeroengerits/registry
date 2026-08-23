import type { Command } from 'commander';
import type { CommandResult } from '../../types.js';
import { addComponent, componentHelp, componentVersions, doctor, help, infoComponent, initProject, listComponent, outdatedComponents, removeComponent, revertComponent, selfUpdate, setComponentEnabled, toggleComponent, updateComponent } from './index.js';

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

/** Applies metadata-defined descriptions and options to a Commander command. */
function configure(command: Command, definition: CommandDefinition): Command {
  command.description(definition.description);
  definition.options?.forEach((option) => command.option(option.flags, option.description));
  return command;
}
const componentDefinitions: CommandDefinition[] = [
  { path: 'component list', usage: '[--json] [--versions]', description: 'List installed components.', options: [jsonOption, { flags: '--versions', description: 'Show stable versions for each installed component.' }, { flags: '--available-versions', description: 'Deprecated alias for --versions.' }], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('list'), definition); command.action(async (options: { json?: boolean; versions?: boolean; availableVersions?: boolean }) => setResult(await listComponent(cwd, Boolean(options.json), Boolean(options.versions || options.availableVersions)))); } },
  { path: 'component info', usage: '[name] [--json]', description: 'Show an installed component.', options: [jsonOption], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('info [name]'), definition); command.action(async (name: string | undefined, options: { json?: boolean }) => setResult(await infoComponent(cwd, name, Boolean(options.json)))); } },
   { path: 'component add', usage: '<repository-or-path> [options]', description: 'Install a component from GitHub or a local path.', options: [ { flags: '--version <version>', description: 'Install a specific version.' }, { flags: '--dry-run', description: 'Preview changes without writing files.' }, { flags: '--force', description: 'Overwrite an installed component.' }, jsonOption ], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('add [repositories...]'), definition); command.action(async (repositories: string[], options: { version?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => setResult(await addComponent(cwd, repositories ?? [], { dryRun: Boolean(options.dryRun), force: Boolean(options.force), update: false, version: options.version, json: Boolean(options.json) }))); } },
    { path: 'component remove', usage: '[name] [--yes] [--json]', description: 'Remove an installed component and its files.', options: [{ flags: '--yes', description: 'Confirm removal without prompting.' }, jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('remove [name]').description('Remove an installed component and its files.'); command.option('--yes', 'Confirm removal without prompting.').option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean; yes?: boolean }) => setResult(await removeComponent(cwd, name, Boolean(options.json), Boolean(options.yes)))); } },
    { path: 'component revert', usage: '[--json]', description: 'Revert the last component update.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('revert').description('Revert the last component update.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await revertComponent(cwd, Boolean(options.json)))); } },
  { path: 'component toggle', usage: '[name] [--json]', description: 'Toggle an installed component.', hidden: true, options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('toggle [name]', { hidden: true }); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await toggleComponent(cwd, name, Boolean(options.json)))); } },
    { path: 'component update', usage: '[name] [--version <version>] [--dry-run] [--json]', description: 'Update to the latest compatible or specified version.', options: [{ flags: '--version <version>', description: 'Update to one stable version.' }, { flags: '--dry-run', description: 'Preview updates without writing files.' }, jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('update [name]').description('Update to the latest compatible or specified version.'); command.option('--version <version>', 'Update to one stable version.').option('--dry-run', 'Preview updates without writing files.').option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean; version?: string; dryRun?: boolean }) => setResult(await updateComponent(cwd, name, Boolean(options.json), options.version, Boolean(options.dryRun)))); } },
  { path: 'component outdated', usage: '[--json]', description: 'Show available component updates.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('outdated').description('Show available component updates.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await outdatedComponents(cwd, Boolean(options.json)))); } },
  { path: 'component versions', usage: '<name> [--json]', description: 'Show available versions for a component.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('versions <name>').description('Show available versions for a component.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string, options: { json?: boolean }) => setResult(await componentVersions(cwd, name, Boolean(options.json)))); } },
];

export const commandDefinitions: CommandDefinition[] = [
  { path: 'component', description: 'Manage project components.', register: () => undefined },
  { path: 'help', usage: '[command...]', description: 'Show help for a command.', register: (program, _cwd, setResult) => { program.command('help [command...]').description('Show help for a command.').action((command: string[]) => setResult(help(command?.join(' ')))); } },
  { path: 'init', usage: '[--json]', description: 'Initialize a new UI project.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('init').description('Initialize a new UI project.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await initProject(cwd, Boolean(options.json)))); } },
  { path: 'self-update', description: 'Update the UI Registry CLI.', register: (program, _cwd, setResult) => { program.command('self-update').description('Update the UI Registry CLI.').action(async () => setResult(await selfUpdate())); } },
  { path: 'doctor', usage: '[--json]', description: 'Check project configuration.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('doctor').description('Check project configuration.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await doctor(cwd, Boolean(options.json)))); } },
  ...componentDefinitions,
];

/** Registers all visible and compatibility commands from the single metadata source. */
export function registerCommands(program: Command, cwd: string, setResult: (result: CommandResult) => void): void {
  program.command('cli-update', { hidden: true }).action(async () => setResult(await selfUpdate()));
  program.command('components', { hidden: true }).action(async () => setResult(await listComponent(cwd, false)));
  const component = program.command('component').description('Manage installed components.').action(() => setResult(componentHelp()));
  componentDefinitions.forEach((definition) => definition.register(component, cwd, setResult, definition));
  commandDefinitions.filter((definition) => !definition.path.startsWith('component ')).forEach((definition) => definition.register(program, cwd, setResult, definition));

  // Keep the common path short while preserving the explicit component namespace.
  program.command('add [repositories...]').description('Install a component.').option('--version <version>', 'Install a specific version.').option('--dry-run', 'Preview changes without writing files.').option('--force', 'Overwrite an installed component.').option('--json', 'Print machine-readable JSON.').action(async (repositories: string[], options: { version?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => setResult(await addComponent(cwd, repositories ?? [], { dryRun: Boolean(options.dryRun), force: Boolean(options.force), update: false, version: options.version, json: Boolean(options.json) })));
  program.command('list').description('List installed components.').option('--json', 'Print machine-readable JSON.').option('--versions', 'Show stable versions.').action(async (options: { json?: boolean; versions?: boolean }) => setResult(await listComponent(cwd, Boolean(options.json), Boolean(options.versions))));
  program.command('show [name]').description('Show an installed component.').option('--json', 'Print machine-readable JSON.').action(async (name: string | undefined, options: { json?: boolean }) => setResult(await infoComponent(cwd, name, Boolean(options.json))));
  program.command('remove [name]').description('Remove an installed component.').option('--yes', 'Confirm removal without prompting.').option('--json', 'Print machine-readable JSON.').action(async (name: string | undefined, options: { json?: boolean; yes?: boolean }) => setResult(await removeComponent(cwd, name, Boolean(options.json), Boolean(options.yes))));
  program.command('update [name]').description('Update one or all components.').option('--version <version>', 'Update to one stable version.').option('--dry-run', 'Preview updates without writing files.').option('--json', 'Print machine-readable JSON.').action(async (name: string | undefined, options: { json?: boolean; version?: string; dryRun?: boolean }) => setResult(await updateComponent(cwd, name, Boolean(options.json), options.version, Boolean(options.dryRun))));
  program.command('outdated').description('Show available component updates.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean }) => setResult(await outdatedComponents(cwd, Boolean(options.json))));
  program.command('versions <name>').description('Show available component versions.').option('--json', 'Print machine-readable JSON.').action(async (name: string, options: { json?: boolean }) => setResult(await componentVersions(cwd, name, Boolean(options.json))));
  program.command('undo').description('Undo the last component update.').option('--json', 'Print machine-readable JSON.').action(async (options: { json?: boolean }) => setResult(await revertComponent(cwd, Boolean(options.json))));
  program.command('enable <name>').description('Enable a component.').option('--json', 'Print machine-readable JSON.').action(async (name: string, options: { json?: boolean }) => setResult(await setComponentEnabled(cwd, name, true, Boolean(options.json))));
  program.command('disable <name>').description('Disable a component.').option('--json', 'Print machine-readable JSON.').action(async (name: string, options: { json?: boolean }) => setResult(await setComponentEnabled(cwd, name, false, Boolean(options.json))));
}

export function focusedDefinition(path: string): CommandDefinition | undefined {
  // Accept both `component list` and the focused `list` help shorthand.
  return commandDefinitions.find((definition) => definition.path === path || definition.path === `component ${path}`);
}
