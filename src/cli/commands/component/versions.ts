import type { CommandResult } from '../../../types.js';
import { createVersionLookup } from '../../../git.js';
import { readState } from '../../../state.js';
import { colors, frame, table } from '../../ui.js';
import { errorResult } from '../shared.js';
import { present } from '../../presentation.js';

/** Lists stable versions for one installed component. */
export async function componentVersions(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui versions <name> [--json]', json);
  const component = (await readState(cwd))?.components[name];
  if (!component?.repository) return errorResult(`Component "${name}" is not installed or has no repository reference.`, json);
  const versions = await createVersionLookup()(component.repository);
  if (json) return present(true, { name, installed: component.version, versions }, '');
  const rows = versions.map((version) => [version, version === versions[0] ? colors.success('latest') : version === component.version ? colors.info('installed') : '']);
  return { output: frame(`component versions  /  ${name}`, table(['Version', 'Status'], rows)), exitCode: 0 };
}
