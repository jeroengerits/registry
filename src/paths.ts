import path from 'node:path';

/** Normalizes and validates a path that must remain relative to the project. */
export function safeRelativePath(value: string, label: string): string {
  if (!value || path.isAbsolute(value) || value.includes('\0')) throw new Error(`${label} must be a safe relative path.`);
  // Normalize slash styles before checking traversal so Windows input is safe on every platform.
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error(`${label} must stay within the project.`);
  return normalized;
}

/** Resolves a validated project-relative path without permitting traversal. */
export function safeJoin(root: string, relative: string, label: string): string {
  const safe = safeRelativePath(relative, label);
  // Resolve both paths before comparing to account for relative roots.
  const result = path.resolve(root, safe);
  if (result !== path.resolve(root) && !result.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`${label} must stay within the project.`);
  return result;
}
