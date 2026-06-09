import { render, screen } from "@testing-library/react";
import { DriverStatus } from "@/types/user";
import { StatusPill } from "../StatusPill";

describe("StatusPill", () => {
  it("renders the friendly label for a stage", () => {
    render(<StatusPill status={DriverStatus.EN_ROUTE_TO_VENDOR} />);
    expect(screen.getByText("En route to vendor")).toBeInTheDocument();
  });

  it("applies the semantic color bundle for the status kind", () => {
    render(<StatusPill status={DriverStatus.COMPLETED} />);
    const pill = screen.getByText("Delivered");
    // done → success tokens
    expect(pill.className).toContain("bg-driver-success-bg");
    expect(pill.className).toContain("text-driver-success-ink");
  });

  it("renders a not-started label for null status", () => {
    render(<StatusPill status={null} />);
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});
