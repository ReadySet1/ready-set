import React from "react";
import { render, screen } from "@testing-library/react";
import ProfileTestPage from "./page";

describe("ProfileTestPage", () => {
  it("renders and shows profile UI", () => {
    render(<ProfileTestPage />);
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
  });
}); 