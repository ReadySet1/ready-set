import {
  computeView,
  fromView,
  growFrame,
  toView,
  type StrokeGroup,
} from "../signature-geometry";

// A signature_pad v5 point group.
const group = (
  points: Array<{ x: number; y: number }>,
  widths = { minWidth: 0.8, maxWidth: 2.4, dotSize: 0 },
): StrokeGroup => ({
  penColor: "#15202e",
  compositeOperation: "source-over",
  velocityFilterWeight: 0.7,
  ...widths,
  points: points.map((p, i) => ({ ...p, time: 1000 + i * 10, pressure: 0.5 })),
});

// "Bob" drawn on the inline pad (340×192 CSS px).
const BOB = [
  group([
    { x: 60, y: 40 },
    { x: 60, y: 150 },
  ]),
  group([
    { x: 60, y: 40 },
    { x: 110, y: 55 },
    { x: 60, y: 95 },
    { x: 115, y: 120 },
    { x: 60, y: 150 },
  ]),
  group([
    { x: 150, y: 100 },
    { x: 190, y: 100 },
    { x: 190, y: 150 },
    { x: 150, y: 150 },
  ]),
];

const INLINE = { x: 0, y: 0, width: 340, height: 192 };

const pts = (groups: StrokeGroup[]) => groups.flatMap((g) => g.points);

describe("signature-geometry", () => {
  it("is the identity when the view matches the frame", () => {
    const view = computeView(INLINE, 340, 192, 0);
    expect(view.scale).toBe(1);
    expect(toView(BOB, view)).toEqual(BOB);
  });

  it("maps inline → portrait fullscreen uniformly (no per-axis stretch)", () => {
    const view = computeView(INLINE, 340, 600, 0);
    const out = toView(BOB, view);
    const a = pts(BOB);
    const b = pts(out);
    // Every segment keeps its dx:dy proportion.
    for (let i = 1; i < a.length; i++) {
      const dxa = a[i]!.x - a[i - 1]!.x;
      const dya = a[i]!.y - a[i - 1]!.y;
      const dxb = b[i]!.x - b[i - 1]!.x;
      const dyb = b[i]!.y - b[i - 1]!.y;
      expect(dxb).toBeCloseTo(dxa * view.scale);
      expect(dyb).toBeCloseTo(dya * view.scale);
    }
  });

  it("round-trips inline → fullscreen → inline without shrinking the ink", () => {
    // The old code re-fit the previous CANVAS box on every hop, so
    // 340×192 → 340×600 (s=1) → 340×192 (s=0.32) left "Bob" at a third of
    // its size with un-scaled pen widths: the blobby, deformed signature.
    const full = computeView(INLINE, 340, 600, 0);
    const inFull = toView(BOB, full);
    const backInBase = fromView(inFull, full);
    const inline = computeView(INLINE, 340, 192, 0);
    const restored = toView(backInBase, inline);
    pts(restored).forEach((p, i) => {
      expect(p.x).toBeCloseTo(pts(BOB)[i]!.x);
      expect(p.y).toBeCloseTo(pts(BOB)[i]!.y);
      expect(p.time).toBeCloseTo(pts(BOB)[i]!.time);
    });
    restored.forEach((g, i) => {
      expect(g.minWidth).toBeCloseTo(BOB[i]!.minWidth);
      expect(g.maxWidth).toBeCloseTo(BOB[i]!.maxWidth);
    });
  });

  it("scales pen widths and stroke timing with the geometry so the replay is an exact scaled copy", () => {
    const view = computeView(INLINE, 170, 96, 0); // half size
    expect(view.scale).toBeCloseTo(0.5);
    const out = toView(BOB, view);
    expect(out[0]!.minWidth).toBeCloseTo(0.4);
    expect(out[0]!.maxWidth).toBeCloseTo(1.2);
    // signature_pad's width is a function of velocity = distance / Δtime;
    // scaling Δtime with distance keeps the velocity (and so the width
    // profile) identical.
    const [p0, p1] = out[0]!.points;
    expect(p1!.time - p0!.time).toBeCloseTo(10 * 0.5);
  });

  describe("landscape (CSS-rotated chrome over a portrait canvas)", () => {
    // Fullscreen portrait canvas 360×760; the landscape frame is 760×360.
    const CW = 360;
    const CH = 760;

    it("fits the upright ink into the landscape frame and rotates it 90° clockwise onto the canvas", () => {
      const view = computeView(INLINE, CW, CH, 90);
      // Upright landscape frame is 760×360 → s = min(760/340, 360/192).
      expect(view.scale).toBeCloseTo(Math.min(760 / 340, 360 / 192));
      const out = toView(BOB, view);
      for (const p of pts(out)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(CW);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(CH);
      }
      // Upright "down" (the B's vertical stem, +y) becomes canvas −x;
      // upright "right" (+x) becomes canvas +y.
      const stem = out[0]!.points;
      expect(stem[1]!.x - stem[0]!.x).toBeCloseTo(-110 * view.scale);
      expect(stem[1]!.y - stem[0]!.y).toBeCloseTo(0);
      const o = out[2]!.points;
      expect(o[1]!.y - o[0]!.y).toBeCloseTo(40 * view.scale);
      expect(o[1]!.x - o[0]!.x).toBeCloseTo(0);
    });

    it("rotates strokes drawn in landscape back upright on collapse", () => {
      const view = computeView(INLINE, CW, CH, 90);
      // The signer, holding the phone sideways, draws a horizontal line
      // left→right in THEIR frame: on the portrait canvas that runs top→bottom.
      const drawn = [
        group([
          { x: 180, y: 200 },
          { x: 180, y: 500 },
        ]),
      ];
      const base = fromView(drawn, view);
      const [a, b] = base[0]!.points;
      expect(b!.x - a!.x).toBeCloseTo(300 / view.scale); // horizontal…
      expect(b!.y - a!.y).toBeCloseTo(0); // …and upright
      // …and toView(fromView(x)) is the identity.
      const again = toView(base, view);
      expect(again[0]!.points[0]!.x).toBeCloseTo(180);
      expect(again[0]!.points[1]!.y).toBeCloseTo(500);
    });
  });

  describe("growFrame", () => {
    it("keeps the frame when the ink already fits", () => {
      expect(growFrame(INLINE, BOB)).toEqual(INLINE);
    });

    it("grows the frame to cover ink drawn outside it so a collapse never clips", () => {
      const outside = [
        group([
          { x: -50, y: 10 },
          { x: 400, y: 10 },
        ]),
      ];
      const f = growFrame(INLINE, outside);
      expect(f.x).toBe(-50);
      expect(f.x + f.width).toBe(400);
      expect(f.y).toBe(0);
      expect(f.height).toBe(192);
    });
  });
});
