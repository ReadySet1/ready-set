import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DriverDeliveryDetail } from "../DriverDeliveryDetail";
import { DriverThemeProvider } from "@/components/Driver/ui/DriverThemeProvider";
import { DriverStatus } from "@/types/user";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
    },
  }),
}));

// POD capture pulls in camera APIs — stub it so the sheet renders cleanly.
jest.mock("@/components/Driver/ProofOfDeliveryCapture", () => ({
  ProofOfDeliveryCapture: () => <div data-testid="pod-capture" />,
}));

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "CV-12345",
    order_type: "catering",
    status: "ASSIGNED",
    driverStatus: DriverStatus.ASSIGNED,
    pickupAddress: {
      name: "Tasty Vendor",
      street1: "1 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
      isRestaurant: true,
    },
    deliveryAddress: {
      street1: "500 Howard St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
    },
    user: { name: "Acme Corp", email: "ops@acme.com" },
    dispatches: [{ driver: { id: "drv-1", name: "Dan Driver", contactNumber: "5551234" } }],
    pickupDateTime: "2026-06-08T17:00:00Z",
    arrivalDateTime: "2026-06-08T18:00:00Z",
    clientAttention: "Front desk",
    headcount: 25,
    deliveryTimestamps: { assignedAt: "2026-06-08T16:00:00Z" },
    ...overrides,
  };
}

let currentOrder: Record<string, unknown>;

function installFetch() {
  global.fetch = jest.fn((_url: string, opts?: RequestInit) => {
    const method = opts?.method ?? "GET";
    if (method === "PATCH") {
      const body = JSON.parse((opts?.body as string) ?? "{}");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            makeOrder({
              driverStatus: body.driverStatus ?? currentOrder.driverStatus,
            }),
          ),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(currentOrder),
    });
  }) as unknown as typeof fetch;
}

function renderDetail() {
  return render(
    <DriverThemeProvider>
      <DriverDeliveryDetail orderNumber="CV-12345" />
    </DriverThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  currentOrder = makeOrder();
  installFetch();
});

describe("DriverDeliveryDetail", () => {
  it("fetches and renders the delivery details", async () => {
    renderDetail();

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Tasty Vendor")).toBeInTheDocument();
    expect(screen.getByText("#CV-12345")).toBeInTheDocument();
    // Friendly status label from the driver status config (pill + timeline).
    expect(screen.getAllByText("Assigned").length).toBeGreaterThan(0);
    // Pickup + drop-off addresses rendered (street1 + "city, state zip").
    expect(screen.getByText("1 Market St")).toBeInTheDocument();
    expect(screen.getByText("500 Howard St")).toBeInTheDocument();

    // Order was fetched with the dispatch.driver include.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/orders/CV-12345?include=dispatch.driver"),
      expect.any(Object),
    );
  });

  it("advances the driver status via PATCH when the Next-Action is tapped", async () => {
    renderDetail();
    // Wait for load, then tap the next-step action.
    fireEvent.click(await screen.findByText("On my way to vendor"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/CV-12345"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ driverStatus: DriverStatus.EN_ROUTE_TO_VENDOR }),
        }),
      );
    });
  });

  it("requires proof of delivery before completing (opens POD sheet, no immediate PATCH)", async () => {
    currentOrder = makeOrder({ driverStatus: DriverStatus.ARRIVED_TO_CLIENT });
    renderDetail();

    fireEvent.click(await screen.findByText("Complete delivery"));

    // POD capture surfaces...
    expect(await screen.findByTestId("pod-capture")).toBeInTheDocument();
    // ...and no status PATCH was fired yet (gated on the photo).
    const patched = (global.fetch as jest.Mock).mock.calls.some(
      (c) => c[1]?.method === "PATCH",
    );
    expect(patched).toBe(false);
  });

  it("shows a not-found state when the order is missing", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    ) as unknown as typeof fetch;

    renderDetail();
    expect(await screen.findByText("Delivery not found")).toBeInTheDocument();
  });
});
