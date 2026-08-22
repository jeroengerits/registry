import process from 'node:process';
import { addComponent, help, infoComponent, listComponent, removeComponent, selfUpdate } from './commands.js';

export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json'); const positional = args.filter((arg) => !arg.startsWith('--')); let result;
  try {
    if (positional[0] === 'help' || positional.length === 0) result = help();
    else if (positional[0] === 'self-update') result = await selfUpdate();
    else if (positional[0] === 'component' && positional[1] === 'list') result = await listComponent(cwd, json);
    else if (positional[0] === 'component' && positional[1] === 'info') result = await infoComponent(cwd, positional[2], json);
    else if (positional[0] === 'component' && positional[1] === 'add') result = await addComponent(cwd, positional.slice(2), { dryRun: args.includes('--dry-run'), force: args.includes('--force'), json });
    else if (positional[0] === 'component' && positional[1] === 'remove') result = await removeComponent(cwd, positional[2], json);
    else result = { output: 'Unknown command. Run "ui help" for available commands.\n', exitCode: 1 };
    process.stdout.write(result.output); return result.exitCode;
  } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); return 1; }
}
if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
