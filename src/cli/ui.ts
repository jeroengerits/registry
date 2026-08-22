import { spinner } from '@clack/prompts';

function interactive(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY && !process.env.CI);
}

export async function withSpinner<T>(message: string, action: () => Promise<T>, success: (value: T) => string, enabled = true): Promise<T> {
  if (!enabled || !interactive()) return action();
  const progress = spinner();
  progress.start(message);
  try {
    const value = await action();
    progress.stop(success(value));
    return value;
  } catch (error) {
    progress.stop('Failed');
    throw error;
  }
}
