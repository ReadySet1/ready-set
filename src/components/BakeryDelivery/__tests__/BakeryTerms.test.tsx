import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import BakeryTerms from "../BakeryTerms";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

// Mock dependencies
jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: jest.fn(),
}));

jest.mock("@/components/Logistics/Schedule", () => {
  return function MockScheduleDialog({
    buttonText,
    className,
    calendarUrl,
  }: {
    buttonText?: string;
    className?: string;
    calendarUrl: string;
  }) {
    return (
      <button
        className={className}
        data-testid="schedule-dialog-button"
        data-calendar-url={calendarUrl}
      >
        {buttonText || "Schedule a Call"}
      </button>
    );
  };
});

// Mock cloudinary is already set up in jest.setup.ts
// It returns `/images/${publicId}` for getCloudinaryUrl

describe("BakeryTerms", () => {
  // Default mock implementation for FormManager
  const mockOpenForm = jest.fn();
  const mockCloseForm = jest.fn();
  const mockDialogForm = <div data-testid="mock-dialog-form">Dialog Form</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    (FormManager as jest.Mock).mockReturnValue({
      openForm: mockOpenForm,
      closeForm: mockCloseForm,
      DialogForm: mockDialogForm,
    });
  });

  describe("Rendering - Bakery Variant", () => {
    it("should render without crashing with bakery variant", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      expect(container).toBeInTheDocument();
    });

    it("should render the background image with correct source", () => {
      render(<BakeryTerms variant="bakery" />);
      const image = screen.getByAltText("Food dishes");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/food/food-dishes");
    });

    it("should render the background image with priority loading", () => {
      render(<BakeryTerms variant="bakery" />);
      const image = screen.getByAltText("Food dishes");
      expect(image).toHaveAttribute("data-priority", "true");
    });

    it("should render the heading for bakery variant", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(
        screen.getByText(/Package Delivery Terms/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/& Pricing Chart/i)).toBeInTheDocument();
    });

    it("should render Get a Quote button", () => {
      render(<BakeryTerms variant="bakery" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
      expect(quoteButton).toHaveClass("bg-yellow-500");
    });

    it("should render Book a Call button", () => {
      render(<BakeryTerms variant="bakery" />);
      const bookButton = screen.getByText("Book a Call");
      expect(bookButton).toBeInTheDocument();
      expect(bookButton).toHaveAttribute(
        "data-calendar-url",
        expect.stringContaining("calendar.google.com"),
      );
    });

    it("should render all bakery terms list items", () => {
      render(<BakeryTerms variant="bakery" />);

      expect(
        screen.getByText(/Maximum order of 10 packages per route/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Fees are based on the delivery zone/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Toll will be charged regardless of the direction/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/default terms are to be paid on a net 7/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Late payments are the greater of 3.5%/i),
      ).toBeInTheDocument();
    });

    it("should render the DialogForm component", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(screen.getByTestId("mock-dialog-form")).toBeInTheDocument();
    });
  });

  describe("Rendering - Vendor Variant", () => {
    it("should render without crashing with vendor variant", () => {
      const { container } = render(<BakeryTerms variant="vendor" />);
      expect(container).toBeInTheDocument();
    });

    it("should render the heading for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      expect(
        screen.getByText(/Package Delivery Terms/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/& Pricing Chart/i)).toBeInTheDocument();
    });

    it("should render vendor-specific sections", () => {
      render(<BakeryTerms variant="vendor" />);

      expect(screen.getByText("Headcount vs Food Cost")).toBeInTheDocument();
      expect(screen.getByText("Mileage Rate")).toBeInTheDocument();
      expect(screen.getByText("Daily Drive Discount")).toBeInTheDocument();
    });

    it("should render mileage rate information", () => {
      render(<BakeryTerms variant="vendor" />);
      expect(screen.getByText(/\$3\.00 per mile after 10 miles/i)).toBeInTheDocument();
    });

    it("should render daily drive discount tiers", () => {
      render(<BakeryTerms variant="vendor" />);
      expect(screen.getByText(/2 Drives\/Day-\$5\/drive/i)).toBeInTheDocument();
      expect(screen.getByText(/3 Drives\/Day-\$10\/drive/i)).toBeInTheDocument();
      expect(screen.getByText(/4 Drives\/Day-\$15\/drive/i)).toBeInTheDocument();
    });

    it("should render vendor-specific terms (numbered list)", () => {
      render(<BakeryTerms variant="vendor" />);

      expect(
        screen.getByText(/batched together with the same driver/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Hosting events requires advanced notice/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Default terms are to be paid on a NET 7/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Late payments are the greater amount to an interest rate of 2.5%/i),
      ).toBeInTheDocument();
    });

    it("should render two Get a Quote buttons for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      const quoteButtons = screen.getAllByRole("button", {
        name: /Get a Quote/i,
      });
      expect(quoteButtons).toHaveLength(1); // Only one in the top section
    });

    it("should render two Book a Call buttons for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      const bookButtons = screen.getAllByText("Book a Call");
      expect(bookButtons).toHaveLength(1);
    });

    it("should render Hosting Services button for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      const hostingButton = screen.getByText(/Hosting Services\? Let's Talk/i);
      expect(hostingButton).toBeInTheDocument();
    });
  });

  describe("User Interactions - Get a Quote", () => {
    it("should call openForm with default formType when Get a Quote is clicked without formType prop", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms variant="bakery" />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(1);
      expect(mockOpenForm).toHaveBeenCalledWith("bakery");
    });

    it("should call openForm with provided formType when Get a Quote is clicked", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms variant="bakery" formType="food" />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(1);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });

    it("should call onRequestQuote callback when provided", async () => {
      const user = userEvent.setup();
      const mockOnRequestQuote = jest.fn();
      render(
        <BakeryTerms
          variant="bakery"
          formType="specialty"
          onRequestQuote={mockOnRequestQuote}
        />,
      );

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOnRequestQuote).toHaveBeenCalledTimes(1);
      expect(mockOnRequestQuote).toHaveBeenCalledWith("specialty");
      expect(mockOpenForm).toHaveBeenCalledWith("specialty");
    });

    it("should work correctly when onRequestQuote is not provided", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms variant="bakery" formType="flower" />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledWith("flower");
    });
  });

  describe("Props and Variants", () => {
    it("should default to bakery variant when no variant prop is provided", () => {
      render(<BakeryTerms />);
      // Bakery variant specific content
      expect(
        screen.getByText(/Maximum order of 10 packages per route/i),
      ).toBeInTheDocument();
      // Should NOT have vendor-specific content
      expect(screen.queryByText("Headcount vs Food Cost")).not.toBeInTheDocument();
    });

    it("should default to bakery formType when no formType prop is provided", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledWith("bakery");
    });

    it("should render vendor content when variant is vendor", () => {
      render(<BakeryTerms variant="vendor" />);
      expect(screen.getByText("Headcount vs Food Cost")).toBeInTheDocument();
    });

    it("should not render vendor content when variant is bakery", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(screen.queryByText("Headcount vs Food Cost")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible Get a Quote button", () => {
      render(<BakeryTerms variant="bakery" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toBeInTheDocument();
    });

    it("should have proper focus styles on Get a Quote button", () => {
      render(<BakeryTerms variant="bakery" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("focus:outline-none");
      expect(quoteButton).toHaveClass("focus:ring-2");
    });

    it("should have proper alt text for images", () => {
      render(<BakeryTerms variant="bakery" />);
      const image = screen.getByAltText("Food dishes");
      expect(image).toBeInTheDocument();
    });

    it("should render semantic HTML structure", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      const heading = screen.getByRole("heading", {
        name: /Package Delivery Terms/i,
      });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });
  });

  describe("Styling and Layout", () => {
    it("should apply correct container classes for bakery variant", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      const darkContainer = container.querySelector(".bg-gray-900");
      expect(darkContainer).toBeInTheDocument();
      expect(darkContainer).toHaveClass("rounded-2xl");
    });

    it("should apply correct container classes for vendor variant", () => {
      const { container } = render(<BakeryTerms variant="vendor" />);
      const borderedContainer = container.querySelector(".border-gray-300");
      expect(borderedContainer).toBeInTheDocument();
    });

    it("should have responsive text sizing classes", () => {
      render(<BakeryTerms variant="bakery" />);
      const heading = screen.getByRole("heading", {
        name: /Package Delivery Terms/i,
      });
      expect(heading).toHaveClass("text-xl");
      expect(heading).toHaveClass("md:text-5xl");
    });

    it("should apply yellow-500 background to buttons for bakery variant", () => {
      render(<BakeryTerms variant="bakery" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("bg-yellow-500");
    });

    it("should apply yellow-400 background to buttons for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("bg-yellow-400");
    });
  });

  describe("Content Verification", () => {
    it("should render all 5 bakery terms", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      const listItems = container.querySelectorAll("ul > li");
      expect(listItems).toHaveLength(5);
    });

    it("should render correct calendar URL in ScheduleDialog", () => {
      render(<BakeryTerms variant="bakery" />);
      const bookButton = screen.getByText("Book a Call");
      expect(bookButton).toHaveAttribute(
        "data-calendar-url",
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true",
      );
    });

    it("should display pricing information for bakery variant", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(screen.getByText(/net 7/i)).toBeInTheDocument();
      expect(screen.getByText(/3\.5%/i)).toBeInTheDocument();
    });

    it("should display pricing information for vendor variant", () => {
      render(<BakeryTerms variant="vendor" />);
      expect(screen.getByText(/NET 7/i)).toBeInTheDocument();
      expect(screen.getByText(/2\.5%/i)).toBeInTheDocument();
    });
  });

  describe("FormManager Integration", () => {
    it("should call FormManager hook on component mount", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(FormManager).toHaveBeenCalledTimes(1);
    });

    it("should render the DialogForm returned by FormManager", () => {
      render(<BakeryTerms variant="bakery" />);
      expect(screen.getByTestId("mock-dialog-form")).toBeInTheDocument();
    });

    it("should handle FormManager with different form types", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <BakeryTerms variant="bakery" formType="bakery" />,
      );

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);
      expect(mockOpenForm).toHaveBeenCalledWith("bakery");

      jest.clearAllMocks();

      rerender(<BakeryTerms variant="vendor" formType="food" />);
      const quoteButton2 = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton2);
      expect(mockOpenForm).toHaveBeenCalledWith("food");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined formType gracefully", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms variant="bakery" formType={undefined} />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      // Should default to "bakery" when formType is undefined
      expect(mockOpenForm).toHaveBeenCalledWith("bakery");
    });

    it("should handle rapid clicks on Get a Quote button", async () => {
      const user = userEvent.setup();
      render(<BakeryTerms variant="bakery" formType="specialty" />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);
      await user.click(quoteButton);
      await user.click(quoteButton);

      expect(mockOpenForm).toHaveBeenCalledTimes(3);
      expect(mockOpenForm).toHaveBeenCalledWith("specialty");
    });

    it("should maintain component state after interactions", async () => {
      const user = userEvent.setup();
      const { container } = render(<BakeryTerms variant="bakery" />);

      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      await user.click(quoteButton);

      // Component should still be rendered after interaction
      expect(container).toBeInTheDocument();
      expect(screen.getByTestId("mock-dialog-form")).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should have responsive padding classes", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      const whiteContainer = container.querySelector(".bg-white");
      expect(whiteContainer).toHaveClass("p-4");
      expect(whiteContainer).toHaveClass("md:p-8");
    });

    it("should have responsive grid layout for vendor variant", () => {
      const { container } = render(<BakeryTerms variant="vendor" />);
      const gridContainer = container.querySelector(".md\\:grid-cols-2");
      expect(gridContainer).toBeInTheDocument();
    });

    it("should have responsive button sizing", () => {
      render(<BakeryTerms variant="bakery" />);
      const quoteButton = screen.getByRole("button", { name: /Get a Quote/i });
      expect(quoteButton).toHaveClass("px-4");
      expect(quoteButton).toHaveClass("md:px-6");
      expect(quoteButton).toHaveClass("py-2");
      expect(quoteButton).toHaveClass("md:py-3");
    });
  });

  describe("Type Safety", () => {
    it("should accept valid variant values", () => {
      expect(() => render(<BakeryTerms variant="bakery" />)).not.toThrow();
      expect(() => render(<BakeryTerms variant="vendor" />)).not.toThrow();
    });

    it("should accept valid formType values", () => {
      expect(() =>
        render(<BakeryTerms formType="bakery" />),
      ).not.toThrow();
      expect(() => render(<BakeryTerms formType="food" />)).not.toThrow();
      expect(() =>
        render(<BakeryTerms formType="flower" />),
      ).not.toThrow();
      expect(() =>
        render(<BakeryTerms formType="specialty" />),
      ).not.toThrow();
    });

    it("should accept onRequestQuote callback", () => {
      const mockCallback = jest.fn();
      expect(() =>
        render(<BakeryTerms onRequestQuote={mockCallback} />),
      ).not.toThrow();
    });
  });

  describe("Snapshot Tests", () => {
    it("should match snapshot for bakery variant", () => {
      const { container } = render(<BakeryTerms variant="bakery" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot for vendor variant", () => {
      const { container } = render(<BakeryTerms variant="vendor" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match snapshot with all props", () => {
      const mockCallback = jest.fn();
      const { container } = render(
        <BakeryTerms
          variant="vendor"
          formType="food"
          onRequestQuote={mockCallback}
        />,
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});

