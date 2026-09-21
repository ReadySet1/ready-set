// src/lib/chunk-load-recovery.ts
import { getRecoveryStrategy, type RecoveryOptions } from "./error-recovery";

/**
 * Session-scoped flag recording that we already auto-reloaded once for a chunk
 * load failure. Scoped to the tab (sessionStorage) so a genuinely broken deploy
 * shows the fallback UI instead of reload-looping the browser.
 */
export const CHUNK_RELOAD_SESSION_KEY = "readyset:chunk-reload-attempted";

/**
 * Webpack/Next.js emit chunk failures in a couple of shapes:
 *   - `error.name === 'ChunkLoadError'` (the common case)
 *   - `Loading chunk <id> failed. (timeout: <url>)`  — the 120s load timeout
 *   - `Loading chunk <id> failed. (error: <url>)`    — a genuine 404 after a deploy
 *   - `Loading CSS chunk <id> failed.`
 */
const CHUNK_MESSAGE_PATTERNS: RegExp[] = [
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /Loading CSS chunk .* failed/i,
];

/**
 * True when the error is a code-splitting load failure, i.e. the browser is
 * holding a page whose JS chunks no longer resolve. A reload fixes it; nothing
 * inside the React tree can.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { name, message } = error as { name?: unknown; message?: unknown };

  if (typeof name === "string" && name === "ChunkLoadError") return true;
  if (typeof message !== "string") return false;

  return CHUNK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/** Whether this tab already spent its single automatic reload. */
export function hasAttemptedChunkReload(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY) === "1";
  } catch {
    // Private mode / storage blocked: treat as "already attempted" is wrong
    // (we would never recover), but so is looping. Callers pair this with
    // markChunkReloadAttempted(), which fails closed.
    return false;
  }
}

/**
 * Record the automatic reload. Returns false when the flag could not be
 * persisted — the caller must then NOT reload, because without the flag the
 * reload could repeat forever.
 */
export function markChunkReloadAttempted(): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** The recovery options for this error, for feeding the fallback UI. */
export function getChunkRecoveryStrategy(error: Error): RecoveryOptions {
  return getRecoveryStrategy(error, "chunk-load");
}

/**
 * Attempt the one automatic recovery this tab is allowed: clear caches and
 * reload. Returns true when the reload was triggered, false when the error is
 * not a chunk failure or the single attempt is already spent (in which case the
 * caller should render ChunkLoadErrorFallback and let the user decide).
 */
export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  if (typeof window === "undefined") return false;
  if (hasAttemptedChunkReload()) return false;

  const strategy = getChunkRecoveryStrategy(error as Error);
  if (!strategy.fallbackAction) return false;

  // Fail closed: without a persisted flag the reload could repeat forever.
  if (!markChunkReloadAttempted()) return false;

  strategy.fallbackAction();
  return true;
}
