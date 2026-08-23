import ora from 'ora';
import pc from 'picocolors';
import Table from 'cli-table3';
import { confirm, isCancel, select } from '@clack/prompts';

/** Returns true when interactive prompts and terminal styling are safe. */
export function interactive(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY && !process.env.CI && !process.env.UI_NO_INPUT);
}

/** Runs a slow task with a delayed spinner and concise completion message. */
export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled = true): Promise<T> {
  if (!enabled || process.env.UI_QUIET || !interactive()) return action();
  const progress = ora(message);
  let started = false;
  // Delay the spinner so fast operations stay silent.
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

/** Applies color only when the current output policy allows terminal styling. */
function paint(format: (value: string) => string, value: string): string {
  if (process.env.CI || process.env.NO_COLOR || process.env.FORCE_COLOR === '0' || (!process.stdout.isTTY && process.env.FORCE_COLOR !== '1')) return value;
  return format(value);
}

/** Semantic terminal colors shared by every human-readable command. */
export const colors = {
  info: (value: string) => paint(pc.cyan, value),
  muted: (value: string) => paint(pc.dim, value),
  success: (value: string) => paint(pc.green, value),
  warning: (value: string) => paint(pc.yellow, value),
  error: (value: string) => paint(pc.red, value),
};

/** Wraps command content in the shared relaxed CLI layout. */
export function frame(_command: string, body: string, _footer?: string): string {
  // Normal output is deliberately data-first; help remains the place for branding and guidance.
  void _footer;
  return `${body.trimEnd()}\n`;
}

/** Renders aligned terminal data while preserving colored cell content. */
export function table(headers: string[], rows: string[][]): string {
  // Keep table styling centralized so commands only provide data.
  const result = new Table({ head: headers.map(colors.muted), style: { head: [], border: [] } });
  result.push(...rows);
  return result.toString();
}

/** Renders the canonical enabled state label used by every command. */
export function status(enabled: boolean): string {
  return enabled ? colors.success('enabled') : colors.muted('disabled');
}

/** Renders a short, verb-first result line shared by mutations and checks. */
export function resultLine(action: string, detail: string): string {
  return `${colors.success(action)} ${detail}\n`;
}

/** Renders a quiet informational line for empty or unchanged results. */
export function infoLine(message: string): string {
  return `${colors.muted(message)}\n`;
}

/** Renders a semantic outcome for compatibility with composed command output. */
export function outcome(message: string, kind: 'success' | 'warning' | 'error' = 'success'): string {
  const paint = kind === 'success' ? colors.success : kind === 'warning' ? colors.warning : colors.error;
  return paint(message);
}

/** Lets an interactive user select a stable component version. */
export async function chooseVersion(component: string, versions: string[]): Promise<string> {
  const choice = await select({
    message: `Choose a version for ${component}`,
    options: versions.map((version, index) => ({ value: version, label: version, hint: index === 0 ? 'latest' : undefined })),
    initialValue: versions[0],
  });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}

/** Confirms a potentially destructive action and handles cancellation. */
export async function confirmAction(message: string, initialValue = false): Promise<boolean> {
  const choice = await confirm({ message, initialValue });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}
