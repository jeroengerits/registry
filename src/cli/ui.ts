import ora from 'ora';
import pc from 'picocolors';
import { isCancel, select } from '@clack/prompts';

export function interactive(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY && !process.env.CI);
}

export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled = true): Promise<T> {
  if (!enabled || !interactive()) return action();
  const progress = ora(message);
  progress.start(message);
  try {
    const value = await action();
    progress.succeed(success(value));
    return value;
  } catch (error) {
    progress.fail('Failed');
    throw error;
  }
}

export const colors = {
  info: pc.cyan,
  muted: pc.dim,
  success: pc.green,
  error: pc.red,
};

export async function chooseVersion(component: string, versions: string[]): Promise<string> {
  const choice = await select({
    message: `Choose a version for ${component}`,
    options: versions.map((version, index) => ({ value: version, label: version, hint: index === 0 ? 'latest' : undefined })),
    initialValue: versions[0],
  });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}

export async function chooseComponent(names: string[], message: string): Promise<string> {
  const choice = await select({
    message,
    options: names.map((name) => ({ value: name, label: name })),
  });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}
