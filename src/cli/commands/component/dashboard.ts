import process from 'node:process';
import { readState } from '../../../state.js';
import type { CommandResult } from '../../../types.js';
import { addComponent } from './add.js';
import { infoComponent } from './info.js';
import { listComponent } from './list.js';
import { removeComponent } from './remove.js';
import { toggleComponent } from './toggle.js';
import { updateComponent } from './update.js';
import { chooseComponent, chooseComponentAction, chooseComponentCommand, promptRepository } from '../../ui.js';

/** Runs the interactive component dashboard without changing script commands. */
export async function componentDashboard(cwd: string): Promise<CommandResult> {
  await show(listComponent(cwd, false));
  while (true) {
    const command = await chooseComponentCommand();
    if (command === 'quit') return { output: '', exitCode: 0 };
    if (command === 'list') { await show(listComponent(cwd, false)); continue; }
    if (command === 'add') { await show(addComponent(cwd, [await promptRepository()], { dryRun: false, force: false, update: false, json: false })); continue; }
    if (command === 'update') {
      const name = await chooseInstalledComponent(cwd, 'Select a component to update');
      if (name) await show(updateComponent(cwd, name));
      continue;
    }
    if (command === 'remove') { await show(removeComponent(cwd)); continue; }
    await componentDetails(cwd);
  }
}

/** Runs contextual actions for one selected component. */
async function componentDetails(cwd: string): Promise<void> {
  const name = await chooseInstalledComponent(cwd, 'Select a component');
  if (!name) return;
  while (true) {
    await show(infoComponent(cwd, name));
    const enabled = Boolean((await readState(cwd))?.components[name]?.enabled);
    const action = await chooseComponentAction(name, enabled);
    if (action === 'back') return;
    if (action === 'toggle') await show(toggleComponent(cwd, name));
    if (action === 'update') await show(updateComponent(cwd, name));
    if (action === 'remove') { await show(removeComponent(cwd, name)); return; }
  }
}

/** Selects an installed component or explains how to get started. */
async function chooseInstalledComponent(cwd: string, message: string): Promise<string | undefined> {
  const state = await readState(cwd);
  const names = Object.keys(state?.components ?? {}).sort();
  if (!names.length) { process.stdout.write('No installed components. Add one to get started.\n'); return undefined; }
  return chooseComponent(names, message);
}

/** Writes one command frame after its operation completes. */
async function show(result: Promise<CommandResult>): Promise<void> {
  const output = await result;
  process.stdout.write(output.output);
}
