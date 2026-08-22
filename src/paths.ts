import path from 'node:path';

export function safeRelativePath(value: string, label: string): string {
  if (!value || path.isAbsolute(value) || value.includes('\0')) throw new Error(`${label} must be a safe relative path.`);
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error(`${label} must stay within the project.`);
  return normalized;
}

export function safeJoin(root: string, relative: string, label: string): string {
  const safe = safeRelativePath(relative, label);
  const result = path.resolve(root, safe);
  if (result !== path.resolve(root) && !result.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`${label} must stay within the project.`);
  return result;
}
