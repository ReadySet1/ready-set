import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/font/google", () => ({
  Playfair_Display: () => ({ className: "playfair-mock" }),
}));

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: () => ({
    openForm: jest.fn(),
    closeForm: jest.fn(),
    DialogForm: null,
  }),
}));

// Mock the Schedule component with the correct import path
jest.mock("../../Logistics/Schedule", () => {
  const MockScheduleDialog = ({ buttonText, customButton }: any) => {
    return React.createElement(
      "div",
      { "data-testid": "mock-schedule-dialog" },
      customButton ||
        React.createElement("button", {}, buttonText || "Schedule"),
    );
  };
  return MockScheduleDialog;
});

jest.mock("framer-motion", () => ({
  motion: (component: string) => component,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Now import FlowerHero after all mocks are set up
import FlowerHero from "../FlowerHero";

describe("FlowerHero - Minimal Test", () => {
  it("should render without crashing", () => {
    expect(() => render(<FlowerHero />)).not.toThrow();
  });

  it("should display the main heading", () => {
    render(<FlowerHero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Your Go-To Flower");
    expect(heading).toHaveTextContent("Delivery Partner");
    expect(heading).toHaveTextContent("Since 2019");
  });

  it("should display the schedule dialog", () => {
    render(<FlowerHero />);
    expect(screen.getByTestId("mock-schedule-dialog")).toBeInTheDocument();
  });

  it("should display the quote button", () => {
    render(<FlowerHero />);
    expect(screen.getByText("Get a Quote")).toBeInTheDocument();
  });
});
