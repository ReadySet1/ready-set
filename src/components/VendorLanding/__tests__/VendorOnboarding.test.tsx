import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorOnboarding from "../VendorOnboarding";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock Cloudinary utility
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: jest.fn((path: string) => `https://cloudinary.test/${path}`),
}));

// Mock ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => ({
  __esModule: true,
  default: ({ buttonText, dialogTitle, dialogDescription, calendarUrl, customButton }: any) => (
    <div data-testid="schedule-dialog">
      <div data-testid="dialog-button-text">{buttonText}</div>
      <div data-testid="dialog-title">{dialogTitle}</div>
      <div data-testid="dialog-description">{dialogDescription}</div>
      <div data-testid="dialog-calendar-url">{calendarUrl}</div>
      {customButton && <div data-testid="custom-button">{customButton}</div>}
    </div>
  ),
}));

describe("VendorOnboarding", () => {
  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<VendorOnboarding />);
      expect(container).toBeInTheDocument();
    });

    it("should render the section element", () => {
      const { container } = render(<VendorOnboarding />);
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("should render main heading", () => {
      render(<VendorOnboarding />);
      expect(screen.getByText("How to Get Started")).toBeInTheDocument();
    });

    it("should render subtitle description", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          "We make setup simple so you can focus on your catering operations."
        )
      ).toBeInTheDocument();
    });

    it("should render secondary heading", () => {
      render(<VendorOnboarding />);
      expect(screen.getByText("Order Setup & Scheduling")).toBeInTheDocument();
    });
  });

  describe("Timeline Steps", () => {
    it("should render all 4 timeline steps", () => {
      const { container } = render(<VendorOnboarding />);
      const listItems = container.querySelectorAll("ol li");
      expect(listItems).toHaveLength(4);
    });

    it("should render numbered circles for each step", () => {
      const { container } = render(<VendorOnboarding />);
      const numbers = container.querySelectorAll('ol li span[aria-hidden="true"]');
      // Should have 5 total spans: 1 connecting line + 4 numbered circles
      expect(numbers.length).toBeGreaterThanOrEqual(4);
    });

    describe("Step 1: Book a Consult", () => {
      it("should render the title", () => {
        render(<VendorOnboarding />);
        expect(screen.getByText("Book a Consult")).toBeInTheDocument();
      });

      it("should render the description", () => {
        render(<VendorOnboarding />);
        expect(
          screen.getByText(
            "Discuss your delivery needs and see how our service fits your operation."
          )
        ).toBeInTheDocument();
      });
    });

    describe("Step 2: Get Onboarded", () => {
      it("should render the title", () => {
        render(<VendorOnboarding />);
        expect(screen.getByText("Get Onboarded")).toBeInTheDocument();
      });

      it("should render the description", () => {
        render(<VendorOnboarding />);
        expect(
          screen.getByText(
            "Sign the Vendor Agreement and receive your onboarding guide."
          )
        ).toBeInTheDocument();
      });
    });

    describe("Step 3: Create Your Account", () => {
      it("should render the title", () => {
        render(<VendorOnboarding />);
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      it("should render the description", () => {
        render(<VendorOnboarding />);
        expect(
          screen.getByText(
            "Set up your account to access your delivery dashboard; our Helpdesk will help you get everything set up."
          )
        ).toBeInTheDocument();
      });
    });

    describe("Step 4: Start Sending Orders", () => {
      it("should render the title", () => {
        render(<VendorOnboarding />);
        expect(screen.getByText("Start Sending Orders")).toBeInTheDocument();
      });

      it("should render the description", () => {
        render(<VendorOnboarding />);
        expect(
          screen.getByText(
            "Begin placing catering delivery orders with reliable, professional drivers."
          )
        ).toBeInTheDocument();
      });
    });

    it("should render timeline steps in correct order", () => {
      const { container } = render(<VendorOnboarding />);
      const stepTitles = Array.from(
        container.querySelectorAll("ol li h3")
      ).map((el) => el.textContent);

      expect(stepTitles).toEqual([
        "Book a Consult",
        "Get Onboarded",
        "Create Your Account",
        "Start Sending Orders",
      ]);
    });
  });

  describe("ScheduleDialog Integration", () => {
    it("should render ScheduleDialog component", () => {
      render(<VendorOnboarding />);
      expect(screen.getByTestId("schedule-dialog")).toBeInTheDocument();
    });

    it("should pass correct buttonText prop", () => {
      render(<VendorOnboarding />);
      expect(screen.getByTestId("dialog-button-text")).toHaveTextContent(
        "Get Started"
      );
    });

    it("should pass correct dialogTitle prop", () => {
      render(<VendorOnboarding />);
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "Schedule Your Consultation"
      );
    });

    it("should pass correct dialogDescription prop", () => {
      render(<VendorOnboarding />);
      expect(screen.getByTestId("dialog-description")).toHaveTextContent(
        "Choose a convenient time to discuss your catering delivery needs."
      );
    });

    it("should pass correct calendarUrl prop", () => {
      render(<VendorOnboarding />);
      expect(screen.getByTestId("dialog-calendar-url")).toHaveTextContent(
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
      );
    });

    it("should render custom button with correct styling", () => {
      render(<VendorOnboarding />);
      const customButton = screen.getByTestId("custom-button");
      expect(customButton).toBeInTheDocument();
      
      const button = customButton.querySelector("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Get Started");
      expect(button).toHaveClass("bg-yellow-400");
    });
  });

  describe("Image Rendering", () => {
    it("should render image with default props", () => {
      render(<VendorOnboarding />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toBeInTheDocument();
    });

    it("should use default Cloudinary URL when no imageSrc provided", () => {
      render(<VendorOnboarding />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toHaveAttribute(
        "src",
        "https://cloudinary.test/food/food-delivery"
      );
    });

    it("should use custom imageSrc when provided", () => {
      render(
        <VendorOnboarding imageSrc="https://example.com/custom-image.jpg" />
      );
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toHaveAttribute("src", "https://example.com/custom-image.jpg");
    });

    it("should use custom imageAlt when provided", () => {
      render(<VendorOnboarding imageAlt="Custom alt text" />);
      const image = screen.getByAltText("Custom alt text");
      expect(image).toBeInTheDocument();
    });

    it("should render image with correct sizes attribute", () => {
      render(<VendorOnboarding />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toHaveAttribute("sizes", "(max-width: 1024px) 100vw, 560px");
    });
  });

  describe("Order Setup & Scheduling Information", () => {
    it("should render all order submission guidelines", () => {
      const { container } = render(<VendorOnboarding />);
      const listItems = container.querySelectorAll("ul li");
      // There should be 6 list items in the order setup section
      expect(listItems.length).toBeGreaterThanOrEqual(6);
      expect(container.textContent).toContain(
        "Orders should be submitted at least one week in advance"
      );
    });

    it("should display advance notice requirement", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          /Orders should be submitted at least one week in advance/i
        )
      ).toBeInTheDocument();
    });

    it("should display late submission policy", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(/Late submissions may be accepted with a minimum of 24/i)
      ).toBeInTheDocument();
    });

    it("should display same-day delivery disclaimer", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          /We accept same-day delivery requests; however, we cannot guarantee driver availability/i
        )
      ).toBeInTheDocument();
    });

    it("should display backup driver information", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          /Backup drivers may be available, but are not guaranteed/i
        )
      ).toBeInTheDocument();
    });

    it("should display order submission methods", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          /Orders may be submitted via your website dashboard, Slack, text/i
        )
      ).toBeInTheDocument();
    });

    it("should display support team confirmation message", () => {
      render(<VendorOnboarding />);
      expect(
        screen.getByText(
          /Our support team will confirm each order and verify all delivery details/i
        )
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should render ordered list with proper semantics", () => {
      const { container } = render(<VendorOnboarding />);
      const orderedList = container.querySelector("ol");
      expect(orderedList).toBeInTheDocument();
    });

    it("should use semantic heading hierarchy", () => {
      const { container } = render(<VendorOnboarding />);
      const h2Elements = container.querySelectorAll("h2");
      const h3Elements = container.querySelectorAll("h3");
      
      expect(h2Elements.length).toBeGreaterThanOrEqual(2);
      expect(h3Elements).toHaveLength(4); // One for each timeline step
    });

    it("should mark decorative elements with aria-hidden", () => {
      const { container } = render(<VendorOnboarding />);
      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      
      // Timeline connector line + 4 numbered circles = 5 decorative elements
      expect(decorativeElements.length).toBeGreaterThanOrEqual(5);
    });

    it("should use proper list markup for order setup information", () => {
      const { container } = render(<VendorOnboarding />);
      const unorderedLists = container.querySelectorAll("ul");
      expect(unorderedLists.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Responsive Design", () => {
    it("should apply responsive typography classes", () => {
      const { container } = render(<VendorOnboarding />);
      const mainHeading = screen.getByText("How to Get Started");
      
      expect(mainHeading).toHaveClass("text-xl");
      expect(mainHeading).toHaveClass("sm:text-2xl");
    });

    it("should apply responsive padding to section", () => {
      const { container } = render(<VendorOnboarding />);
      const section = container.querySelector("section");
      
      expect(section).toHaveClass("py-12");
      expect(section).toHaveClass("sm:py-16");
    });

    it("should apply responsive grid layout", () => {
      const { container } = render(<VendorOnboarding />);
      const gridContainer = container.querySelector(".lg\\:grid-cols-\\[1fr_1\\.05fr\\]");
      
      expect(gridContainer).toBeInTheDocument();
    });

    it("should have responsive image container heights", () => {
      const { container } = render(<VendorOnboarding />);
      const imageContainer = container.querySelector(".h-\\[220px\\]");
      
      expect(imageContainer).toBeInTheDocument();
      expect(imageContainer).toHaveClass("sm:h-[260px]");
      expect(imageContainer).toHaveClass("md:h-[320px]");
    });
  });

  describe("Component Structure", () => {
    it("should render two main sections in grid layout", () => {
      const { container } = render(<VendorOnboarding />);
      const gridChildren = container.querySelector(".lg\\:grid-cols-\\[1fr_1\\.05fr\\]")?.children;
      
      expect(gridChildren).toHaveLength(2);
    });

    it("should apply correct order classes for responsive layout", () => {
      const { container } = render(<VendorOnboarding />);
      const orderFirst = container.querySelector(".lg\\:order-1");
      const orderSecond = container.querySelector(".lg\\:order-2");
      
      expect(orderFirst).toBeInTheDocument();
      expect(orderSecond).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined imageSrc gracefully", () => {
      render(<VendorOnboarding imageSrc={undefined} />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toHaveAttribute(
        "src",
        "https://cloudinary.test/food/food-delivery"
      );
    });

    it("should handle undefined imageAlt gracefully", () => {
      render(<VendorOnboarding imageAlt={undefined} />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toBeInTheDocument();
    });

    it("should handle empty string imageSrc", () => {
      // Empty string for imageSrc will cause React warnings but component should still render
      render(<VendorOnboarding imageSrc="" />);
      const image = screen.getByAltText("Vendor delivering catered food");
      expect(image).toBeInTheDocument();
    });

    it("should handle empty string imageAlt", () => {
      render(<VendorOnboarding imageAlt="" />);
      const image = screen.getByAltText("");
      expect(image).toBeInTheDocument();
    });
  });

  describe("Content Verification", () => {
    it("should render all expected text content", () => {
      const { container } = render(<VendorOnboarding />);
      const text = container.textContent;

      // Verify key phrases are present
      expect(text).toContain("How to Get Started");
      expect(text).toContain("Book a Consult");
      expect(text).toContain("Get Onboarded");
      expect(text).toContain("Create Your Account");
      expect(text).toContain("Start Sending Orders");
      expect(text).toContain("Order Setup & Scheduling");
      expect(text).toContain("Get Started"); // Button text
    });

    it("should not render any placeholder or debug text", () => {
      const { container } = render(<VendorOnboarding />);
      const text = container.textContent || "";

      expect(text).not.toContain("TODO");
      expect(text).not.toContain("FIXME");
      expect(text).not.toContain("DEBUG");
      expect(text).not.toContain("test");
      expect(text).not.toMatch(/lorem ipsum/i);
    });
  });

  describe("Snapshot Testing", () => {
    it("should match snapshot with default props", () => {
      const { container } = render(<VendorOnboarding />);
      expect(container).toMatchSnapshot();
    });

    it("should match snapshot with custom props", () => {
      const { container } = render(
        <VendorOnboarding
          imageSrc="https://example.com/custom.jpg"
          imageAlt="Custom image description"
        />
      );
      expect(container).toMatchSnapshot();
    });
  });
});

