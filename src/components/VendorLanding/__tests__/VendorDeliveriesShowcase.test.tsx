import { render, screen } from "@testing-library/react";
import VendorDeliveriesShowcase from "../VendorDeliveriesShowcase";
import { getCloudinaryUrl } from "@/lib/cloudinary";

// Mock the Cloudinary utility
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: jest.fn(),
}));

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("VendorDeliveriesShowcase", () => {
  const mockCloudinaryUrl =
    "https://res.cloudinary.com/test/image/upload/food/gallery-food-2";

  beforeEach(() => {
    (getCloudinaryUrl as jest.Mock).mockReturnValue(mockCloudinaryUrl);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      expect(container).toBeInTheDocument();
    });

    it("should render the section with correct aria-labelledby", () => {
      render(<VendorDeliveriesShowcase />);
      const section = screen.getByRole("region", {
        name: /catering deliveries we handle/i,
      });
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("aria-labelledby", "deliveries-heading");
    });

    it("should render the main heading with correct text", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", {
        level: 2,
        name: /catering deliveries we handle/i,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveAttribute("id", "deliveries-heading");
    });

    it("should render the uppercase label text", () => {
      render(<VendorDeliveriesShowcase />);
      expect(screen.getByText("Catering Deliveries")).toBeInTheDocument();
    });
  });

  describe("Delivery Types Display", () => {
    const deliveryTypes = [
      "Corporate catering",
      "Group orders",
      "Large food deliveries",
      "Bakery & deli catering",
      "Pantry restocking",
      "Event catering",
      "Custom requests",
    ];

    it("should render all delivery types", () => {
      render(<VendorDeliveriesShowcase />);

      deliveryTypes.forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument();
      });
    });

    it("should render correct number of delivery types", () => {
      render(<VendorDeliveriesShowcase />);

      deliveryTypes.forEach((type) => {
        const elements = screen.getAllByText(type);
        expect(elements).toHaveLength(1);
      });
    });

    it("should render bullet separators between items but not after the last item", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      // Find all bullet separators (aria-hidden spans containing '•')
      // Use more specific selector to avoid market indicators
      const bullets = Array.from(
        container.querySelectorAll('span[aria-hidden="true"]'),
      ).filter((el) => el.textContent?.includes("•"));

      // Should have 6 bullets for 7 items (no bullet after last item)
      expect(bullets.length).toBe(6);

      bullets.forEach((bullet) => {
        expect(bullet.textContent).toContain("•");
      });
    });

    it("should render delivery types in the correct order", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      const paragraph = container.querySelector("p.mx-auto.mt-6");
      const text = paragraph?.textContent || "";

      // Check that each type appears before the next one
      let lastIndex = -1;
      deliveryTypes.forEach((type) => {
        const index = text.indexOf(type);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });
  });

  describe("Markets Display", () => {
    const markets = ["San Francisco Bay Area", "Atlanta", "Austin", "Dallas"];

    it("should render all market cities", () => {
      render(<VendorDeliveriesShowcase />);

      markets.forEach((market) => {
        expect(screen.getByText(market)).toBeInTheDocument();
      });
    });

    it("should render correct number of market indicators", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      // Find all indicator dots (small rounded elements)
      const indicators = container.querySelectorAll(
        ".h-2.w-2.rounded-full.bg-gray-900",
      );

      // Should have 4 indicators for 4 markets
      expect(indicators.length).toBe(4);
    });

    it("should render market indicators with aria-hidden", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      const indicators = container.querySelectorAll(
        ".h-2.w-2.rounded-full.bg-gray-900",
      );

      indicators.forEach((indicator) => {
        expect(indicator).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("should render markets with whitespace-nowrap class", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      markets.forEach((market) => {
        const marketElement = screen.getByText(market);
        expect(marketElement).toHaveClass("whitespace-nowrap");
      });
    });
  });

  describe("Image Integration", () => {
    it("should call getCloudinaryUrl with correct path", () => {
      render(<VendorDeliveriesShowcase />);

      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery-food-2");
      expect(getCloudinaryUrl).toHaveBeenCalledTimes(1);
    });

    it("should render image with correct alt text", () => {
      render(<VendorDeliveriesShowcase />);

      const image = screen.getByAltText("Catering delivery showcase");
      expect(image).toBeInTheDocument();
    });

    it("should render image with correct src from Cloudinary", () => {
      render(<VendorDeliveriesShowcase />);

      const image = screen.getByAltText("Catering delivery showcase");
      expect(image).toHaveAttribute("src", mockCloudinaryUrl);
    });

    it("should render image container with correct aspect ratio", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      // Verify the image is in a container with aspect ratio classes
      const imageContainer = container.querySelector(".aspect-\\[16\\/9\\]");
      expect(imageContainer).toBeInTheDocument();

      // Verify the image exists within the container
      const image = screen.getByAltText("Catering delivery showcase");
      expect(imageContainer).toContainElement(image);
    });

    it("should render image with correct sizes attribute", () => {
      render(<VendorDeliveriesShowcase />);

      const image = screen.getByAltText("Catering delivery showcase");
      expect(image).toHaveAttribute(
        "sizes",
        "(max-width: 768px) 100vw, (max-width: 1280px) 1200px, 1400px",
      );
    });

    it("should render image with object-cover class", () => {
      render(<VendorDeliveriesShowcase />);

      const image = screen.getByAltText("Catering delivery showcase");
      expect(image).toHaveClass("object-cover");
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic HTML structure", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      // Check for section element
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();

      // Check for header element inside section
      const header = section?.querySelector("header");
      expect(header).toBeInTheDocument();

      // Check for h2 inside header
      const h2 = header?.querySelector("h2");
      expect(h2).toBeInTheDocument();
    });

    it("should connect heading with aria-labelledby", () => {
      render(<VendorDeliveriesShowcase />);

      const section = screen.getByRole("region");
      const heading = screen.getByRole("heading", { level: 2 });

      expect(section).toHaveAttribute("aria-labelledby", "deliveries-heading");
      expect(heading).toHaveAttribute("id", "deliveries-heading");
    });

    it("should mark decorative elements with aria-hidden", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      // Check bullet separators
      const bullets = container.querySelectorAll('span[aria-hidden="true"]');
      expect(bullets.length).toBeGreaterThan(0);

      bullets.forEach((bullet) => {
        expect(bullet).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("should have descriptive alt text for image", () => {
      render(<VendorDeliveriesShowcase />);

      const image = screen.getByAltText("Catering delivery showcase");
      expect(image).toBeInTheDocument();

      // Alt text should be descriptive, not empty
      expect(image.getAttribute("alt")).toBeTruthy();
      expect(image.getAttribute("alt")?.length).toBeGreaterThan(0);
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct container classes for responsive design", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("w-full", "bg-white");
    });

    it("should have responsive padding classes", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("py-14", "sm:py-16", "lg:py-20");
    });

    it("should have correct image container aspect ratio classes", () => {
      const { container } = render(<VendorDeliveriesShowcase />);

      const imageContainer = container.querySelector(".aspect-\\[16\\/9\\]");
      expect(imageContainer).toBeInTheDocument();
      expect(imageContainer).toHaveClass("sm:aspect-[21/9]");
    });

    it("should apply custom font styles to heading", () => {
      render(<VendorDeliveriesShowcase />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveStyle({
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
        fontWeight: 900,
      });
    });
  });
});
