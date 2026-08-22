/**
 * Moving/stopped hysteresis for driver location pings.
 *
 * A bare `speed > 1 m/s` check flickers at walking pace (0.5–1.3 m/s), which
 * made the admin Driver Status pill alternate STOPPED/MOVING every ping during
 * walk-tests (2026-08-21 finding #5). This pure state machine adds two kinds of
 * damping while leaving vehicle behaviour unchanged:
 *
 * - Hysteresis: enter "moving" at >= MOTION_ENTER_MOVING_MPS, but only leave
 *   it once speed drops below MOTION_LEAVE_MOVING_MPS.
 * - Debounce: a flip in either direction needs MOTION_CONSECUTIVE_SAMPLES
 *   consecutive qualifying samples; a non-qualifying sample resets the streak.
 *
 * Both call sites (web `useLocationTracking` and the Capacitor background
 * bridge) hold one state instance per tracking session and feed every fix
 * through `nextMotionState`.
 */

/** Speed (m/s) at or above which a stopped driver may become "moving". */
export const MOTION_ENTER_MOVING_MPS = 1.0;

/** Speed (m/s) below which a moving driver may become "stopped". */
export const MOTION_LEAVE_MOVING_MPS = 0.5;

/** Consecutive qualifying samples required before `isMoving` flips. */
export const MOTION_CONSECUTIVE_SAMPLES = 2;

export interface MotionState {
  /** Current debounced verdict. */
  readonly isMoving: boolean;
  /** Consecutive samples so far that argue for flipping `isMoving`. */
  readonly pendingFlipSamples: number;
}

/** Fresh state for a new tracking session: stopped, no pending streak. */
export function createMotionState(): MotionState {
  return { isMoving: false, pendingFlipSamples: 0 };
}

/**
 * Normalise a raw GPS speed: null/undefined/NaN/negative all count as 0 m/s.
 * (Geolocation reports `null` when speed is unknown; some platforms send -1.)
 */
function normaliseSpeed(speedMps: number | null | undefined): number {
  if (typeof speedMps !== 'number' || !Number.isFinite(speedMps) || speedMps < 0) {
    return 0;
  }
  return speedMps;
}

/** Advance the state with one speed sample. Never mutates `prev`. */
export function nextMotionState(
  prev: MotionState,
  speedMps: number | null | undefined,
): MotionState {
  const speed = normaliseSpeed(speedMps);

  const wantsFlip = prev.isMoving
    ? speed < MOTION_LEAVE_MOVING_MPS
    : speed >= MOTION_ENTER_MOVING_MPS;

  if (!wantsFlip) {
    return prev.pendingFlipSamples === 0 ? prev : { ...prev, pendingFlipSamples: 0 };
  }

  const pendingFlipSamples = prev.pendingFlipSamples + 1;
  if (pendingFlipSamples >= MOTION_CONSECUTIVE_SAMPLES) {
    return { isMoving: !prev.isMoving, pendingFlipSamples: 0 };
  }
  return { isMoving: prev.isMoving, pendingFlipSamples };
}
