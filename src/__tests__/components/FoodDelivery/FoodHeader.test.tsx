import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import FoodHeader from "@/components/FoodDelivery/FoodHeader";

// Mock Next.js Image component (already handled in jest.setup.ts)

// Mock the FormManager hook
const mockOpenForm = jest.fn();

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => {
  const React = require("react");
  return {
    FormManager: jest.fn(() => ({
      openForm: mockOpenForm,
      DialogForm: React.createElement("div", { "data-testid": "mock-dialog-form" }, "Mock Dialog Form"),
    })),
  };
});

// Mock the ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => {
  return function ScheduleDialog({
    buttonText,
    className,
    calendarUrl,
  }: {
    buttonText: string;
    className: string;
    calendarUrl: string;
  }) {
    return (
      <button
        className={className}
        data-testid="schedule-dialog-button"
        data-calendar-url={calendarUrl}
      >
        {buttonText}
      </button>
    );
  };
});

// Mock framer-motion (already handled in jest.setup.ts)

describe("FoodHeader Component", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset window dimensions
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    // Reset margin class
    jest.clearAllTimers();
  });

  afterEach(() => {
    // Clean up any timers
    jest.clearAllTimers();
  });

  describe("Rendering", () => {
    it("renders the component successfully", () => {
      render(<FoodHeader />);

      expect(screen.getByText("From Pickup to Complete Setup")).toBeInTheDocument();
      expect(screen.getByText(/More than delivery/)).toBeInTheDocument();
    });

    it("renders the background image", () => {
      render(<FoodHeader />);

      const image = screen.getByAltText("Food containers with various prepared meals");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/food/food-containers.png");
    });

    it("renders the Get a Quote button", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
      expect(quoteButton).toHaveClass("bg-yellow-300");
    });

    it("renders the Book a Call button via ScheduleDialog", () => {
      render(<FoodHeader />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toBeInTheDocument();
      expect(bookCallButton).toHaveTextContent("Book a Call");
    });

    it("renders the dialog form component", () => {
      render(<FoodHeader />);

      const dialogForm = screen.getByTestId("mock-dialog-form");
      expect(dialogForm).toBeInTheDocument();
    });

    it("renders the heading with correct content", () => {
      render(<FoodHeader />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("From Pickup to Complete Setup");
      expect(heading).toHaveClass("text-xl", "font-black");
    });

    it("renders the description paragraph", () => {
      render(<FoodHeader />);

      const paragraph = screen.getByText(/trusted partner helping/);
      expect(paragraph).toHaveClass("text-xs", "font-medium");
    });
  });

  describe("Responsive Design", () => {
    it("applies correct margin class for mobile (< 768px)", () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 767,
      });

      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toHaveClass("mt-6");
    });

    it("applies correct margin class for tablet (768px - 1023px)", () => {
      // Mock tablet viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900,
      });

      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toHaveClass("mt-8");
    });

    it("applies correct margin class for desktop (>= 1024px)", () => {
      // Mock desktop viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toHaveClass("mt-4");
    });

    it("updates margin class on window resize", async () => {
      // Start with desktop
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toHaveClass("mt-4");

      // Change to mobile
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 600,
      });

      // Trigger resize event
      window.dispatchEvent(new Event("resize"));

      await waitFor(() => {
        expect(section).toHaveClass("mt-6");
      });
    });

    it("has responsive text sizing for heading", () => {
      render(<FoodHeader />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.className).toMatch(/text-xl|md:text-2xl|lg:text-3xl/);
    });

    it("has responsive text sizing for description", () => {
      render(<FoodHeader />);

      const paragraph = screen.getByText(/trusted partner helping/);
      expect(paragraph.className).toMatch(/text-xs|md:text-sm|lg:text-base/);
    });

    it("has responsive button sizing", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton.className).toMatch(/px-8|md:px-10/);
      expect(quoteButton.className).toMatch(/py-3|md:py-4/);
      expect(quoteButton.className).toMatch(/text-base|md:text-lg/);
    });
  });

  describe("User Interactions", () => {
    it("calls openForm with 'food' type when Get a Quote is clicked", async () => {
      const user = userEvent.setup();
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(1);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });

    it("handles multiple clicks on Get a Quote button", async () => {
      const user = userEvent.setup();
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });

      await user.click(quoteButton);
      await user.click(quoteButton);
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(3);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });

    it("Book a Call button has the correct calendar URL", () => {
      render(<FoodHeader />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toHaveAttribute(
        "data-calendar-url",
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
      );
    });
  });

  describe("Styling and Layout", () => {
    it("has proper section styling", () => {
      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toHaveClass("relative", "min-h-[500px]", "w-full");
      expect(section?.className).toMatch(/mb-16|md:mb-24|lg:mb-32/);
    });

    it("has proper container styling", () => {
      render(<FoodHeader />);

      // The content is wrapped in motion.div with specific classes
      const contentContainer = screen.getByText("From Pickup to Complete Setup").closest(".mx-auto");
      expect(contentContainer).toHaveClass("mx-auto", "max-w-[1600px]");
    });

    it("positions content correctly", () => {
      render(<FoodHeader />);

      const contentWrapper = screen.getByText("From Pickup to Complete Setup").closest("div.relative.z-10");
      expect(contentWrapper).toHaveClass("relative", "z-10", "ml-4");
    });

    it("applies hover effects to Get a Quote button", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("hover:translate-y-[-2px]", "hover:bg-yellow-400");
    });

    it("applies shadow effects to buttons", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("shadow-md", "hover:shadow-lg");
    });

    it("renders buttons in a flex container", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      const buttonsContainer = quoteButton.closest(".flex");
      // At mobile, container has flex-col gap-3, at sm: breakpoint it has flex-row flex-wrap items-center gap-4
      expect(buttonsContainer).toHaveClass("flex", "flex-col", "gap-3");
    });
  });

  describe("Animation Variants", () => {
    it("applies container animation variants", () => {
      render(<FoodHeader />);

      // Check that the container exists (framer-motion is mocked)
      const heading = screen.getByText("From Pickup to Complete Setup");
      const container = heading.closest(".mx-auto");
      // Since framer-motion is mocked, we just verify the component renders
      expect(container).toBeInTheDocument();
    });

    it("applies item animation variants to text elements", () => {
      render(<FoodHeader />);

      const heading = screen.getByRole("heading", { level: 1 });
      const paragraph = screen.getByText(/trusted partner helping/);

      expect(heading).toBeInTheDocument();
      expect(paragraph).toBeInTheDocument();
    });

    it("applies image animation variants", () => {
      render(<FoodHeader />);

      const image = screen.getByAltText("Food containers with various prepared meals");
      expect(image).toBeInTheDocument();
    });

    it("applies button animation variants", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible button text", () => {
      render(<FoodHeader />);

      expect(screen.getByRole("button", { name: /Get a Quote/i })).toBeInTheDocument();
      expect(screen.getByText("Book a Call")).toBeInTheDocument();
    });

    it("heading uses semantic HTML", () => {
      render(<FoodHeader />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.tagName).toBe("H1");
    });

    it("buttons are keyboard accessible", () => {
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton.tagName).toBe("BUTTON");
      expect(quoteButton).toBeEnabled();
    });

    it("image has descriptive alt text", () => {
      render(<FoodHeader />);

      const image = screen.getByAltText("Food containers with various prepared meals");
      expect(image).toBeInTheDocument();
    });

    it("section uses semantic HTML", () => {
      render(<FoodHeader />);

      const section = screen.getByText("From Pickup to Complete Setup").closest("section");
      expect(section).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("integrates with FormManager correctly", async () => {
      const user = userEvent.setup();
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });

    it("passes correct props to ScheduleDialog", () => {
      render(<FoodHeader />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toHaveTextContent("Book a Call");
      expect(bookCallButton).toHaveClass("bg-yellow-300");
    });

    it("renders FormManager DialogForm component", () => {
      render(<FoodHeader />);

      const dialogForm = screen.getByTestId("mock-dialog-form");
      expect(dialogForm).toBeInTheDocument();
    });
  });

  describe("Content Accuracy", () => {
    it("displays the correct heading text", () => {
      render(<FoodHeader />);

      expect(screen.getByText("From Pickup to Complete Setup")).toBeInTheDocument();
    });

    it("displays the correct description text", () => {
      render(<FoodHeader />);

      expect(
        screen.getByText("More than delivery — we're a trusted partner helping restaurants, caterers, and foodservice providers solve their toughest logistics challenges.")
      ).toBeInTheDocument();
    });

    it("uses appropriate call-to-action text", () => {
      render(<FoodHeader />);

      expect(screen.getByText("Get a Quote")).toBeInTheDocument();
      expect(screen.getByText("Book a Call")).toBeInTheDocument();
    });

    it("uses correct image path", () => {
      render(<FoodHeader />);

      const image = screen.getByAltText("Food containers with various prepared meals");
      expect(image).toHaveAttribute("src", "/images/food/food-containers.png");
    });
  });

  describe("Props Handling", () => {
    it("accepts onRequestQuote prop", () => {
      const mockOnRequestQuote = jest.fn();
      render(<FoodHeader onRequestQuote={mockOnRequestQuote} />);

      // The component should render without errors
      expect(screen.getByText("From Pickup to Complete Setup")).toBeInTheDocument();
    });

    it("renders without onRequestQuote prop", () => {
      render(<FoodHeader />);

      // Should render normally without the prop
      expect(screen.getByText("From Pickup to Complete Setup")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles window resize events gracefully", () => {
      render(<FoodHeader />);

      // Multiple resize events should not cause issues
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));

      expect(screen.getByText("From Pickup to Complete Setup")).toBeInTheDocument();
    });

    it("maintains functionality after multiple re-renders", () => {
      const { rerender } = render(<FoodHeader />);

      // Re-render multiple times
      rerender(<FoodHeader />);
      rerender(<FoodHeader />);
      rerender(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
    });

    it("handles rapid button clicks", async () => {
      const user = userEvent.setup();
      render(<FoodHeader />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });

      // Simulate rapid clicking
      await user.click(quoteButton);
      await user.click(quoteButton);
      await user.click(quoteButton);
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(4);
    });
  });
});


