/** Shared runtime narrowing and error-formatting helpers. */

/** Narrows unknown JSON values and caught errors to property-bearing objects. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows filesystem failures without asserting an arbitrary error shape. */
export function isErrnoError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/** Returns the most useful stable message for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Maps values with bounded concurrency while preserving input order. */
export async function mapConcurrent<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), values.length) }, worker));
  return results;
}
