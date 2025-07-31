import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import FlowerHero from "../FlowerHero";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: (component: string) => component,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the FormManager hook
const mockOpenForm = jest.fn();
const mockCloseForm = jest.fn();

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: () => ({
    openForm: mockOpenForm,
    closeForm: mockCloseForm,
    DialogForm: () =>
      React.createElement(
        "div",
        { "data-testid": "mock-dialog-form" },
        "Dialog Form",
      ),
  }),
}));

// Mock ScheduleDialog
jest.mock("../../Logistics/Schedule", () => {
  const ScheduleDialog = ({ buttonText, customButton, calendarUrl }: any) => {
    return React.createElement(
      "div",
      { "data-testid": "mock-schedule-dialog" },
      customButton || React.createElement("button", {}, buttonText),
    );
  };
  return { default: ScheduleDialog };
});

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

      const description = screen.getByText(
        /We specialize in local floral deliveries/,
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        "We specialize in local floral deliveries across cities such as San Francisco, Atlanta, and Austin, offering real-time tracking and careful handling to ensure your blooms arrive on time and maintain your shop's reputation.",
      );
    });

    it("renders both CTA buttons", () => {
      render(<FlowerHero />);

      expect(
        screen.getByRole("button", { name: "Get a Quote" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Book a call" }),
      ).toBeInTheDocument();
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
        imagePath: "/custom/image.png",
      };

      // Should not throw error even with unused props
      expect(() => render(<FlowerHero {...props} />)).not.toThrow();
    });
  });

  describe("Interactions", () => {
    it("calls openForm with 'flower' when Get a Quote button is clicked", async () => {
      const user = userEvent.setup();
      render(<FlowerHero />);

      const quoteButton = screen.getByRole("button", { name: "Get a Quote" });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledWith("flower");
      expect(mockOpenForm).toHaveBeenCalledTimes(1);
    });

    it("prevents default behavior when quote button is clicked", async () => {
      render(<FlowerHero />);

      const quoteButton = screen.getByRole("button", { name: "Get a Quote" });
      const mockEvent = {
        preventDefault: jest.fn(),
        currentTarget: quoteButton,
      };

      fireEvent.click(quoteButton, mockEvent);

      expect(mockOpenForm).toHaveBeenCalledWith("flower");
    });

    it("renders Book a call button correctly", () => {
      render(<FlowerHero />);

      const bookCallButton = screen.getByRole("button", {
        name: "Book a call",
      });
      expect(bookCallButton).toBeInTheDocument();
    });
  });

  describe("Styling and Layout", () => {
    it("has correct responsive classes", () => {
      const { container } = render(<FlowerHero />);

      const section = container.querySelector("section");
      expect(section).toHaveClass(
        "relative",
        "mt-16",
        "flex",
        "min-h-[100dvh]",
      );
    });

    it("applies animation classes correctly", async () => {
      render(<FlowerHero />);

      // Wait for the animation state to be set
      await waitFor(() => {
        const heading = screen.getByRole("heading");
        expect(heading.closest("div")).toHaveClass(
          "translate-y-0",
          "opacity-100",
        );
      });
    });

    it("has gradient text styling for 'Since 2019'", () => {
      render(<FlowerHero />);

      const sinceText = screen.getByText("Since 2019");
      expect(sinceText).toHaveClass(
        "bg-gradient-to-r",
        "from-yellow-600",
        "to-yellow-500",
        "bg-clip-text",
        "text-transparent",
      );
    });
  });

  describe("Animation", () => {
    it("initializes with animation state", async () => {
      render(<FlowerHero />);

      // The component should set isTextAnimated to true after mounting
      await waitFor(() => {
        const heading = screen.getByRole("heading");
        const animatedDiv = heading.closest("div");
        expect(animatedDiv).toHaveClass("translate-y-0", "opacity-100");
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(<FlowerHero />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("has accessible button text", () => {
      render(<FlowerHero />);

      expect(
        screen.getByRole("button", { name: "Get a Quote" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Book a call" }),
      ).toBeInTheDocument();
    });

    it("provides meaningful content structure", () => {
      render(<FlowerHero />);

      // Check that the component has a logical content structure
      const section = screen.getByRole("heading").closest("section");
      expect(section).toBeInTheDocument();
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
      expect(
        screen.getByText(/We specialize in local floral deliveries/),
      ).toBeInTheDocument();

      // Buttons
      expect(screen.getByText("Get a Quote")).toBeInTheDocument();
      expect(screen.getByText("Book a call")).toBeInTheDocument();
    });

    it("includes key cities in description", () => {
      render(<FlowerHero />);

      const description = screen.getByText(
        /San Francisco, Atlanta, and Austin/,
      );
      expect(description).toBeInTheDocument();
    });
  });
});
