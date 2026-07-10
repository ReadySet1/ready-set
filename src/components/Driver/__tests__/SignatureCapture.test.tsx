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

const SIG_URL = "https://cdn.example.com/deliveries/pickup-signature.png";

const typeName = (name = "Maria Lopez") =>
  fireEvent.change(screen.getByLabelText(/received \/ confirmed by/i), {
    target: { value: name },
  });

const lastFormData = (): FormData =>
  (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;

describe("SignatureCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPad._handlers = {};
    mockPad.isEmpty.mockReturnValue(false);
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
});
