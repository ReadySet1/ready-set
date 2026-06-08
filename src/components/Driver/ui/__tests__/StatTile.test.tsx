import { render, screen } from "@testing-library/react";
import { Package } from "lucide-react";
import { StatTile } from "../StatTile";

describe("StatTile", () => {
  it("renders value, label and sub", () => {
    render(<StatTile icon={Package} label="Deliveries" value={6} sub="4 done" />);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Deliveries")).toBeInTheDocument();
    expect(screen.getByText("4 done")).toBeInTheDocument();
  });

  it("colors a positive delta green and a negative delta red", () => {
    const { rerender } = render(
      <StatTile icon={Package} label="Miles" value={10} delta="+8%" />,
    );
    expect(screen.getByText("+8%").className).toContain("text-driver-success");

    rerender(<StatTile icon={Package} label="Miles" value={10} delta="-3%" />);
    expect(screen.getByText("-3%").className).toContain("text-driver-error");
  });
});
