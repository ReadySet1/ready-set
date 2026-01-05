import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { Clock, Truck, Shield } from "lucide-react";
import ServiceFeaturesSection from "../ServiceFeaturesSection";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, onLoad, className, ...props }: any) => {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={onLoad}
        {...props}
        data-testid="next-image"
      />
    );
  },
}));

// Mock carousel components
jest.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children, ...props }: any) => (
    <div data-testid="carousel" {...props}>
      {children}
    </div>
  ),
  CarouselContent: ({ children, ...props }: any) => (
    <div data-testid="carousel-content" {...props}>
      {children}
    </div>
  ),
  CarouselItem: ({ children, ...props }: any) => (
    <div data-testid="carousel-item" {...props}>
      {children}
    </div>
  ),
}));

// Mock embla-carousel-autoplay
jest.mock("embla-carousel-autoplay", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

// Mock window.innerWidth and window.innerHeight
const mockWindowDimensions = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
};

// Mock resize event
const mockResizeEvent = (width: number, height: number) => {
  mockWindowDimensions(width, height);
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
};

// Test data
const mockPartners = [
  { name: "Test Partner 1", logo: "/test-logo-1.jpg" },
  { name: "Test Partner 2", logo: "/test-logo-2.jpg" },
];

const mockFeatures = [
  {
    icon: Truck,
    title: "Test Feature 1",
    description: "Description for test feature 1",
  },
  {
    icon: Clock,
    title: "Test Feature 2",
    description: "Description for test feature 2",
  },
];

describe("ServiceFeaturesSection", () => {
  beforeEach(() => {
    // Reset window dimensions to desktop default
    mockWindowDimensions(1920, 1080);

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console.error to avoid error boundary logs in tests
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders with default props", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.getByText("Premium Services")).toBeInTheDocument();
        expect(
          screen.getByText("Your trusted partner since 2019"),
        ).toBeInTheDocument();
      });
    });

    it("renders with custom title and subtitle", async () => {
      render(
        <ServiceFeaturesSection
          title="Custom Title"
          subtitle="Custom Subtitle"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Custom Title")).toBeInTheDocument();
        expect(screen.getByText("Custom Subtitle")).toBeInTheDocument();
      });
    });

    it("renders with custom className", async () => {
      const { container } = render(
        <ServiceFeaturesSection className="custom-class" />,
      );

      await waitFor(() => {
        expect(container.firstChild).toHaveClass("custom-class");
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading spinner initially", () => {
      render(<ServiceFeaturesSection />);

      const loadingSpinner = screen.getByTestId("loading-spinner");
      expect(loadingSpinner).toBeInTheDocument();
    });

    it("hides loading spinner after timeout", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(
        () => {
          expect(
            screen.queryByTestId("loading-spinner"),
          ).not.toBeInTheDocument();
        },
        { timeout: 200 },
      );
    });

    it("shows image loading overlay when background image is not loaded", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      // Should show background image loading overlay
      const loadingOverlay = screen.getByTestId("image-loading-overlay");
      expect(loadingOverlay).toBeInTheDocument();
    });
  });

  describe("Partners Carousel", () => {
    it("renders partners carousel when partners are provided", async () => {
      render(<ServiceFeaturesSection partners={mockPartners} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("carousel")).toBeInTheDocument();
      expect(screen.getByAltText("Test Partner 1")).toBeInTheDocument();
      expect(screen.getByAltText("Test Partner 2")).toBeInTheDocument();
    });

    it("renders default partners when no partners provided", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("carousel")).toBeInTheDocument();
      expect(screen.getByAltText("Deli")).toBeInTheDocument();
      expect(screen.getByAltText("Bobcha")).toBeInTheDocument();
    });

    it("does not render carousel when partners array is empty", async () => {
      render(<ServiceFeaturesSection partners={[]} />);

      await waitFor(() => {
        expect(screen.queryByTestId("carousel")).not.toBeInTheDocument();
      });
    });
  });

  describe("Service Features", () => {
    it("renders service features when features are provided", async () => {
      render(<ServiceFeaturesSection features={mockFeatures} />);

      await waitFor(() => {
        expect(screen.getByText("Test Feature 1")).toBeInTheDocument();
        expect(
          screen.getByText("Description for test feature 1"),
        ).toBeInTheDocument();
        expect(screen.getByText("Test Feature 2")).toBeInTheDocument();
        expect(
          screen.getByText("Description for test feature 2"),
        ).toBeInTheDocument();
      });
    });

    it("renders default features when no features provided", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.getByText("Specialized Delivery")).toBeInTheDocument();
        expect(screen.getByText("Time-Critical Delivery")).toBeInTheDocument();
        expect(screen.getByText("Quality Guaranteed")).toBeInTheDocument();
      });
    });

    it("does not render features section when features array is empty", async () => {
      render(<ServiceFeaturesSection features={[]} />);

      await waitFor(() => {
        expect(
          screen.queryByText("Specialized Delivery"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Button Interactions", () => {
    it("renders primary button when onPrimaryClick is provided", async () => {
      const mockPrimaryClick = jest.fn();

      render(
        <ServiceFeaturesSection
          primaryButtonText="Custom Primary"
          onPrimaryClick={mockPrimaryClick}
        />,
      );

      await waitFor(() => {
        const primaryButton = screen.getByText("Custom Primary");
        expect(primaryButton).toBeInTheDocument();

        fireEvent.click(primaryButton);
        expect(mockPrimaryClick).toHaveBeenCalledTimes(1);
      });
    });

    it("renders secondary button when onSecondaryClick is provided", async () => {
      const mockSecondaryClick = jest.fn();

      render(
        <ServiceFeaturesSection
          secondaryButtonText="Custom Secondary"
          onSecondaryClick={mockSecondaryClick}
        />,
      );

      await waitFor(() => {
        const secondaryButton = screen.getByText("Custom Secondary");
        expect(secondaryButton).toBeInTheDocument();

        fireEvent.click(secondaryButton);
        expect(mockSecondaryClick).toHaveBeenCalledTimes(1);
      });
    });

    it("does not render buttons when click handlers are not provided", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.queryByText("Get Quote")).not.toBeInTheDocument();
        expect(screen.queryByText("Schedule Call")).not.toBeInTheDocument();
      });
    });
  });

  describe("Responsive Background Behavior", () => {
    it("uses scroll attachment for mobile screens", async () => {
      mockWindowDimensions(375, 667);

      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        const backgroundElement = screen.getByTestId("background-container");
        expect(backgroundElement).toHaveStyle("background-attachment: scroll");
      });
    });

    it("uses scroll attachment for tablet screens", async () => {
      mockWindowDimensions(768, 1024);

      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        const backgroundElement = screen.getByTestId("background-container");
        expect(backgroundElement).toHaveStyle("background-attachment: scroll");
      });
    });
  });

  describe("Background Image Handling", () => {
    it("handles background image load event", async () => {
      render(<ServiceFeaturesSection />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      // Simulate background image load
      const backgroundImage = screen.getByAltText("Background");
      fireEvent.load(backgroundImage);

      await waitFor(() => {
        expect(
          screen.queryByTestId("image-loading-overlay"),
        ).not.toBeInTheDocument();
      });
    });

    it("uses custom background image when provided", async () => {
      render(<ServiceFeaturesSection backgroundImage="/custom-bg.jpg" />);

      await waitFor(() => {
        const backgroundImage = screen.getByAltText("Background");
        expect(backgroundImage).toHaveAttribute("src", "/custom-bg.jpg");
      });
    });
  });

  describe("Different Variants", () => {
    it("renders with logistics variant", async () => {
      render(<ServiceFeaturesSection variant="logistics" />);

      await waitFor(() => {
        expect(screen.getByText("Premium Services")).toBeInTheDocument();
      });
    });

    it("renders with bakery variant", async () => {
      render(<ServiceFeaturesSection variant="bakery" />);

      await waitFor(() => {
        expect(screen.getByText("Premium Services")).toBeInTheDocument();
      });
    });

    it("renders with flowers variant", async () => {
      render(<ServiceFeaturesSection variant="flowers" />);

      await waitFor(() => {
        expect(screen.getByText("Premium Services")).toBeInTheDocument();
      });
    });

    it("renders with default variant", async () => {
      render(<ServiceFeaturesSection variant="default" />);

      await waitFor(() => {
        expect(screen.getByText("Premium Services")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper aria-labels for buttons", async () => {
      const mockPrimaryClick = jest.fn();
      const mockSecondaryClick = jest.fn();

      render(
        <ServiceFeaturesSection
          primaryButtonText="Get Quote"
          secondaryButtonText="Schedule Call"
          onPrimaryClick={mockPrimaryClick}
          onSecondaryClick={mockSecondaryClick}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      const primaryButton = screen.getByLabelText("Get Quote");
      const secondaryButton = screen.getByLabelText("Schedule Call");

      expect(primaryButton).toBeInTheDocument();
      expect(secondaryButton).toBeInTheDocument();
    });

    it("has proper alt text for images", async () => {
      render(<ServiceFeaturesSection partners={mockPartners} />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });

      const partnerImage1 = screen.getByAltText("Test Partner 1");
      const partnerImage2 = screen.getByAltText("Test Partner 2");

      expect(partnerImage1).toBeInTheDocument();
      expect(partnerImage2).toBeInTheDocument();
    });
  });
});
