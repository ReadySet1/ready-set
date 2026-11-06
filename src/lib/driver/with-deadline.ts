/**
 * Bound an async driver operation so a hung request can never leave a
 * spinner running forever.
 *
 * 2026-10 field failure (iPhone X, iOS 16.7 Safari): "Start shift" spun until
 * the page was reloaded because the session read and shift fetches had no
 * timeout. `work` receives an AbortSignal to hand to fetch(); the deadline also
 * races the whole operation, so steps that ignore the signal (e.g. the
 * Supabase session read) are cut off too.
 */
export class DeadlineExceededError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'DeadlineExceededError';
  }
}

export async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DeadlineExceededError(ms));
      controller.abort();
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
