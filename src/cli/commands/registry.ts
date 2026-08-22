import type { Command } from 'commander';
import type { CommandResult } from '../../types.js';
import { addComponent, componentHelp, componentVersions, disableComponent, doctor, enableComponent, help, infoComponent, initProject, listComponent, outdatedComponents, removeComponent, selfUpdate, toggleComponent, updateComponent } from './index.js';
import { frame, outcome } from '../ui.js';

export interface CommandOption { flags: string; description: string; }
export interface CommandDefinition {
  path: string;
  description: string;
  usage?: string;
  hidden?: boolean;
  options?: CommandOption[];
  register: (parent: Command, cwd: string, setResult: (result: CommandResult) => void, definition: CommandDefinition) => void;
}

const jsonOption = { flags: '--json', description: 'Print machine-readable JSON.' };
function configure(command: Command, definition: CommandDefinition): Command {
  command.description(definition.description);
  definition.options?.forEach((option) => command.option(option.flags, option.description));
  return command;
}
const componentDefinitions: CommandDefinition[] = [
  { path: 'component list', usage: '[--json] [--versions]', description: 'List installed components.', options: [jsonOption, { flags: '--versions', description: 'Show stable versions for each installed component.' }, { flags: '--available-versions', description: 'Deprecated alias for --versions.' }], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('list'), definition); command.action(async (options: { json?: boolean; versions?: boolean; availableVersions?: boolean }) => setResult(await listComponent(cwd, Boolean(options.json), Boolean(options.versions || options.availableVersions)))); } },
  { path: 'component info', usage: '[name] [--json]', description: 'Show an installed component.', options: [jsonOption], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('info [name]'), definition); command.action(async (name: string | undefined, options: { json?: boolean }) => setResult(await infoComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component add', usage: '<repository> [options]', description: 'Install a component from a GitHub repository.', options: [ { flags: '--version <version>', description: 'Install a specific version.' }, { flags: '--dry-run', description: 'Preview changes without writing files.' }, { flags: '--force', description: 'Overwrite an installed component.' }, jsonOption ], register: (parent, cwd, setResult, definition) => { const command = configure(parent.command('add [repositories...]'), definition); command.action(async (repositories: string[], options: { version?: string; dryRun?: boolean; force?: boolean; json?: boolean }) => setResult(await addComponent(cwd, repositories ?? [], { dryRun: Boolean(options.dryRun), force: Boolean(options.force), update: false, version: options.version, json: Boolean(options.json) }))); } },
  { path: 'component remove', usage: '[name] [--json]', description: 'Remove an installed component and its files.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('remove [name]').description('Remove an installed component and its files.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await removeComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component enable', usage: '[name] [--json]', description: 'Enable an installed component.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('enable [name]').description('Enable an installed component.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await enableComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component disable', usage: '[name] [--json]', description: 'Disable an installed component.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('disable [name]').description('Disable an installed component.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await disableComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component toggle', usage: '[name] [--json]', description: 'Toggle an installed component.', hidden: true, options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('toggle [name]', { hidden: true }); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await toggleComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component update', usage: '[name] [--json]', description: 'Update to the latest compatible version.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('update [name]').description('Update to the latest compatible version.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string | undefined, options: { json?: boolean }) => setResult(await updateComponent(cwd, name, Boolean(options.json)))); } },
  { path: 'component outdated', usage: '[--json]', description: 'Show available component updates.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('outdated').description('Show available component updates.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await outdatedComponents(cwd, Boolean(options.json)))); } },
  { path: 'component versions', usage: '<name> [--json]', description: 'Show available versions for a component.', options: [jsonOption], register: (parent, cwd, setResult) => { const command = parent.command('versions <name>').description('Show available versions for a component.'); command.option(jsonOption.flags, jsonOption.description).action(async (name: string, options: { json?: boolean }) => setResult(await componentVersions(cwd, name, Boolean(options.json)))); } },
];

export const commandDefinitions: CommandDefinition[] = [
  { path: 'component', description: 'Manage project components.', register: () => undefined },
  { path: 'help', usage: '[command...]', description: 'Show help for a command.', register: (program, _cwd, setResult) => { program.command('help [command...]').description('Show help for a command.').action((command: string[]) => setResult(help(command?.join(' ')))); } },
  { path: 'init', usage: '[--json]', description: 'Initialize a new UI project.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('init').description('Initialize a new UI project.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await initProject(cwd, Boolean(options.json)))); } },
  { path: 'update', description: 'Update UI Registry', register: (program, _cwd, setResult) => { program.command('update').description('Update UI Registry').action(async () => setResult(await selfUpdate())); } },
  { path: 'hooks', description: 'Manage project hooks.', register: (program, _cwd, setResult) => { program.command('hooks').description('Manage project hooks.').action(() => setResult({ output: frame('hooks', outcome('No hooks configured yet.', 'warning'), 'Next: ui component list'), exitCode: 0 })); } },
  { path: 'doctor', usage: '[--json]', description: 'Check project configuration.', options: [jsonOption], register: (program, cwd, setResult) => { const command = program.command('doctor').description('Check project configuration.'); command.option(jsonOption.flags, jsonOption.description).action(async (options: { json?: boolean }) => setResult(await doctor(cwd, Boolean(options.json)))); } },
  ...componentDefinitions,
];

/** Registers all visible and compatibility commands from the single metadata source. */
export function registerCommands(program: Command, cwd: string, setResult: (result: CommandResult) => void): void {
  program.command('self-update', { hidden: true }).action(async () => setResult(await selfUpdate()));
  program.command('components', { hidden: true }).action(async () => setResult(await listComponent(cwd, false)));
  const component = program.command('component').description('Manage installed components.').action(() => setResult(componentHelp()));
  componentDefinitions.forEach((definition) => definition.register(component, cwd, setResult, definition));
  commandDefinitions.filter((definition) => !definition.path.startsWith('component ')).forEach((definition) => definition.register(program, cwd, setResult, definition));
}

export function focusedDefinition(path: string): CommandDefinition | undefined {
  return commandDefinitions.find((definition) => definition.path === path || definition.path === `component ${path}`);
}
