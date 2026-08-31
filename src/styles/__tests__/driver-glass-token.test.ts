import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The driver app paints every fixed/sticky bar with `bg-driver-glass` plus
 * `backdrop-blur-xl`. On iOS Safari 16.x `backdrop-filter` silently no-ops
 * inside some stacking contexts, and then the only thing separating the bar
 * from the content scrolling beneath it is the token's alpha channel.
 *
 * The 2026-08-06 field run hit exactly that: at alpha 0.82 the bottom nav let
 * a delivery card's "NEXT STEP" button read straight through it, which the
 * tester reported as a rendering bug.
 *
 * Keep the bars legible without the blur.
 */
const MIN_ALPHA = 0.93;

const CSS = readFileSync(path.join(process.cwd(), 'src/styles/index.css'), 'utf8');

function glassAlphas(): number[] {
  const matches = [...CSS.matchAll(/--rs-driver-glass:\s*rgba\([^)]*?,\s*([\d.]+)\s*\)/g)];
  return matches.map((m) => Number(m[1]));
}

describe('--rs-driver-glass', () => {
  it('is defined for both the light and dark themes', () => {
    expect(glassAlphas()).toHaveLength(2);
  });

  it('stays opaque enough to hide content when backdrop-filter does not apply', () => {
    for (const alpha of glassAlphas()) {
      expect(alpha).toBeGreaterThanOrEqual(MIN_ALPHA);
    }
  });

  it('keeps a trace of translucency so the blur still reads where it is supported', () => {
    for (const alpha of glassAlphas()) {
      expect(alpha).toBeLessThan(1);
    }
  });
});
