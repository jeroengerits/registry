import { readFile } from 'node:fs/promises';
import type { CommandResult } from '../../types.js';
import { frame } from '../ui.js';
import { failure, present } from '../presentation.js';

export interface ChangelogEntry {
  version: string;
  changes: string[];
}

const changelogFile = new URL('../../../CHANGELOG.md', import.meta.url);

/** Parses version sections from the checked-in Markdown changelog. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  return markdown.split(/^##\s+/m).slice(1).map((section) => {
    const [heading, ...body] = section.split('\n');
    return {
      version: heading.trim().replace(/^v/, ''),
      changes: body.map((line) => line.trim()).filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim()),
    };
  });
}

/** Reads all changelog entries or one requested version. */
export async function changelog(version?: string, json = false): Promise<CommandResult> {
  let entries: ChangelogEntry[];
  try {
    entries = parseChangelog(await readFile(changelogFile, 'utf8'));
  } catch {
    return failure(json, 'Unable to read the changelog.', 'changelog_unavailable');
  }
  if (version) {
    const normalized = version.replace(/^v/, '');
    const entry = entries.find((candidate) => candidate.version === normalized);
    if (!entry) return failure(json, `No changelog entry found for v${normalized}.`, 'changelog_not_found', 2);
    return present(json, entry, frame(`changelog  /  v${entry.version}`, entry.changes.map((change) => `- ${change}`).join('\n')));
  }
  const body = entries.map((entry) => [`v${entry.version}`, ...entry.changes.map((change) => `  - ${change}`)].join('\n')).join('\n\n');
  return present(json, { entries }, frame('changelog', body));
}
