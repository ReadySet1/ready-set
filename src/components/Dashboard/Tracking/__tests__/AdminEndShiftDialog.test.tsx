/**
 * Admin "End shift" confirmation dialog.
 *
 * - Loads GET /api/tracking/shifts/[id]/admin-end and shows what will happen:
 *   the shift closes, open orders stay assigned (nothing is cancelled), and
 *   pending return requests are listed with an opt-in to void them.
 * - Submit stays disabled until a reason is typed.
 * - POSTs reason + the void choice; success closes the dialog and toasts.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("react-hot-toast", () => {
  const toastFn: any = jest.fn();
  toastFn.success = jest.fn();
  toastFn.error = jest.fn();
  return { __esModule: true, default: toastFn };
});

import toast from "react-hot-toast";
import AdminEndShiftDialog from "../AdminEndShiftDialog";

const mockedToast = toast as jest.Mocked<typeof toast> & jest.Mock;
const SHIFT_ID = "660e8400-e29b-41d4-a716-446655440001";

const preview = {
  shift: {
    id: SHIFT_ID,
    status: "active",
    isOpen: true,
    shiftStart: "2026-10-08T14:00:00.000Z",
    driverId: "driver-1",
    driverName: "Fernando Sanchez",
  },
  openOrders: [
    { orderNumber: "CAT-001", status: "ASSIGNED" },
    { orderNumber: "OD-002", status: "PICKED_UP" },
  ],
  pendingReturnRequests: [
    {
      id: "rr-1",
      orderNumber: "CAT-003",
      reason: "VEHICLE_ISSUE",
      requestedAt: "2026-10-08T15:00:00.000Z",
    },
  ],
};

function mockFetch(
  previewBody: unknown = { success: true, data: preview },
  postResponse: { status: number; body: unknown } = {
    status: 200,
    body: { success: true, shiftId: SHIFT_ID, voidedReturnRequests: 0 },
  },
) {
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") {
      return { ok: true, status: 200, json: async () => previewBody };
    }
    return {
      ok: postResponse.status < 400,
      status: postResponse.status,
      json: async () => postResponse.body,
    };
  });
  global.fetch = fetchMock as any;
  return fetchMock;
}

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof AdminEndShiftDialog>> = {},
) {
  const props = {
    shiftId: SHIFT_ID,
    driverName: "Fernando Sanchez",
    open: true,
    onOpenChange: jest.fn(),
    onEnded: jest.fn(),
    ...overrides,
  };
  render(<AdminEndShiftDialog {...props} />);
  return props;
}

describe("AdminEndShiftDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the open orders and pending return requests before confirming", async () => {
    mockFetch();
    renderDialog();

    expect(await screen.findByText("CAT-001")).toBeInTheDocument();
    expect(screen.getByText("OD-002")).toBeInTheDocument();
    expect(screen.getByText("CAT-003")).toBeInTheDocument();
    // Orders are never cancelled by this action.
    expect(screen.getByText(/stay assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is cancelled/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/tracking/shifts/${SHIFT_ID}/admin-end`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("says so when nothing else is open", async () => {
    mockFetch({
      success: true,
      data: { ...preview, openOrders: [], pendingReturnRequests: [] },
    });
    renderDialog();

    expect(await screen.findByText(/no open orders/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps End shift disabled until a reason is entered", async () => {
    mockFetch();
    renderDialog();
    await screen.findByText("CAT-001");

    const submit = screen.getByRole("button", { name: /end shift/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "   " },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Driver phone died" },
    });
    expect(submit).toBeEnabled();
  });

  it("posts the reason and leaves return requests alone by default", async () => {
    const fetchMock = mockFetch();
    const props = renderDialog();
    await screen.findByText("CAT-001");

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Driver phone died" },
    });
    fireEvent.click(screen.getByRole("button", { name: /end shift/i }));

    await waitFor(() => expect(props.onEnded).toHaveBeenCalled());
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(postCall?.[0]).toBe(`/api/tracking/shifts/${SHIFT_ID}/admin-end`);
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      reason: "Driver phone died",
      voidReturnRequests: false,
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(mockedToast.success).toHaveBeenCalled();
  });

  it("sends voidReturnRequests when the admin ticks the box", async () => {
    const fetchMock = mockFetch();
    renderDialog();
    await screen.findByText("CAT-003");

    fireEvent.click(screen.getByRole("checkbox", { name: /void/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Test drive cleanup" },
    });
    fireEvent.click(screen.getByRole("button", { name: /end shift/i }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
      ).toBe(true),
    );
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      voidReturnRequests: true,
    });
  });

  it("surfaces a failure and stays open", async () => {
    mockFetch(undefined, {
      status: 409,
      body: { success: false, error: "This shift has already ended." },
    });
    const props = renderDialog();
    await screen.findByText("CAT-001");

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Stuck" },
    });
    fireEvent.click(screen.getByRole("button", { name: /end shift/i }));

    expect(
      await screen.findByText("This shift has already ended."),
    ).toBeInTheDocument();
    expect(props.onEnded).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
