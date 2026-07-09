import { after } from 'next/server';

/**
 * Run best-effort work *after* the response is sent — reliably.
 *
 * On Vercel the serverless function is frozen once the response returns, so a
 * bare `fn().catch()` started during the request is dropped intermittently
 * (observed live: ~half of the driver-PATCH partner-webhook emits, and by the
 * same mechanism the realtime broadcast + status notifications, were silently
 * lost). `after()` keeps the function alive until the work finishes, without
 * blocking the response. `after()` throws outside a request scope (e.g. a unit
 * test calling a route handler directly), so fall back to running inline there.
 */
export function runAfterResponse(label: string, work: () => Promise<unknown>): void {
  // `work` is always an async fn / promise-returning thunk, so it never throws
  // synchronously — `.catch` captures every rejection.
  const safe = () => work().catch((err) => console.error(label, err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
