import React from "react";
import { render, screen } from "@testing-library/react";
import { OnDemandOrdersTable } from "../OnDemandOrdersTable";
import { OnDemandOrder } from "../types";
import { simulateBrowserTimezone } from "@/__tests__/utils/browser-timezone";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="order-link">
      {children}
    </a>
  ),
}));

describe("OnDemandOrdersTable - order date timezone", () => {
  // 06:30Z = Oct 7, 11:30 PM in Pacific, but Oct 8 in Tokyo (and in UTC).
  const ORDER_DATE = "2026-10-08T06:30:00.000Z";

  beforeEach(() => {
    simulateBrowserTimezone("Asia/Tokyo");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the order date in the app timezone (Pacific), not the browser timezone", () => {
    const orders: OnDemandOrder[] = [
      {
        id: "tz-1",
        order_number: "OD-TZ-1",
        status: "active",
        date: ORDER_DATE,
        order_total: "10.00",
        client_attention: "Tz Tester",
      },
    ];

    render(
      <OnDemandOrdersTable
        orders={orders}
        isLoading={false}
        statusFilter="all"
        onStatusFilterChange={jest.fn()}
        userRoles={{ isAdmin: true, isSuperAdmin: false, helpdesk: false }}
        onOrderDeleted={jest.fn()}
      />,
    );

    expect(screen.getByText("Oct 7, 2026")).toBeInTheDocument();
    expect(screen.queryByText("10/8/2026")).not.toBeInTheDocument();
  });
});
