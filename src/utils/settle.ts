/**
 * Start a promise early, read its outcome later.
 *
 * Latency helper: lets a handler issue an independent query before it knows
 * whether it will need the result, without an unhandled rejection when it
 * returns early, and with the original error rethrown (via `unwrap`) at the
 * point where the result is actually consumed.
 */
export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

export function settle<T>(promise: PromiseLike<T>): Promise<Settled<T>> {
  return Promise.resolve(promise).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
}

export function unwrap<T>(result: Settled<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}
