import ora from 'ora';
import pc from 'picocolors';
import { confirm, isCancel, select } from '@clack/prompts';

export function interactive(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY && !process.env.CI);
}

export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled = true): Promise<T> {
  if (!enabled || !interactive()) return action();
  const progress = ora(message);
  let started = false;
  const timer = setTimeout(() => { progress.start(message); started = true; }, 150);
  try {
    const value = await action();
    clearTimeout(timer);
    if (started) progress.succeed(success(value));
    return value;
  } catch (error) {
    clearTimeout(timer);
    if (started) progress.fail('Failed');
    throw error;
  }
}

export const colors = {
  info: pc.cyan,
  muted: pc.dim,
  success: pc.green,
  error: pc.red,
};

export function frame(command: string, body: string, footer?: string): string {
  const lines = [colors.info(`◆ UI REGISTRY  ·  ${command}`), colors.muted('────────────────────────────────────────'), body.trimEnd()];
  if (footer) lines.push('', colors.muted(footer));
  return `${lines.join('\n')}\n`;
}

export function status(enabled: boolean): string {
  return enabled ? colors.success('● enabled') : colors.muted('○ disabled');
}

export function outcome(message: string, kind: 'success' | 'warning' | 'error' = 'success'): string {
  const symbol = kind === 'success' ? '✓' : kind === 'warning' ? '!' : '×';
  const color = kind === 'success' ? colors.success : kind === 'warning' ? pc.yellow : colors.error;
  return color(`${symbol} ${message}`);
}

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

export async function confirmAction(message: string): Promise<boolean> {
  const choice = await confirm({ message, initialValue: false });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}
