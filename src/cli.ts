import process from 'node:process';
import { doctor, infoComponent, listComponents, validateManifestCommand } from './commands.js';

export async function run(args: string[], cwd = process.cwd()): Promise<number> {
  const json = args.includes('--json');
  const positional = args.filter((arg) => arg !== '--json');
  let result;
  try {
    if ((positional[0] === 'components' || positional[0] === 'hooks') && positional[1] === 'list') result = await listComponents(cwd, json);
    else if (positional[0] === 'components' && positional[1] === 'info') result = await infoComponent(cwd, positional[2], json);
    else if (positional[0] === 'manifest' && positional[1] === 'validate') result = await validateManifestCommand(positional[2]);
    else if (positional[0] === 'doctor') result = await doctor(cwd);
    else if (positional[0] === 'add') result = { output: 'Remote installation is not implemented in this MVP.\n', exitCode: 1 };
    else result = { output: 'Usage: ui components list [--json]\n       ui hooks list [--json]\n       ui components info <name> [--json]\n       ui manifest validate <file>\n       ui doctor\n       ui add <component>\n', exitCode: 1 };
    process.stdout.write(result.output);
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
