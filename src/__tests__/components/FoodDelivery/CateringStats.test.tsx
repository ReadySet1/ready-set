import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CateringStats from "@/components/FoodDelivery/CateringStats";

// Mock the FormManager hook
const mockOpenForm = jest.fn();
const mockDialogForm = <div data-testid="mock-dialog-form">Mock Dialog Form</div>;

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: jest.fn(() => ({
    openForm: mockOpenForm,
    DialogForm: mockDialogForm,
  })),
}));

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

describe("CateringStats Component", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the component successfully", () => {
      render(<CateringStats />);
      expect(screen.getByText(/Since 2019/)).toBeInTheDocument();
    });

    it("displays the correct statistics heading", () => {
      render(<CateringStats />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Since 2019, we've completed over");
      expect(heading).toHaveTextContent("338,000");
      expect(heading).toHaveTextContent("successful catering deliveries with");
      expect(heading).toHaveTextContent("350+");
      expect(heading).toHaveTextContent("restaurant partners.");
    });

    it("highlights statistics numbers in yellow", () => {
      render(<CateringStats />);

      const statsNumbers = screen.getAllByText(/338,000|350\+/);
      statsNumbers.forEach((stat) => {
        expect(stat).toHaveClass("text-yellow-500");
      });
    });

    it("renders the Get a Quote button", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
      expect(quoteButton).toHaveClass("bg-yellow-500");
    });

    it("renders the Book a Call button via ScheduleDialog", () => {
      render(<CateringStats />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toBeInTheDocument();
      expect(bookCallButton).toHaveTextContent("Book a Call");
    });

    it("renders the dialog form component", () => {
      render(<CateringStats />);

      const dialogForm = screen.getByTestId("mock-dialog-form");
      expect(dialogForm).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls openForm with 'food' type when Get a Quote is clicked", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      fireEvent.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(1);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });

    it("logs console message when Get a Quote is clicked", () => {
      const consoleLogSpy = jest.spyOn(console, "log");

      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      fireEvent.click(quoteButton);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "CateringStats - Get a quote clicked"
      );

      consoleLogSpy.mockRestore();
    });

    it("Book a Call button has the correct calendar URL", () => {
      render(<CateringStats />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toHaveAttribute(
        "data-calendar-url",
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
      );
    });
  });

  describe("Styling and Layout", () => {
    it("has proper section styling", () => {
      const { container } = render(<CateringStats />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("w-full", "bg-white");
      expect(section?.className).toMatch(/py-12|py-16|py-20/);
    });

    it("has proper container styling", () => {
      render(<CateringStats />);

      // The heading is nested within the container structure
      const heading = screen.getByRole("heading", { level: 2 });
      const container = heading.closest(".mx-auto");

      expect(container).toHaveClass("mx-auto", "max-w-7xl");
    });

    it("centers content appropriately", () => {
      render(<CateringStats />);

      const heading = screen.getByRole("heading", { level: 2 });
      const parentDiv = heading.closest(".text-center");

      expect(parentDiv).toHaveClass("text-center");
    });

    it("applies hover styles to Get a Quote button", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass(
        "transition-all",
        "duration-200",
        "hover:bg-yellow-400"
      );
    });

    it("applies focus styles to Get a Quote button", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass(
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-yellow-300",
        "focus:ring-offset-2"
      );
    });

    it("renders buttons in a flex container", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      const buttonsContainer = quoteButton.closest(".flex");

      expect(buttonsContainer).toHaveClass("flex");
      expect(buttonsContainer?.className).toMatch(/gap-4|gap-6/);
    });
  });

  describe("Responsive Design", () => {
    it("has responsive text sizing for heading", () => {
      render(<CateringStats />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.className).toMatch(/text-2xl|text-3xl|text-4xl/);
      expect(heading.className).toMatch(/sm:|md:/);
    });

    it("has responsive padding for section", () => {
      const { container } = render(<CateringStats />);

      const section = container.querySelector("section");
      expect(section?.className).toMatch(/py-12|md:py-16|lg:py-20/);
    });

    it("has responsive button layout", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      const buttonsContainer = quoteButton.closest(".flex");

      expect(buttonsContainer?.className).toMatch(/flex-col|sm:flex-row/);
    });

    it("has responsive button sizing", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton.className).toMatch(/w-full|sm:w-auto/);
      expect(quoteButton.className).toMatch(/py-3|sm:py-4/);
      expect(quoteButton.className).toMatch(/text-base|sm:text-lg/);
    });
  });

  describe("Accessibility", () => {
    it("has accessible button text", () => {
      render(<CateringStats />);

      expect(
        screen.getByRole("button", { name: /Get a Quote/i })
      ).toBeInTheDocument();
      expect(screen.getByText("Book a Call")).toBeInTheDocument();
    });

    it("heading uses semantic HTML", () => {
      render(<CateringStats />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.tagName).toBe("H2");
    });

    it("buttons are keyboard accessible", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton.tagName).toBe("BUTTON");
    });

    it("section uses semantic HTML", () => {
      const { container } = render(<CateringStats />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });
  });

  describe("Content Accuracy", () => {
    it("displays the correct year in statistics", () => {
      render(<CateringStats />);

      expect(screen.getByText(/Since 2019/)).toBeInTheDocument();
    });

    it("displays the correct number of deliveries", () => {
      render(<CateringStats />);

      expect(screen.getByText("338,000")).toBeInTheDocument();
    });

    it("displays the correct number of restaurant partners", () => {
      render(<CateringStats />);

      expect(screen.getByText("350+")).toBeInTheDocument();
    });

    it("uses appropriate call-to-action text", () => {
      render(<CateringStats />);

      expect(screen.getByText("Get a Quote")).toBeInTheDocument();
      expect(screen.getByText("Book a Call")).toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("integrates with FormManager correctly", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      fireEvent.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalled();
    });

    it("passes correct props to ScheduleDialog", () => {
      render(<CateringStats />);

      const bookCallButton = screen.getByTestId("schedule-dialog-button");
      expect(bookCallButton).toHaveTextContent("Book a Call");
      expect(bookCallButton).toHaveClass("bg-yellow-500");
    });
  });

  describe("Edge Cases", () => {
    it("renders without crashing when FormManager returns null", () => {
      const { FormManager } = require("@/components/Logistics/QuoteRequest/Quotes/FormManager");
      FormManager.mockImplementationOnce(() => ({
        openForm: jest.fn(),
        DialogForm: null,
      }));

      expect(() => render(<CateringStats />)).not.toThrow();
    });

    it("handles multiple rapid clicks on Get a Quote button", () => {
      render(<CateringStats />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });

      fireEvent.click(quoteButton);
      fireEvent.click(quoteButton);
      fireEvent.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(3);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });
  });
});
