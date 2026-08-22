import process from 'node:process';
import { addComponent, help, infoComponent, listComponent, removeComponent, selfUpdate, updateComponent } from './commands.js';

export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json'); const versionIndex = args.indexOf('--version'); const version = versionIndex > -1 ? args[versionIndex + 1] : undefined; const positional = args.filter((arg, index) => !arg.startsWith('--') && !(versionIndex > -1 && index === versionIndex + 1)); let result;
  try {
    if (positional[0] === 'help' || positional.length === 0) result = help();
    else if (positional[0] === 'self-update') result = await selfUpdate();
    else if (positional[0] === 'component' && positional[1] === 'list') result = await listComponent(cwd, json, args.includes('--available-versions'));
    else if (positional[0] === 'component' && positional[1] === 'info') result = await infoComponent(cwd, positional[2], json);
    else if (positional[0] === 'component' && positional[1] === 'add') result = versionIndex > -1 && !version ? { output: 'The --version option requires a value.\n', exitCode: 1 } : await addComponent(cwd, positional.slice(2), { dryRun: args.includes('--dry-run'), force: args.includes('--force'), update: false, version, json });
    else if (positional[0] === 'component' && positional[1] === 'remove') result = await removeComponent(cwd, positional[2], json);
    else if (positional[0] === 'component' && positional[1] === 'update') result = await updateComponent(cwd, positional[2], json);
    else result = { output: 'Unknown command. Run "ui help" for available commands.\n', exitCode: 1 };
    process.stdout.write(result.output); return result.exitCode;
  } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); return 1; }
}
if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
