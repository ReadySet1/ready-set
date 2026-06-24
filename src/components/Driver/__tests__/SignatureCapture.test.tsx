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

const SIG_URL = "https://cdn.example.com/signatures/sig.png";

describe("SignatureCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPad._handlers = {};
    mockPad.isEmpty.mockReturnValue(false);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, url: SIG_URL }),
    }) as unknown as typeof fetch;
  });

  it("disables Confirm until a stroke is drawn", () => {
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /confirm signature/i })).toBeDisabled();
  });

  it("uploads the signature and reports the stored URL", async () => {
    const onComplete = jest.fn();
    render(
      <SignatureCapture orderNumber="CAT-001" onUploadComplete={onComplete} onCancel={jest.fn()} />,
    );

    // Simulate the driver completing a stroke.
    act(() => mockPad._handlers["endStroke"]?.());

    fireEvent.click(screen.getByRole("button", { name: /confirm signature/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(SIG_URL));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/orders/CAT-001/signature",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
