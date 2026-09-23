import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock signature_pad — jsdom has no real 2d canvas context. The mock captures
// the endStroke handler so a test can simulate the driver drawing.
const mockPad = {
  _handlers: {} as Record<string, () => void>,
  // Stateful stroke store so fromData/clear/toData behave like the real pad.
  _data: [] as any[],
  clear: jest.fn(),
  isEmpty: jest.fn(() => false),
  toDataURL: jest.fn(() => "data:image/png;base64,iVBORw0KGgo="),
  toData: jest.fn((): any[] => []),
  fromData: jest.fn(),
  addEventListener: jest.fn((evt: string, cb: () => void) => {
    mockPad._handlers[evt] = cb;
  }),
  removeEventListener: jest.fn(),
  off: jest.fn(),
};
jest.mock("signature_pad", () => ({
  __esModule: true,
  default: jest.fn(() => mockPad),
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { SignatureCapture } from "../SignatureCapture";
import { createClient } from "@/utils/supabase/client";

const SIG_URL = "https://cdn.example.com/deliveries/pickup-signature.png";

const typeName = (name = "Maria Lopez") =>
  fireEvent.change(screen.getByLabelText(/received \/ confirmed by/i), {
    target: { value: name },
  });

const lastFormData = (): FormData =>
  (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;

// Capture ResizeObserver callbacks so tests can drive resizes with controlled
// canvas dimensions (the global jest.setup mock is a no-op).
let resizeCallbacks: ResizeObserverCallback[] = [];
class CapturingResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("SignatureCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPad._handlers = {};
    mockPad.isEmpty.mockReturnValue(false);
    mockPad._data = [];
    mockPad.toData.mockImplementation(() => mockPad._data);
    mockPad.fromData.mockImplementation((groups: any[]) => {
      mockPad._data = [...groups];
    });
    mockPad.clear.mockImplementation(() => {
      mockPad._data = [];
    });
    resizeCallbacks = [];
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => ({ scale: jest.fn() }) as any);
    global.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, url: SIG_URL, receivedBy: "Maria Lopez" }),
    }) as unknown as typeof fetch;
  });

  it("disables Confirm until a receiver name is entered (ink not required)", () => {
    mockPad.isEmpty.mockReturnValue(true);
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
    );
    const confirm = screen.getByRole("button", { name: /confirm pickup/i });
    expect(confirm).toBeDisabled();

    typeName();
    expect(confirm).toBeEnabled();
  });

  it("uploads name + signature when the pad has ink", async () => {
    const onComplete = jest.fn();
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={onComplete} onCancel={jest.fn()} />,
    );

    typeName();
    // Simulate the driver completing a stroke.
    act(() => mockPad._handlers["endStroke"]?.());

    fireEvent.click(screen.getByRole("button", { name: /confirm pickup/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(SIG_URL));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/orders/CAT-001/signature",
      expect.objectContaining({ method: "POST" }),
    );
    const fd = lastFormData();
    expect(fd.get("receivedBy")).toBe("Maria Lopez");
    expect(fd.get("file")).not.toBeNull();
  });

  it("confirms with name only when the pad is empty (signature optional)", async () => {
    mockPad.isEmpty.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, url: null, receivedBy: "Maria Lopez" }),
    });
    const onComplete = jest.fn();
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={onComplete} onCancel={jest.fn()} />,
    );

    typeName();
    fireEvent.click(screen.getByRole("button", { name: /confirm pickup/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(null));
    const fd = lastFormData();
    expect(fd.get("receivedBy")).toBe("Maria Lopez");
    expect(fd.get("file")).toBeNull();
  });

  it("attaches the Bearer token to the upload when a session exists (stale-cookie transport)", async () => {
    (createClient as jest.Mock).mockReturnValueOnce({
      auth: {
        getSession: jest
          .fn()
          .mockResolvedValue({ data: { session: { access_token: "tok-sig" } } }),
      },
    });
    const onComplete = jest.fn();
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={onComplete} onCancel={jest.fn()} />,
    );

    typeName();
    fireEvent.click(screen.getByRole("button", { name: /confirm pickup/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    // Bearer token attached; Content-Type stays browser-set so the multipart
    // boundary is preserved.
    expect(init.headers).toEqual({ Authorization: "Bearer tok-sig" });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("uploads without an Authorization header when signed out (cookie fallback)", async () => {
    // The global supabase client mock resolves a null session by default.
    const onComplete = jest.fn();
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={onComplete} onCancel={jest.fn()} />,
    );

    typeName();
    fireEvent.click(screen.getByRole("button", { name: /confirm pickup/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(init.headers ?? {}).not.toHaveProperty("Authorization");
  });

  describe("resize ink preservation", () => {
    const setCanvasSize = (canvas: HTMLElement, w: number, h: number) => {
      Object.defineProperty(canvas, "offsetWidth", { value: w, configurable: true });
      Object.defineProperty(canvas, "offsetHeight", { value: h, configurable: true });
    };

    const fireResize = () =>
      act(() => {
        resizeCallbacks.forEach((cb) => cb([], {} as ResizeObserver));
      });

    // A signature_pad v5 point group: pen settings live on the group,
    // {x, y, time, pressure} on each point.
    const strokeGroup = (points: Array<{ x: number; y: number }>) => ({
      penColor: "#15202e",
      dotSize: 0,
      minWidth: 0.8,
      maxWidth: 2.4,
      compositeOperation: "source-over",
      points: points.map((p, i) => ({ ...p, time: 1000 + i, pressure: 0.5 })),
    });

    it("uniformly scales and centers stroke coordinates when collapsing from fullscreen", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);

      // First layout at fullscreen height: no previous size, nothing to scale.
      setCanvasSize(canvas, 350, 600);
      fireResize();
      expect(mockPad.fromData).not.toHaveBeenCalled();

      // The driver signs mid-canvas; the pad holds 350×600-space coordinates.
      mockPad.toData.mockReturnValue([
        strokeGroup([
          { x: 100, y: 300 },
          { x: 200, y: 600 },
        ]),
      ]);

      // Collapse to the inline h-48 pad (350×192). Independent per-axis
      // factors would squash y by 0.32 while leaving x untouched — the field
      // distortion. Instead both axes share s = min(350/350, 192/600) = 0.32
      // and the shrunk 112px-wide stroke box is centered: offsetX = 119.
      setCanvasSize(canvas, 350, 192);
      fireResize();

      expect(mockPad.fromData).toHaveBeenCalledTimes(1);
      const replayed = mockPad.fromData.mock.calls[0][0];
      const pts = replayed[0].points;
      expect(pts[0].x).toBeCloseTo(100 * 0.32 + 119); // 151
      expect(pts[0].y).toBeCloseTo(300 * 0.32); // 96
      expect(pts[1].x).toBeCloseTo(200 * 0.32 + 119); // 183
      expect(pts[1].y).toBeCloseTo(600 * 0.32); // 192
      // Same factor on both axes ⇒ the stroke's dx/dy proportions survive.
      const scaleX = (pts[1].x - pts[0].x) / (200 - 100);
      const scaleY = (pts[1].y - pts[0].y) / (600 - 300);
      expect(scaleX).toBeCloseTo(scaleY);
      // Pressure passes through; Δtime scales with the geometry so the
      // velocity-derived pen width profile is preserved.
      expect(pts[0]).toMatchObject({ time: 1000, pressure: 0.5 });
      expect(pts[1].time).toBeCloseTo(1000 + 1 * 0.32);
      expect(pts[1].pressure).toBe(0.5);
      // Pen widths scale with the ink so the shrunk copy is not blobby…
      expect(replayed[0]).toMatchObject({
        penColor: "#15202e",
        compositeOperation: "source-over",
      });
      // …but never below the 0.8px floor (faint uploads), ratio kept.
      expect(replayed[0].minWidth).toBeCloseTo(0.8);
      expect(replayed[0].maxWidth).toBeCloseTo(2.4);
      // Everything stays on-canvas — the uploaded PNG must show the ink.
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(350);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(192);
      }
    });

    it("keeps the signature undistorted and on-canvas across a fullscreen → collapsed → fullscreen round trip", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);

      setCanvasSize(canvas, 350, 600);
      fireResize();

      mockPad.toData.mockReturnValue([
        strokeGroup([
          { x: 100, y: 300 },
          { x: 200, y: 600 },
        ]),
      ]);
      setCanvasSize(canvas, 350, 192);
      fireResize();

      // The pad now reports the collapsed-space strokes; expanding again must
      // keep the stroke's proportions (uniform scaling is not a perfect
      // inverse when aspect ratios differ, so exact coordinates may shift —
      // but the shape must never squash and the ink must stay visible).
      const collapsed = mockPad.fromData.mock.calls[0][0];
      mockPad.toData.mockReturnValue(collapsed);
      setCanvasSize(canvas, 350, 600);
      fireResize();

      const restored = mockPad.fromData.mock.calls[1]![0];
      const pts = restored[0].points;
      const scaleX = (pts[1].x - pts[0].x) / (200 - 100);
      const scaleY = (pts[1].y - pts[0].y) / (600 - 300);
      expect(scaleX).toBeCloseTo(scaleY); // aspect ratio preserved end-to-end
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(350);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(600);
      }
    });

    it("does not rescale when the size is unchanged", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);

      setCanvasSize(canvas, 350, 192);
      fireResize();
      mockPad.toData.mockReturnValue([strokeGroup([{ x: 10, y: 20 }])]);

      // Same dimensions again — the guard skips the resize entirely.
      fireResize();
      expect(mockPad.fromData).not.toHaveBeenCalled();
    });

    // "Bob" as signed in the field on the inline pad (340×192).
    const BOB = () => [
      strokeGroup([
        { x: 60, y: 40 },
        { x: 60, y: 150 },
      ]),
      strokeGroup([
        { x: 60, y: 40 },
        { x: 110, y: 55 },
        { x: 60, y: 95 },
        { x: 115, y: 120 },
        { x: 60, y: 150 },
      ]),
      strokeGroup([
        { x: 150, y: 100 },
        { x: 190, y: 150 },
      ]),
    ];
    const flat = (groups: any[]) => groups.flatMap((g: any) => g.points);

    it("restores the inline signature exactly after inline 340×192 → fullscreen 340×600 → inline", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);
      setCanvasSize(canvas, 340, 192);
      fireResize();
      mockPad._data = BOB(); // the driver signs inline

      setCanvasSize(canvas, 340, 600); // expand (portrait fullscreen)
      fireResize();
      const full = flat(mockPad.fromData.mock.calls[0][0]);
      const orig = flat(BOB());
      // Uniform: every segment keeps its dx:dy ratio.
      for (let i = 1; i < orig.length; i++) {
        const k = (full[i].x - full[i - 1].x) / (orig[i].x - orig[i - 1].x || 1);
        if (orig[i].x !== orig[i - 1].x && orig[i].y !== orig[i - 1].y) {
          expect((full[i].y - full[i - 1].y) / (orig[i].y - orig[i - 1].y)).toBeCloseTo(k);
        }
      }

      setCanvasSize(canvas, 340, 192); // collapse
      fireResize();
      // The old code re-fit the previous canvas box on each hop: s=1 on the
      // way up, s=0.32 on the way down — "Bob" came back a third of its size
      // with full-width pen strokes (the deformed field signature).
      const back = flat(mockPad._data);
      back.forEach((p: any, i: number) => {
        expect(p.x).toBeCloseTo(orig[i].x);
        expect(p.y).toBeCloseTo(orig[i].y);
      });
      expect(mockPad._data[0].maxWidth).toBeCloseTo(2.4);
    });

    it("does not erode the ink over repeated height-only resizes (iOS keyboard show/hide)", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);
      setCanvasSize(canvas, 340, 600);
      fireResize();
      const drawn = [
        strokeGroup([
          { x: 40, y: 100 },
          { x: 300, y: 500 },
        ]),
      ];
      mockPad._data = drawn.map((g) => ({ ...g, points: [...g.points] }));
      for (let i = 0; i < 3; i++) {
        setCanvasSize(canvas, 340, 300);
        fireResize();
        setCanvasSize(canvas, 340, 600);
        fireResize();
      }
      const pts = flat(mockPad._data);
      expect(pts[0].x).toBeCloseTo(40);
      expect(pts[0].y).toBeCloseTo(100);
      expect(pts[1].x).toBeCloseTo(300);
      expect(pts[1].y).toBeCloseTo(500);
    });

    it("keeps new strokes drawn in fullscreen when collapsing (grows the frame instead of clipping)", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);
      setCanvasSize(canvas, 340, 192);
      fireResize();
      mockPad._data = BOB();
      setCanvasSize(canvas, 340, 600);
      fireResize();
      // A flourish near the top of the tall pad — outside the inline frame.
      mockPad._data = [
        ...mockPad._data,
        strokeGroup([
          { x: 20, y: 20 },
          { x: 320, y: 30 },
        ]),
      ];
      setCanvasSize(canvas, 340, 192);
      fireResize();
      expect(mockPad._data).toHaveLength(4);
      for (const p of flat(mockPad._data)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(340);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(192);
      }
    });
    it("defers a resize that lands mid-stroke until the stroke ends (no points lost)", () => {
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);
      setCanvasSize(canvas, 340, 192);
      fireResize();

      // The driver starts signing…
      act(() => mockPad._handlers["beginStroke"]?.());
      const stroke = strokeGroup([
        { x: 50, y: 50 },
        { x: 60, y: 60 },
      ]);
      mockPad._data = [stroke];

      // …the keyboard closes (Android) and the pad resizes under the finger.
      setCanvasSize(canvas, 340, 300);
      fireResize();
      expect(mockPad.fromData).not.toHaveBeenCalled(); // deferred

      // The finger keeps going, then lifts: the deferred resize runs now.
      stroke.points.push(
        { x: 70, y: 70, time: 1002, pressure: 0.5 },
        { x: 80, y: 80, time: 1003, pressure: 0.5 },
      );
      act(() => mockPad._handlers["endStroke"]?.());
      expect(mockPad.fromData).toHaveBeenCalledTimes(1);

      // Tapping Done / another resize must keep every point.
      setCanvasSize(canvas, 340, 192);
      fireResize();
      const pts = mockPad._data.flatMap((g: any) => g.points);
      expect(pts).toHaveLength(4);
      expect(pts[3].x).toBeCloseTo(80);
      expect(pts[3].y).toBeCloseTo(80);
    });
  });

  describe("landscape fullscreen", () => {
    const setCanvasSize = (canvas: HTMLElement, w: number, h: number) => {
      Object.defineProperty(canvas, "offsetWidth", { value: w, configurable: true });
      Object.defineProperty(canvas, "offsetHeight", { value: h, configurable: true });
    };
    const fireResize = () =>
      act(() => {
        resizeCallbacks.forEach((cb) => cb([], {} as ResizeObserver));
      });
    const strokeGroup = (points: Array<{ x: number; y: number }>) => ({
      penColor: "#15202e",
      dotSize: 0,
      minWidth: 0.8,
      maxWidth: 2.4,
      compositeOperation: "source-over",
      points: points.map((p, i) => ({ ...p, time: 1000 + i, pressure: 0.5 })),
    });
    const setViewport = (w: number, h: number) => {
      Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
    };
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    afterEach(() => {
      setViewport(origW, origH);
      delete (screen as any).orientation;
      Object.defineProperty(window.screen, "orientation", { value: undefined, configurable: true });
    });

    it("rotates the fullscreen chrome 90° on a portrait phone and keeps Done/Clear reachable", () => {
      setViewport(390, 844);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      const overlay = screen.getByTestId("signature-fullscreen");
      expect(overlay).toHaveAttribute("data-rotated", "true");
      expect(screen.getByRole("button", { name: /exit full screen/i })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /clear/i }).length).toBeGreaterThan(0);
    });

    it("does not rotate when the viewport is already landscape (device rotated or orientation lock succeeded)", () => {
      setViewport(844, 390);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(screen.getByTestId("signature-fullscreen")).toHaveAttribute("data-rotated", "false");
    });

    it("replays the inline signature rotated into the landscape pad and upright again on collapse", () => {
      setViewport(390, 844);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const canvas = screen.getByLabelText(/signature pad/i);
      setCanvasSize(canvas, 340, 192);
      fireResize();
      const stem = strokeGroup([
        { x: 60, y: 40 },
        { x: 60, y: 150 },
      ]);
      mockPad._data = [stem];

      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      setCanvasSize(canvas, 360, 760); // portrait canvas, landscape chrome
      fireResize();
      const [a, b] = mockPad._data[0].points;
      // Upright vertical stem → horizontal on the portrait canvas (rotated).
      expect(b.y - a.y).toBeCloseTo(0);
      expect(b.x - a.x).toBeLessThan(0);
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(360);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(760);
      }

      fireEvent.click(screen.getByRole("button", { name: /exit full screen/i }));
      setCanvasSize(canvas, 340, 192);
      fireResize();
      const [c, d] = mockPad._data[0].points;
      expect(c.x).toBeCloseTo(60);
      expect(c.y).toBeCloseTo(40);
      expect(d.x).toBeCloseTo(60);
      expect(d.y).toBeCloseTo(150);
    });

    it("opportunistically locks orientation on expand and unlocks on exit, swallowing failures", async () => {
      setViewport(390, 844);
      const lock = jest.fn().mockRejectedValue(new Error("NotSupportedError"));
      const unlock = jest.fn(() => {
        throw new Error("nope");
      });
      Object.defineProperty(window.screen, "orientation", {
        value: { lock, unlock, type: "portrait-primary" },
        configurable: true,
      });
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(lock).toHaveBeenCalledWith("landscape");
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: /exit full screen/i }));
      expect(unlock).toHaveBeenCalled();
      expect(screen.queryByTestId("signature-fullscreen")).not.toBeInTheDocument();
    });

    it("dismisses the keyboard when entering fullscreen so it cannot cover the pad", () => {
      setViewport(390, 844);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      const input = screen.getByLabelText(/received \/ confirmed by/i);
      input.focus();
      expect(document.activeElement).toBe(input);
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(document.activeElement).not.toBe(input);
    });
    it("unlocks orientation when unmounted while fullscreen (sheet closed / Escape)", () => {
      setViewport(390, 844);
      const unlock = jest.fn();
      Object.defineProperty(window.screen, "orientation", {
        value: { lock: jest.fn().mockResolvedValue(undefined), unlock, type: "portrait-primary" },
        configurable: true,
      });
      const { unmount } = render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(unlock).not.toHaveBeenCalled();
      unmount();
      expect(unlock).toHaveBeenCalledTimes(1);
    });

    it("moves focus to Done when fullscreen opens", () => {
      setViewport(390, 844);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /exit full screen/i }),
      );
    });

    it("lets the pad shrink with the viewport (min-h-0) so Clear stays on-screen", () => {
      setViewport(844, 390);
      render(
        <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sign in full screen/i }));
      expect(screen.getByLabelText(/signature pad/i).parentElement).toHaveClass("flex-1", "min-h-0");
    });
  });
});
