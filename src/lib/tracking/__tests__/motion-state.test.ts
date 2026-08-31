/**
 * Tests for the moving/stopped hysteresis helper (finding #5, 2026-08-21).
 *
 * Walking pace (0.5–1.3 m/s) used to straddle the bare `speed > 1` threshold,
 * so the driver status pill flickered every ping. The helper keeps vehicle
 * behaviour identical while damping the walk-test flicker.
 */

import {
  createMotionState,
  nextMotionState,
  MOTION_ENTER_MOVING_MPS,
  MOTION_LEAVE_MOVING_MPS,
  MOTION_CONSECUTIVE_SAMPLES,
} from '../motion-state';

/** Feed a speed sequence and return the isMoving value after each sample. */
function run(speeds: Array<number | null | undefined>, start = createMotionState()) {
  let state = start;
  return speeds.map((speed) => {
    state = nextMotionState(state, speed);
    return state.isMoving;
  });
}

describe('motion-state', () => {
  it('documents the thresholds in one place', () => {
    expect(MOTION_ENTER_MOVING_MPS).toBe(1.0);
    expect(MOTION_LEAVE_MOVING_MPS).toBe(0.5);
    expect(MOTION_CONSECUTIVE_SAMPLES).toBe(2);
  });

  it('starts stopped', () => {
    expect(createMotionState().isMoving).toBe(false);
  });

  describe('enter-moving threshold (from stopped)', () => {
    it.each([
      [0, false],
      [0.49, false],
      [0.5, false],
      [0.99, false],
      [1.0, true],
      [1.5, true],
      [5, true],
      [30, true],
    ])('two samples at %p m/s -> moving=%p', (speed, expected) => {
      expect(run([speed, speed]).at(-1)).toBe(expected);
    });
  });

  describe('leave-moving threshold (from moving)', () => {
    const moving = () => {
      let s = createMotionState();
      s = nextMotionState(s, 10);
      s = nextMotionState(s, 10);
      expect(s.isMoving).toBe(true);
      return s;
    };

    it.each([
      [0, false],
      [0.49, false],
      [0.5, true],
      [0.7, true],
      [0.99, true],
      [1.0, true],
      [5, true],
    ])('two samples at %p m/s -> moving=%p', (speed, expected) => {
      expect(run([speed, speed], moving()).at(-1)).toBe(expected);
    });
  });

  describe('consecutive-sample rule', () => {
    it('needs two qualifying samples to enter moving', () => {
      expect(run([5, 5, 5])).toEqual([false, true, true]);
    });

    it('needs two qualifying samples to leave moving', () => {
      expect(run([5, 5, 0, 0, 0])).toEqual([false, true, true, false, false]);
    });

    it('resets the streak when a non-qualifying sample interrupts it', () => {
      // 5, 0 (streak broken), 5, 5 -> flips only on the last sample
      expect(run([5, 0, 5, 5])).toEqual([false, false, false, true]);
    });

    it('resets the leave streak when the driver speeds up again', () => {
      const out = run([5, 5, 0, 3, 0, 0]);
      expect(out).toEqual([false, true, true, true, true, false]);
    });
  });

  describe('invalid speeds', () => {
    it.each([[null], [undefined], [-1], [Number.NaN]])(
      'treats %p as 0 m/s',
      (speed) => {
        // From stopped: stays stopped.
        expect(run([speed, speed]).at(-1)).toBe(false);
        // From moving: two such samples stop the driver.
        let s = createMotionState();
        s = nextMotionState(s, 10);
        s = nextMotionState(s, 10);
        expect(run([speed, speed], s).at(-1)).toBe(false);
      },
    );
  });

  it('does not flicker across a walking sequence', () => {
    // Finding #5: this sequence flipped 5 times with the bare `speed > 1` rule.
    const out = run([0.9, 1.1, 0.9, 1.2, 0.8, 0.4, 0.3]);
    const flips = out.filter((v, i) => i > 0 && v !== out[i - 1]).length;
    expect(flips).toBeLessThanOrEqual(1);
    expect(out.at(-1)).toBe(false);
  });

  it('does not mutate the previous state', () => {
    const prev = createMotionState();
    const snapshot = { ...prev };
    nextMotionState(prev, 5);
    expect(prev).toEqual(snapshot);
  });
});
