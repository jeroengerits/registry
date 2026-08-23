#!/usr/bin/env node

import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(process.env.INIT_CWD ?? process.cwd());
const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const stateFile = path.join(project, 'ui.json');
const cli = new URL('../dist/cli/index.js', import.meta.url);

if (project === packageRoot) process.exit(0);

try {
  await access(stateFile);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  try {
    const { run } = await import(cli.href);
    const code = await run(['--project', project, '--quiet', 'init']);
    if (code !== 0) process.exitCode = code;
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
}
