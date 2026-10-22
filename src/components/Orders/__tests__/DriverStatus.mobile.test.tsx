/**
 * Mobile QA round 1, finding F3: the order tracking page overflowed a
 * 375px-wide phone. In the driver card the status badge never wrapped (the
 * Badge primitive is `whitespace-nowrap`) and long emails could not break, so
 * both ran past their container. jsdom has no layout engine, so these tests
 * pin the classes that let the content wrap; the real-width check is
 * documented in the PR.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DriverStatusCard } from "../DriverStatus";
import { DriverStatus, OrderStatus, type Driver } from "@/types/order";

const longEmail = "facilities.coordinator.longname@bigcorporateclient-example.com";

function renderCard() {
  render(
    <DriverStatusCard
      order={{
        id: "42",
        status: "ACTIVE" as OrderStatus,
        driver_status: DriverStatus.EN_ROUTE_TO_CLIENT,
        user_id: "u1",
        updated_at: new Date().toISOString(),
      }}
      driverInfo={
        {
          id: "d1",
          name: "Danny Driver",
          email: longEmail,
          contactNumber: "4155550199",
        } as Driver
      }
      updateDriverStatus={jest.fn()}
    />,
  );
}

describe("DriverStatusCard on narrow screens", () => {
  it("lets the driver status badge wrap instead of running off the card", () => {
    renderCard();

    const badge = screen.getByText("🚚 En Route to Client");
    expect(badge).toHaveClass("whitespace-normal");
    expect(badge).toHaveClass("max-w-full");
    // The primitive pins a 22px height; wrapped text needs it to grow.
    expect(badge).toHaveClass("h-auto");
    expect(badge.parentElement).toHaveClass("max-w-full");
  });

  it("breaks a long driver email inside its row", () => {
    renderCard();

    const link = screen.getByRole("link", { name: longEmail });
    expect(link).toHaveClass("break-all");
    expect(link).toHaveClass("min-w-0");
  });
});
