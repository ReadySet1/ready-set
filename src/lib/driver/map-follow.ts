/**
 * Waze-style follow mode for the driver live map (2026-10-14 field report:
 * the marker drove off-screen because the camera only re-centered on the
 * first fix or a >10 km jump).
 *
 * Pure logic only — no Mapbox — so it can be unit tested:
 * - followReducer: follow ON by default, paused by a user gesture, resumed by
 *   the Recenter button.
 * - shouldFollowFix: whether a new GPS fix should move the camera.
 * - isPositionJump: consecutive-fix teleport detection (mock-location
 *   simulator, wrapper resume after a long background stretch).
 * - isUserCameraGesture: tells a hand gesture apart from programmatic camera
 *   moves (easeTo / flyTo / fitBounds).
 */

import { distanceToTargetM, isValidTarget } from '@/lib/driver/geofence';

/** Fixes closer than this to the last followed center don't move the camera
 *  (GPS jitter while stopped would otherwise make the map shimmy). Internal
 *  threshold — never shown to the driver. */
export const FOLLOW_MIN_MOVE_M = 5;

/** Short ease so the camera glides between fixes without lagging behind. */
export const FOLLOW_EASE_DURATION_MS = 600;

/** Consecutive fixes farther apart than this are treated as a teleport. */
export const POSITION_JUMP_THRESHOLD_M = 10_000;

export interface FollowState {
  following: boolean;
}

export type FollowAction = { type: 'userGesture' } | { type: 'recenter' };

export const INITIAL_FOLLOW_STATE: FollowState = { following: true };

/** Returns the SAME object when nothing changes, so callers can skip a
 *  re-render on repeated gesture events. */
export function followReducer(state: FollowState, action: FollowAction): FollowState {
  switch (action.type) {
    case 'userGesture':
      return state.following ? { following: false } : state;
    case 'recenter':
      return state.following ? state : { following: true };
    default:
      return state;
  }
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

const isValidPoint = (p: LngLatPoint | null | undefined): p is LngLatPoint =>
  !!p && isValidTarget([p.lng, p.lat]);

export function shouldFollowFix({
  following,
  lastFollowed,
  fix,
  minMoveM = FOLLOW_MIN_MOVE_M,
}: {
  following: boolean;
  lastFollowed: LngLatPoint | null;
  fix: LngLatPoint;
  minMoveM?: number;
}): boolean {
  if (!following || !isValidPoint(fix)) return false;
  if (!isValidPoint(lastFollowed)) return true;
  const movedM = distanceToTargetM(lastFollowed, [fix.lng, fix.lat]);
  return movedM === null || movedM >= minMoveM;
}

/** True when two consecutive fixes are implausibly far apart. Compared
 *  fix-to-fix (not against the first centered point) so a long normal drive
 *  never counts as a jump. */
export function isPositionJump(
  previous: LngLatPoint,
  fix: LngLatPoint,
  thresholdM: number = POSITION_JUMP_THRESHOLD_M,
): boolean {
  const movedM = distanceToTargetM(previous, [fix.lng, fix.lat]);
  return movedM !== null && movedM > thresholdM;
}

/** Mapbox camera events carry `originalEvent` only when a DOM input event
 *  (touch, mouse, wheel, key) caused them; easeTo / flyTo / fitBounds fire
 *  them without one. The built-in zoom / compass buttons also attach their
 *  click, but they zoom about the center (the driver stays in view), so they
 *  don't count as "the driver took over the camera". */
export function isUserCameraGesture(event: unknown): boolean {
  // `unknown`: mapbox-gl's typings for these events don't declare
  // originalEvent even though the runtime sets it on gesture-driven moves.
  const original =
    event && typeof event === 'object' && 'originalEvent' in event
      ? (event as { originalEvent?: Event | null }).originalEvent
      : undefined;
  if (!original) return false;
  const target = original.target as Element | null | undefined;
  if (target && typeof target.closest === 'function' && target.closest('.mapboxgl-ctrl')) {
    return false;
  }
  return true;
}
