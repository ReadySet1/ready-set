import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VendorHero, { VendorHeroProps } from "../VendorHero";
import { getCloudinaryUrl } from "@/lib/cloudinary";

// Mock dependencies
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, className, ...props }: any) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/Logistics/Schedule", () => ({
  __esModule: true,
  default: ({ buttonText, customButton }: any) => (
    <div data-testid="schedule-dialog">
      {customButton || <button>{buttonText}</button>}
    </div>
  ),
}));

describe("VendorHero Component", () => {
  const mockGetCloudinaryUrl = getCloudinaryUrl as jest.MockedFunction<
    typeof getCloudinaryUrl
  >;

  beforeEach(() => {
    mockGetCloudinaryUrl.mockReturnValue(
      "https://res.cloudinary.com/test/image.jpg"
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Default Props Rendering", () => {
    it("should render with all default prop values", () => {
      render(<VendorHero />);

      // Check default heading
      expect(screen.getByText("Your Catering Deserves")).toBeInTheDocument();

      // Check default highlight
      expect(screen.getByText("More Than Just Delivery")).toBeInTheDocument();

      // Check default description
      expect(
        screen.getByText(/Our service goes beyond food delivery/i)
      ).toBeInTheDocument();

      // Check default CTA label
      expect(screen.getByText("Partner With Us")).toBeInTheDocument();

      // Check default image alt text
      expect(
        screen.getByAltText("Restaurant owners reviewing catering orders together")
      ).toBeInTheDocument();
    });

    it("should call getCloudinaryUrl with default imagePublicId and quality", () => {
      render(<VendorHero />);

      expect(mockGetCloudinaryUrl).toHaveBeenCalledWith(
        "food/catering-about-2",
        { quality: 85 }
      );
    });

    it("should render the eyebrow text", () => {
      render(<VendorHero />);

      expect(
        screen.getByText("Catering Logistics Partner")
      ).toBeInTheDocument();
    });
  });

  describe("Custom Props Rendering", () => {
    const customProps: VendorHeroProps = {
      id: "test-hero",
      heading: "Custom Heading",
      highlight: "Custom Highlight",
      description: "Custom description text",
      ctaLabel: "Get Started",
      ctaHref: "https://custom-calendar.com",
      imagePublicId: "custom/image-id",
      imageAlt: "Custom alt text",
    };

    it("should render with all custom prop values", () => {
      render(<VendorHero {...customProps} />);

      expect(screen.getByText("Custom Heading")).toBeInTheDocument();
      expect(screen.getByText("Custom Highlight")).toBeInTheDocument();
      expect(screen.getByText("Custom description text")).toBeInTheDocument();
      expect(screen.getByText("Get Started")).toBeInTheDocument();
      expect(screen.getByAltText("Custom alt text")).toBeInTheDocument();
    });

    it("should call getCloudinaryUrl with custom imagePublicId", () => {
      render(<VendorHero {...customProps} />);

      expect(mockGetCloudinaryUrl).toHaveBeenCalledWith("custom/image-id", {
        quality: 85,
      });
    });

    it("should use custom imagePublicId in image src", () => {
      const customUrl = "https://res.cloudinary.com/test/custom-image.jpg";
      mockGetCloudinaryUrl.mockReturnValue(customUrl);

      render(<VendorHero {...customProps} />);

      const image = screen.getByAltText("Custom alt text");
      expect(image).toHaveAttribute("src", customUrl);
    });
  });

  describe("Conditional Accessibility Attributes", () => {
    it("should not render aria-labelledby when id prop is not provided", () => {
      const { container } = render(<VendorHero />);

      const section = container.querySelector("section");
      expect(section).not.toHaveAttribute("aria-labelledby");
    });

    it("should render section with id when id prop is provided", () => {
      const { container } = render(<VendorHero id="hero-section" />);

      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "hero-section");
    });

    it("should render aria-labelledby when id prop is provided", () => {
      const { container } = render(<VendorHero id="hero-section" />);

      const section = container.querySelector("section");
      expect(section).toHaveAttribute("aria-labelledby", "hero-section-heading");
    });

    it("should render h1 with matching id when section id is provided", () => {
      render(<VendorHero id="hero-section" />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveAttribute("id", "hero-section-heading");
    });

    it("should not render h1 id when section id is not provided", () => {
      render(<VendorHero />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).not.toHaveAttribute("id");
    });

    it("should render CTA button with aria-label including ctaLabel", () => {
      render(<VendorHero ctaLabel="Custom CTA" />);

      const button = screen.getByRole("button", {
        name: "Custom CTA with Ready Set",
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Custom CTA with Ready Set");
    });
  });

  describe("ScheduleDialog Integration", () => {
    it("should render ScheduleDialog component", () => {
      render(<VendorHero />);

      expect(screen.getByTestId("schedule-dialog")).toBeInTheDocument();
    });

    it("should pass correct props to ScheduleDialog", () => {
      render(
        <VendorHero
          ctaLabel="Book Now"
          ctaHref="https://custom-calendar.com"
        />
      );

      // ScheduleDialog should render the custom button with the CTA text
      expect(screen.getByText("Book Now")).toBeInTheDocument();
    });

    it("should render custom button within ScheduleDialog", () => {
      render(<VendorHero ctaLabel="Test CTA" />);

      // Custom button should be rendered by ScheduleDialog
      const button = screen.getByRole("button", { name: /Test CTA/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Image Component", () => {
    it("should render Image with correct props", () => {
      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );

      // Note: fill and priority are Next.js specific props that don't get passed to DOM
      expect(image).toHaveAttribute(
        "sizes",
        "(max-width: 1024px) 100vw, 480px"
      );
      expect(image).toHaveClass("object-cover");
    });

    it("should render Image with src from Cloudinary", () => {
      mockGetCloudinaryUrl.mockReturnValue(
        "https://res.cloudinary.com/test/hero-image.jpg"
      );

      render(<VendorHero />);

      const image = screen.getByAltText(
        "Restaurant owners reviewing catering orders together"
      );
      expect(image).toHaveAttribute(
        "src",
        "https://res.cloudinary.com/test/hero-image.jpg"
      );
    });

    it("should render Image with custom alt text", () => {
      render(<VendorHero imageAlt="Custom image description" />);

      const image = screen.getByAltText("Custom image description");
      expect(image).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render main section with correct classes", () => {
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

    it("should render heading with correct styling classes", () => {
      render(<VendorHero />);

      const heading = screen.getByRole("heading", { level: 1 });
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

    it("should render description paragraph with correct classes", () => {
      const { container } = render(<VendorHero />);

      const description = container.querySelector(
        "p.font-\\[Montserrat\\].text-base"
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass(
        "font-[Montserrat]",
        "text-base",
        "leading-relaxed",
        "text-gray-700",
        "sm:text-lg"
      );
    });

    it("should render eyebrow text with correct styling", () => {
      render(<VendorHero />);

      const eyebrow = screen.getByText("Catering Logistics Partner");
      expect(eyebrow).toHaveClass(
        "text-sm",
        "font-semibold",
        "uppercase",
        "tracking-wide",
        "text-yellow-600"
      );
    });
  });

  describe("Prop Combinations", () => {
    it("should handle partial prop overrides correctly", () => {
      render(
        <VendorHero
          heading="Partial Override"
          ctaLabel="New CTA"
          // Other props use defaults
        />
      );

      expect(screen.getByText("Partial Override")).toBeInTheDocument();
      expect(screen.getByText("More Than Just Delivery")).toBeInTheDocument();
      expect(screen.getByText("New CTA")).toBeInTheDocument();
      expect(
        screen.getByText(/Our service goes beyond food delivery/i)
      ).toBeInTheDocument();
    });

    it("should handle empty strings as prop values", () => {
      render(
        <VendorHero
          heading=""
          highlight=""
          description=""
          ctaLabel="CTA"
        />
      );

      // Empty strings should still render (just empty)
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("should handle id with special characters", () => {
      const { container } = render(<VendorHero id="test-hero-123" />);

      const section = container.querySelector("section");
      expect(section).toHaveAttribute("id", "test-hero-123");
      expect(section).toHaveAttribute("aria-labelledby", "test-hero-123-heading");

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveAttribute("id", "test-hero-123-heading");
    });
  });

  describe("Button Styling", () => {
    it("should render button with correct styling classes", () => {
      render(<VendorHero />);

      const button = screen.getByRole("button", { name: /Partner With Us/i });
      expect(button).toHaveClass(
        "h-auto",
        "rounded-full",
        "bg-yellow-400",
        "px-8",
        "py-3",
        "font-[Montserrat]",
        "text-base",
        "font-extrabold",
        "text-gray-900",
        "shadow-md"
      );
    });
  });
});
