import React from "react";
import { render, screen } from "@testing-library/react";
import DiagnosticPage from "./page";

describe("DiagnosticPage", () => {
  it("renders and shows diagnostic UI", () => {
    render(<DiagnosticPage />);
    expect(screen.getByText(/diagnostic/i)).toBeInTheDocument();
  });
}); 