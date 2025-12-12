import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorHero, { VendorHeroProps } from "../VendorHero";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    priority,
    fill,
    sizes,
    className,
  }: {
    src: string;
    alt: string;
    priority?: boolean;
    fill?: boolean;
    sizes?: string;
    className?: string;
  }) => (
    <img
      src={src}
      alt={alt}
      data-priority={priority}
      data-fill={fill}
      data-sizes={sizes}
      className={className}
    />
  ),
}));

// Mock Cloudinary utility
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: jest.fn((publicId: string, options?: any) => {
    return `/images/${publicId}`;
  }),
}));

// Mock ScheduleDialog component
jest.mock("@/components/Logistics/Schedule", () => {
  return {
    __esModule: true,
    default: function MockScheduleDialog({
      buttonText,
      dialogTitle,
      dialogDescription,
      calendarUrl,
      customButton,
      className,
    }: {
      buttonText: string;
      dialogTitle: string;
      dialogDescription: string;
      calendarUrl: string;
      customButton?: React.ReactNode;
      className?: string;
    }) {
      return (
        <div data-testid="schedule-dialog" className={className}>
          <div data-testid="schedule-dialog-button-text">{buttonText}</div>
          <div data-testid="schedule-dialog-title">{dialogTitle}</div>
          <div data-testid="schedule-dialog-description">
            {dialogDescription}
          </div>
          <div data-testid="schedule-dialog-calendar-url">{calendarUrl}</div>
          {customButton && (
            <div data-testid="schedule-dialog-custom-button">{customButton}</div>
          )}
        </div>
      );
    },
  };
});

// Mock Button component
jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    asChild?: boolean;
  }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

const DEFAULT_PARTNER_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true";

describe("VendorHero", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering with Default Props", () => {
    it("renders the main section with correct styling", () => {
      const { container } = render(<VendorHero />);

      const section = container.querySelector("section");
      expect(section).toHaveClass(
        "w-full",
        "bg-white",
        "py-14",
        "sm:py-16",
        "lg:py-24"
      );
    });

    it("renders the container with correct max-width and flex layout", () => {
      const { container } = render(<VendorHero />);

      const innerContainer = container.querySelector(".mx-auto");
      expect(innerContainer).toHaveClass(
        "mx-auto",
        "flex",
        "max-w-6xl",
        "flex-col",
        "gap-10",
        "px-4",
        "sm:px-6",
        "lg:flex-row",
        "lg:items-center",
        "lg:gap-16"
      );
    });

    it("renders default heading text", () => {
      render(<VendorHero />);

      expect(screen.getByText("Your Catering Deserves")).toBeInTheDocument();
    });

    it("renders default highlight text", () => {
      render(<VendorHero />);

      expect(
        screen.getByText("More Than Just Delivery")
      ).toBeInTheDocument();
    });

    it("renders default description text", () => {
      render(<VendorHero />);

      const description = screen.getByText(
        /Our service goes beyond food delivery/
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(
        "Our service goes beyond food delivery as we provide solutions for restaurants, caterers, grocers, and foodservice providers from pickup all the way to complete setup."
      );
    });

    it("renders the eyebrow text", () => {
      render(<VendorHero />);

      expect(
        screen.getByText("Catering Logistics Partner")
      ).toBeInTheDocument();
    });
  });

  describe("Image Rendering", () => {
    it("renders the image with default cloudinary public ID", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/food/catering-about");
    });

    it("renders the image with priority attribute", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toHaveAttribute("data-priority", "true");
    });

    it("renders the image with correct sizes attribute", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toHaveAttribute(
        "data-sizes",
        "(max-width: 1024px) 100vw, 480px"
      );
    });

    it("renders the image with fill attribute", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toHaveAttribute("data-fill", "true");
    });

    it("renders custom image when imagePublicId is provided", () => {
      render(<VendorHero imagePublicId="custom/image-path" />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toHaveAttribute("src", "/images/custom/image-path");
    });

    it("renders custom alt text when imageAlt is provided", () => {
      render(<VendorHero imageAlt="Custom alt text for testing" />);

      const image = screen.getByAltText("Custom alt text for testing");
      expect(image).toBeInTheDocument();
    });
  });

  describe("ScheduleDialog Integration", () => {
    it("renders the ScheduleDialog component", () => {
      render(<VendorHero />);

      const scheduleDialog = screen.getByTestId("schedule-dialog");
      expect(scheduleDialog).toBeInTheDocument();
    });

    it("passes correct buttonText prop to ScheduleDialog", () => {
      render(<VendorHero />);

      const buttonText = screen.getByTestId("schedule-dialog-button-text");
      expect(buttonText).toHaveTextContent("Partner With Us");
    });

    it("passes correct dialogTitle prop to ScheduleDialog", () => {
      render(<VendorHero />);

      const dialogTitle = screen.getByTestId("schedule-dialog-title");
      expect(dialogTitle).toHaveTextContent("Partner With Ready Set");
    });

    it("passes correct dialogDescription prop to ScheduleDialog", () => {
      render(<VendorHero />);

      const dialogDescription = screen.getByTestId(
        "schedule-dialog-description"
      );
      expect(dialogDescription).toHaveTextContent(
        "Schedule a consultation to discuss how we can support your catering logistics needs."
      );
    });

    it("passes correct calendarUrl prop to ScheduleDialog", () => {
      render(<VendorHero />);

      const calendarUrl = screen.getByTestId("schedule-dialog-calendar-url");
      expect(calendarUrl).toHaveTextContent(DEFAULT_PARTNER_URL);
    });

    it("renders custom button within ScheduleDialog", () => {
      render(<VendorHero />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      expect(customButton).toBeInTheDocument();
    });

    it("custom button has correct text", () => {
      render(<VendorHero />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      const button = customButton.querySelector("button");
      expect(button).toHaveTextContent("Partner With Us");
    });

    it("custom button has correct styling classes", () => {
      render(<VendorHero />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      const button = customButton.querySelector("button");
      expect(button).toHaveClass(
        "h-auto",
        "rounded-full",
        "bg-yellow-400",
        "px-8",
        "py-3",
        "font-[Montserrat]",
        "text-base",
        "font-extrabold",
        "text-gray-900"
      );
    });

    it("custom button has correct aria-label", () => {
      render(<VendorHero />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      const button = customButton.querySelector("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Partner With Us with Ready Set"
      );
    });
  });

  describe("Custom Props Handling", () => {
    it("renders custom heading when provided", () => {
      render(<VendorHero heading="Custom Heading Text" />);

      expect(screen.getByText("Custom Heading Text")).toBeInTheDocument();
    });

    it("renders custom highlight when provided", () => {
      render(<VendorHero highlight="Custom Highlight Text" />);

      expect(screen.getByText("Custom Highlight Text")).toBeInTheDocument();
    });

    it("renders custom description when provided", () => {
      const customDescription =
        "This is a custom description for testing purposes.";
      render(<VendorHero description={customDescription} />);

      expect(screen.getByText(customDescription)).toBeInTheDocument();
    });

    it("renders custom CTA label when provided", () => {
      render(<VendorHero ctaLabel="Get Started Now" />);

      const buttonText = screen.getByTestId("schedule-dialog-button-text");
      expect(buttonText).toHaveTextContent("Get Started Now");
    });

    it("renders custom CTA href when provided", () => {
      const customUrl = "https://custom-url.com/schedule";
      render(<VendorHero ctaHref={customUrl} />);

      const calendarUrl = screen.getByTestId("schedule-dialog-calendar-url");
      expect(calendarUrl).toHaveTextContent(customUrl);
    });

    it("renders with custom id attribute", () => {
      const { container } = render(<VendorHero id="custom-vendor-hero" />);

      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "custom-vendor-hero");
    });

    it("sets aria-labelledby when id is provided", () => {
      const { container } = render(<VendorHero id="custom-vendor-hero" />);

      const section = container.querySelector("section");
      expect(section).toHaveAttribute(
        "aria-labelledby",
        "custom-vendor-hero-heading"
      );
    });

    it("sets heading id when component id is provided", () => {
      const { container } = render(<VendorHero id="custom-vendor-hero" />);

      const heading = container.querySelector("h1");
      expect(heading).toHaveAttribute("id", "custom-vendor-hero-heading");
    });

    it("does not set aria-labelledby when id is not provided", () => {
      const { container } = render(<VendorHero />);

      const section = container.querySelector("section");
      expect(section).not.toHaveAttribute("aria-labelledby");
    });
  });

  describe("All Props Combined", () => {
    it("renders correctly with all custom props provided", () => {
      const customProps: VendorHeroProps = {
        id: "test-hero",
        heading: "Test Heading",
        highlight: "Test Highlight",
        description: "Test description for comprehensive testing.",
        ctaLabel: "Contact Us",
        ctaHref: "https://test-url.com/contact",
        imagePublicId: "test/custom-image",
        imageAlt: "Test image alt text",
      };

      render(<VendorHero {...customProps} />);

      // Verify all custom props are rendered
      expect(screen.getByText("Test Heading")).toBeInTheDocument();
      expect(screen.getByText("Test Highlight")).toBeInTheDocument();
      expect(
        screen.getByText("Test description for comprehensive testing.")
      ).toBeInTheDocument();
      expect(screen.getByAltText("Test image alt text")).toBeInTheDocument();

      const buttonText = screen.getByTestId("schedule-dialog-button-text");
      expect(buttonText).toHaveTextContent("Contact Us");

      const calendarUrl = screen.getByTestId("schedule-dialog-calendar-url");
      expect(calendarUrl).toHaveTextContent("https://test-url.com/contact");
    });
  });

  describe("Layout and Structure", () => {
    it("renders image column with correct styling", () => {
      const { container } = render(<VendorHero />);

      const imageColumn = container.querySelector(
        ".relative.w-full.overflow-hidden.rounded-3xl"
      );
      expect(imageColumn).toHaveClass(
        "relative",
        "w-full",
        "overflow-hidden",
        "rounded-3xl",
        "shadow-xl",
        "lg:w-1/2"
      );
    });

    it("renders content column with correct styling", () => {
      const { container } = render(<VendorHero />);

      const contentColumn = container.querySelector(
        ".w-full.max-w-xl.space-y-6"
      );
      expect(contentColumn).toHaveClass(
        "w-full",
        "max-w-xl",
        "space-y-6",
        "text-center",
        "lg:w-1/2",
        "lg:text-left"
      );
    });

    it("renders heading with correct typography classes", () => {
      const { container } = render(<VendorHero />);

      const heading = container.querySelector("h1");
      expect(heading).toHaveClass(
        "font-[Montserrat]",
        "text-3xl",
        "font-black",
        "leading-tight",
        "text-gray-900",
        "sm:text-4xl",
        "lg:text-5xl"
      );
    });

    it("renders description with correct typography classes", () => {
      const { container } = render(<VendorHero />);

      const description = container.querySelector(".text-base.leading-relaxed");
      expect(description).toHaveClass(
        "font-[Montserrat]",
        "text-base",
        "leading-relaxed",
        "text-gray-700",
        "sm:text-lg"
      );
    });

    it("renders CTA button container with correct flex classes", () => {
      const { container } = render(<VendorHero />);

      const buttonContainer = container.querySelector(
        ".flex.justify-center.lg\\:justify-start"
      );
      expect(buttonContainer).toHaveClass(
        "flex",
        "justify-center",
        "lg:justify-start"
      );
    });
  });

  describe("Accessibility", () => {
    it("renders section as a semantic section element", () => {
      const { container } = render(<VendorHero />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("renders heading as an h1 element", () => {
      render(<VendorHero />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("button has proper aria-label", () => {
      render(<VendorHero ctaLabel="Schedule Meeting" />);

      const customButton = screen.getByTestId("schedule-dialog-custom-button");
      const button = customButton.querySelector("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Schedule Meeting with Ready Set"
      );
    });

    it("image has descriptive alt text", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty string props gracefully", () => {
      render(
        <VendorHero
          heading=""
          highlight=""
          description=""
          ctaLabel=""
          imageAlt=""
        />
      );

      // Component should still render without errors
      const { container } = render(<VendorHero />);
      expect(container.querySelector("section")).toBeInTheDocument();
    });

    it("handles undefined id prop", () => {
      const { container } = render(<VendorHero id={undefined} />);

      const section = container.querySelector("section");
      expect(section).not.toHaveAttribute("id");
      expect(section).not.toHaveAttribute("aria-labelledby");
    });

    it("maintains default URL when ctaHref is not provided", () => {
      render(<VendorHero />);

      const calendarUrl = screen.getByTestId("schedule-dialog-calendar-url");
      expect(calendarUrl).toHaveTextContent(DEFAULT_PARTNER_URL);
    });
  });

  describe("Typography and Styling", () => {
    it("eyebrow text has correct styling", () => {
      const { container } = render(<VendorHero />);

      const eyebrow = screen.getByText("Catering Logistics Partner");
      expect(eyebrow).toHaveClass(
        "text-sm",
        "font-semibold",
        "uppercase",
        "tracking-wide",
        "text-yellow-600"
      );
    });

    it("highlight text spans are properly structured", () => {
      render(<VendorHero />);

      const heading = screen.getByText("Your Catering Deserves");
      const highlight = screen.getByText("More Than Just Delivery");

      // Both should be span elements within h1
      expect(heading.tagName).toBe("SPAN");
      expect(highlight.tagName).toBe("SPAN");
    });
  });
});

