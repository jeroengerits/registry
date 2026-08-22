import process from 'node:process';
import { addComponents, createComponent, doctor, generateManifestCommand, infoComponent, listComponents, removeComponent, updateComponent, validateManifestCommand } from './commands.js';

export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json'); const positional = args.filter((arg) => !arg.startsWith('--')); let result;
  try {
    if ((positional[0] === 'components' || positional[0] === 'hooks') && positional[1] === 'list') result = await listComponents(cwd, json);
    else if (positional[0] === 'components' && positional[1] === 'create') result = await createComponent(cwd, positional[2], json);
    else if (positional[0] === 'components' && positional[1] === 'info') result = await infoComponent(cwd, positional[2], json);
    else if (positional[0] === 'manifest' && (positional[1] === 'validate' || positional[1] === 'check')) result = await validateManifestCommand(positional[2]);
    else if (positional[0] === 'manifest' && positional[1] === 'generate') result = await generateManifestCommand(positional[2], positional[3]);
    else if (positional[0] === 'doctor') result = await doctor(cwd);
    else if (positional[0] === 'add') result = await addComponents(cwd, positional.slice(1), { dryRun: args.includes('--dry-run'), yes: args.includes('--yes'), json });
    else if (positional[0] === 'remove') result = await removeComponent(cwd, positional[1], args.includes('--overwrite'));
    else if (positional[0] === 'update') result = await updateComponent(cwd, positional[1], args.includes('--overwrite'));
    else result = { output: 'Usage: ui components list|create|info, ui hooks list, ui add, ui update, ui remove, ui doctor, ui manifest validate|generate\n', exitCode: 1 };
    process.stdout.write(result.output); return result.exitCode;
  } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); return 1; }
}
if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
