import { render, screen } from "@testing-library/react";
import { DriverStatus } from "@/types/user";
import { StatusTimeline } from "../StatusTimeline";

describe("StatusTimeline", () => {
  it("marks the current non-terminal step as in progress", () => {
    render(<StatusTimeline status={DriverStatus.EN_ROUTE_TO_CLIENT} />);
    expect(screen.getByText("In progress now")).toBeInTheDocument();
  });

  it("renders a completed delivery's terminal step as done, not in progress", () => {
    render(
      <StatusTimeline
        status={DriverStatus.COMPLETED}
        timestamps={{ [DriverStatus.COMPLETED]: "6:38 PM" }}
      />,
    );
    expect(screen.queryByText("In progress now")).not.toBeInTheDocument();
    // Done steps show their timestamp instead of the in-progress label.
    expect(screen.getByText("6:38 PM")).toBeInTheDocument();
  });

  it("shows the awaiting-start label when still assigned", () => {
    render(<StatusTimeline status={DriverStatus.ASSIGNED} />);
    expect(screen.getByText("Awaiting start")).toBeInTheDocument();
  });
});
