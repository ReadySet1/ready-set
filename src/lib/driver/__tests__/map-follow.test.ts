/**
 * @jest-environment jsdom
 */
import {
  FOLLOW_MIN_MOVE_M,
  INITIAL_FOLLOW_STATE,
  followReducer,
  isPositionJump,
  isUserCameraGesture,
  shouldFollowFix,
} from '../map-follow';

// ~1 m of latitude in degrees.
const M_LAT = 1 / 111_320;
const BASE = { lng: -122.4194, lat: 37.7749 };
const north = (meters: number) => ({ lng: BASE.lng, lat: BASE.lat + meters * M_LAT });

describe('followReducer', () => {
  it('starts in follow mode', () => {
    expect(INITIAL_FOLLOW_STATE).toEqual({ following: true });
  });

  it('pauses follow on a user gesture', () => {
    expect(followReducer({ following: true }, { type: 'userGesture' })).toEqual({ following: false });
  });

  it('resumes follow on recenter', () => {
    expect(followReducer({ following: false }, { type: 'recenter' })).toEqual({ following: true });
  });

  it('returns the same state object when nothing changes (no re-render)', () => {
    const paused = { following: false };
    expect(followReducer(paused, { type: 'userGesture' })).toBe(paused);
    const following = { following: true };
    expect(followReducer(following, { type: 'recenter' })).toBe(following);
  });
});

describe('shouldFollowFix', () => {
  it('follows the first fix when nothing has been followed yet', () => {
    expect(shouldFollowFix({ following: true, lastFollowed: null, fix: BASE })).toBe(true);
  });

  it('never moves the camera while follow is paused', () => {
    expect(shouldFollowFix({ following: false, lastFollowed: BASE, fix: north(500) })).toBe(false);
    expect(shouldFollowFix({ following: false, lastFollowed: null, fix: BASE })).toBe(false);
  });

  it('skips fixes within the jitter threshold', () => {
    expect(
      shouldFollowFix({ following: true, lastFollowed: BASE, fix: north(FOLLOW_MIN_MOVE_M - 2) }),
    ).toBe(false);
  });

  it('follows fixes past the jitter threshold', () => {
    expect(
      shouldFollowFix({ following: true, lastFollowed: BASE, fix: north(FOLLOW_MIN_MOVE_M + 3) }),
    ).toBe(true);
  });

  it('ignores invalid fixes ([0,0] fallback, NaN)', () => {
    expect(shouldFollowFix({ following: true, lastFollowed: BASE, fix: { lng: 0, lat: 0 } })).toBe(false);
    expect(shouldFollowFix({ following: true, lastFollowed: null, fix: { lng: NaN, lat: 37 } })).toBe(false);
  });
});

describe('isPositionJump', () => {
  it('is not a jump for normal driving between consecutive fixes', () => {
    expect(isPositionJump(BASE, north(800))).toBe(false);
  });

  it('is a jump when consecutive fixes are more than 10 km apart', () => {
    expect(isPositionJump(BASE, north(12_000))).toBe(true);
  });
});

describe('isUserCameraGesture', () => {
  it('treats moves without an originalEvent as programmatic (easeTo / fitBounds)', () => {
    expect(isUserCameraGesture({})).toBe(false);
    expect(isUserCameraGesture({ originalEvent: undefined })).toBe(false);
    expect(isUserCameraGesture(null)).toBe(false);
  });

  it('treats touch / mouse gestures on the map as user gestures', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const ev = new Event('touchstart');
    Object.defineProperty(ev, 'target', { value: canvas });
    expect(isUserCameraGesture({ originalEvent: ev })).toBe(true);
    canvas.remove();
  });

  it('ignores the zoom / compass buttons (they keep the driver centered)', () => {
    const ctrl = document.createElement('div');
    ctrl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    const button = document.createElement('button');
    button.className = 'mapboxgl-ctrl-zoom-in';
    ctrl.appendChild(button);
    document.body.appendChild(ctrl);
    const ev = new Event('click');
    Object.defineProperty(ev, 'target', { value: button });
    expect(isUserCameraGesture({ originalEvent: ev })).toBe(false);
    ctrl.remove();
  });
});
