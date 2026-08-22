import ora from 'ora';
import pc from 'picocolors';

function interactive(): boolean {
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
