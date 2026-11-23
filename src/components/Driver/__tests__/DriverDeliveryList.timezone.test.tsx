import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DriverDeliveryList } from "../DriverDeliveryList";
import { DriverThemeProvider } from "@/components/Driver/ui/DriverThemeProvider";
import type { ApiDelivery } from "@/hooks/driver/useDriverDeliveriesFeed";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// 2026-11-20T17:00Z = 11:00 AM CST = 9:00 AM PST
function delivery(orderNumber: string, zip: string): ApiDelivery {
  return {
    id: orderNumber,
    orderNumber,
    delivery_type: "catering",
    status: "COMPLETED",
    driverStatus: "COMPLETED",
    pickupDateTime: "2026-11-20T17:00:00.000Z",
    completeDateTime: "2026-11-20T19:00:00.000Z",
    order_total: 100,
    address: { street1: `${orderNumber} Vendor`, city: "X" },
    pickupAddress: { zip, timezone: null },
  };
}

describe("DriverDeliveryList order time zone", () => {
  it("labels each card's pickup time on its own order clock", () => {
    render(
      <DriverThemeProvider>
        <DriverDeliveryList
          deliveries={[delivery("AUS-1", "78701"), delivery("SF-1", "94103")]}
          loading={false}
          error={null}
          onRetry={jest.fn()}
        />
      </DriverThemeProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /completed/i }));

    expect(screen.getByText(/11:00 AM CT/)).toBeInTheDocument();
    expect(screen.getByText(/9:00 AM PT/)).toBeInTheDocument();
  });
});
