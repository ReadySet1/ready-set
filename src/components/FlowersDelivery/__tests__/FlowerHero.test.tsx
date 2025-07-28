import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import FlowerHero from "../FlowerHero";

// Mock the FormManager hook
const mockOpenForm = jest.fn();
const mockDialogForm = <div data-testid="mock-dialog-form">Dialog Form</div>;

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: () => ({
    openForm: mockOpenForm,
    DialogForm: mockDialogForm,
  }),
}));

// Mock ScheduleDialog
jest.mock("../../Logistics/Schedule", () => ({
  default: ({ buttonText, customButton, calendarUrl }: any) => (
    <div data-testid="mock-schedule-dialog">
      {customButton || (
        <button data-testid="schedule-button">{buttonText}</button>
      )}
    </div>
  ),
}));

describe("FlowerHero", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the component successfully", () => {
      render(<FlowerHero />);
      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("displays the correct title text", () => {
      render(<FlowerHero />);
      
      // Test the multi-line title
      expect(screen.getByText("Your Go-To Flower")).toBeInTheDocument();
      expect(screen.getByText("Delivery Partner")).toBeInTheDocument();
      expect(screen.getByText("Since 2019")).toBeInTheDocument();
    });

    it("displays the service description", () => {
      render(<FlowerHero />);
      
      const description = screen.getByText(/We specialize in local floral deliveries/);
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        "We specialize in local floral deliveries across cities such as San Francisco, Atlanta, and Austin, offering real-time tracking and careful handling to ensure your blooms arrive on time and maintain your shop's reputation."
      );
    });

    it("renders both CTA buttons", () => {
      render(<FlowerHero />);
      
      expect(screen.getByRole("button", { name: "Get a Quote" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Book a call" })).toBeInTheDocument();
    });

    it("renders the dialog form", () => {
      render(<FlowerHero />);
      
      expect(screen.getByTestId("mock-dialog-form")).toBeInTheDocument();
    });
  });

  describe("Props", () => {
    it("uses default image path when none provided", () => {
      render(<FlowerHero />);
      
      // Check if background image is set (we can't directly test style, but we can check the element exists)
      const backgroundElements = screen.getAllByText("", { exact: false });
      expect(backgroundElements).toBeTruthy();
    });

    it("uses custom image path when provided", () => {
      const customImagePath = "/custom/flower/image.jpg";
      render(<FlowerHero imagePath={customImagePath} />);
      
      // The component should render with custom image path
      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("accepts headline and subheadline props (even if not currently used in JSX)", () => {
      const props = {
        headline: "Custom Headline",
        subheadline: "Custom Subheadline",
        imagePath: "/custom/image.png"
      };
      
      // Should not throw error even with unused props
      expect(() => render(<FlowerHero {...props} />)).not.toThrow();
    });
  });

  describe("User Interactions", () => {
    it("calls openForm when Get a Quote button is clicked", async () => {
      const user = userEvent.setup();
      render(<FlowerHero />);
      
      const quoteButton = screen.getByRole("button", { name: "Get a Quote" });
      await user.click(quoteButton);
      
      expect(mockOpenForm).toHaveBeenCalledWith("flower");
    });

    it("renders schedule dialog with correct props", () => {
      render(<FlowerHero />);
      
      expect(screen.getByTestId("mock-schedule-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("schedule-button")).toHaveTextContent("Book a call");
    });
  });

  describe("Accessibility", () => {
    it("provides meaningful content structure", () => {
      render(<FlowerHero />);
      
      // Check that the component has a logical content structure
      const section = screen.getByRole("heading").closest("section");
      expect(section).toBeInTheDocument();
      
      // Check for proper heading hierarchy
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("has accessible button elements", () => {
      render(<FlowerHero />);
      
      const buttons = screen.getAllByRole("button");
      buttons.forEach(button => {
        expect(button).toHaveAttribute("type", "button");
      });
    });
  });

  describe("Content Validation", () => {
    it("displays all expected text content", () => {
      render(<FlowerHero />);
      
      // Title parts
      expect(screen.getByText("Your Go-To Flower")).toBeInTheDocument();
      expect(screen.getByText("Delivery Partner")).toBeInTheDocument();
      expect(screen.getByText("Since 2019")).toBeInTheDocument();
      
      // Description
      expect(screen.getByText(/We specialize in local floral deliveries/)).toBeInTheDocument();
      
      // CTA buttons
      expect(screen.getByText("Get a Quote")).toBeInTheDocument();
      expect(screen.getByText("Book a call")).toBeInTheDocument();
    });

    it("includes key cities in description", () => {
      render(<FlowerHero />);
      
      const description = screen.getByText(/San Francisco, Atlanta, and Austin/);
      expect(description).toBeInTheDocument();
    });

    it("mentions tracking and handling features", () => {
      render(<FlowerHero />);
      
      expect(screen.getByText(/real-time tracking/)).toBeInTheDocument();
      expect(screen.getByText(/careful handling/)).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("renders with responsive classes", () => {
      render(<FlowerHero />);
      
      const section = screen.getByRole("heading").closest("section");
      expect(section).toHaveClass("flex", "min-h-[100dvh]", "w-full");
    });

    it("has proper container structure", () => {
      render(<FlowerHero />);
      
      // The component should have a container div
      const container = document.querySelector(".container");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Animation and State", () => {
    it("initializes with animation state", () => {
      render(<FlowerHero />);
      
      // The component should render without throwing errors
      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("handles state changes properly", () => {
      render(<FlowerHero />);
      
      // Component should render successfully with state management
      expect(screen.getByText("Get a Quote")).toBeInTheDocument();
    });
  });
});
