import ora from 'ora';
import pc from 'picocolors';
import Table from 'cli-table3';
import { confirm, isCancel, select } from '@clack/prompts';

/** Returns true when interactive prompts and terminal styling are safe. */
export function interactive(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY && !process.env.CI);
}

/** Runs a slow task with a delayed spinner and concise completion message. */
export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled = true): Promise<T> {
  if (!enabled || !interactive()) return action();
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

/** Semantic terminal colors shared by every human-readable command. */
const color = process.env.CI || process.env.NO_COLOR ? (value: string): string => value : undefined;
export const colors = {
  info: color ?? pc.cyan,
  muted: color ?? pc.dim,
  success: color ?? pc.green,
  warning: color ?? pc.yellow,
  error: color ?? pc.red,
};

/** Wraps command content in the shared relaxed CLI layout. */
export function frame(command: string, body: string, footer?: string): string {
  const lines = [colors.info(`UI Registry  /  ${command}`), '', body.trimEnd()];
  if (footer) lines.push('', colors.muted(footer));
  return `${lines.join('\n')}\n`;
}

/** Renders aligned terminal data while preserving colored cell content. */
export function table(headers: string[], rows: string[][]): string {
  // Keep table styling centralized so commands only provide data.
  const result = new Table({ head: headers.map(colors.muted), style: { head: [], border: [] } });
  result.push(...rows);
  return result.toString();
}

/** Renders enabled state with both a symbol and a text label. */
export function status(enabled: boolean): string {
  return enabled ? colors.success('● enabled') : colors.muted('○ disabled');
}

/** Renders a semantic success, warning, or error outcome. */
export function outcome(message: string, kind: 'success' | 'warning' | 'error' = 'success'): string {
  const symbol = kind === 'success' ? '✓' : kind === 'warning' ? '!' : '×';
  const paint = kind === 'success' ? colors.success : kind === 'warning' ? colors.warning : colors.error;
  return paint(`${symbol} ${message}`);
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
export async function confirmAction(message: string): Promise<boolean> {
  const choice = await confirm({ message, initialValue: false });
  if (isCancel(choice)) throw new Error('Operation cancelled.');
  return choice;
}
