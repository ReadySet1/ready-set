import React from "react";
import { render, screen } from "@testing-library/react";
import ClientDashboardPage from "./page";

describe("ClientDashboardPage", () => {
  it("renders and shows 'New Order' link", () => {
    render(<ClientDashboardPage />);
    expect(screen.getByText(/New Order/i)).toBeInTheDocument();
  });
}); 