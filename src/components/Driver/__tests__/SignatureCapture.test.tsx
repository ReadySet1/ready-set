import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock signature_pad — jsdom has no real 2d canvas context. The mock captures
// the endStroke handler so a test can simulate the driver drawing.
const mockPad = {
  _handlers: {} as Record<string, () => void>,
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
    mockPad.toData.mockReturnValue([]);
    resizeCallbacks = [];
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
      // Non-coordinate point fields pass through untouched.
      expect(pts[0]).toMatchObject({ time: 1000, pressure: 0.5 });
      expect(pts[1]).toMatchObject({ time: 1001, pressure: 0.5 });
      // Group-level pen settings survive untouched.
      expect(replayed[0]).toMatchObject({
        penColor: "#15202e",
        minWidth: 0.8,
        maxWidth: 2.4,
        compositeOperation: "source-over",
      });
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
  });
});
