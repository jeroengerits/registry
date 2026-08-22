import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult } from '../types.js';
import { safeJoin } from '../paths.js';
import { errorResult } from './shared.js';

export async function createComponent(cwd: string, name: string | undefined, json: boolean): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui components create <name> [--json]');
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) return errorResult('Component name must be a lowercase kebab-case name, such as "date-picker".');
  const directory = safeJoin(cwd, path.join('components', name), 'component directory');
  try { await access(directory); return errorResult(`Component directory already exists: ${path.relative(cwd, directory)}`); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({ name, version: '0.1.0', private: true, type: 'module' }, null, 2)}\n`, 'utf8');
  const componentName = name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  const source = `import type { ReactNode } from 'react';\n\nexport interface ${componentName}Props {\n  children?: ReactNode;\n}\n\nexport function ${componentName}({ children }: ${componentName}Props) {\n  return <div>{children}</div>;\n}\n`;
  await writeFile(path.join(directory, 'components.json'), `${JSON.stringify({ schemaVersion: 1, name, files: [{ source: `src/${name}.tsx`, target: `components/${name}.tsx` }], dependencies: {}, components: [] }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(directory, 'src', `${name}.tsx`), source, 'utf8');
  const result = { name, directory: path.relative(cwd, directory), files: ['package.json', 'components.json', `src/${name}.tsx`] };
  return { output: json ? `${JSON.stringify(result, null, 2)}\n` : `Created ${result.directory}\n`, exitCode: 0 };
}
