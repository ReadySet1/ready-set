import { render, screen } from "@testing-library/react";
import VendorDeliveriesShowcase from "../VendorDeliveriesShowcase";
import { getCloudinaryUrl } from "@/lib/cloudinary";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

// Mock Cloudinary utility
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: jest.fn((publicId: string) => `https://res.cloudinary.com/test/${publicId}`),
}));

describe("VendorDeliveriesShowcase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render without crashing", () => {
      render(<VendorDeliveriesShowcase />);
      expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("should have correct aria-labelledby attribute", () => {
      render(<VendorDeliveriesShowcase />);
      const section = screen.getByRole("region");
      expect(section).toHaveAttribute("aria-labelledby", "deliveries-heading");
    });

    it("should render header content", () => {
      render(<VendorDeliveriesShowcase />);
      expect(screen.getByText("Catering Deliveries", { selector: "p" })).toBeInTheDocument();
    });
  });

  describe("Content Tests - Delivery Types", () => {
    const deliveryTypes = [
      "Corporate catering",
      "Group orders",
      "Large food deliveries",
      "Bakery & deli catering",
      "Pantry restocking",
      "Event catering",
      "Custom requests",
    ];

    it("should render all 7 delivery types", () => {
      render(<VendorDeliveriesShowcase />);
      
      deliveryTypes.forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument();
      });
    });

    it("should render bullet separators between items", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      // Find all bullet separators (should be 6 for 7 items)
      const bullets = container.querySelectorAll('span[aria-hidden="true"]');
      // Filter only the bullets in the delivery types section (not market dots)
      const deliveryBullets = Array.from(bullets).filter(
        (bullet) => bullet.textContent === "•"
      );
      
      expect(deliveryBullets).toHaveLength(6);
    });

    it("should have mx-3 class on bullet separators for proper spacing", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      const bullets = container.querySelectorAll('span[aria-hidden="true"].mx-3');
      expect(bullets.length).toBeGreaterThan(0);
    });
  });

  describe("Content Tests - Markets", () => {
    const markets = [
      "San Francisco Bay Area",
      "Atlanta",
      "Austin",
      "Dallas",
    ];

    it("should render all 4 markets", () => {
      render(<VendorDeliveriesShowcase />);
      
      markets.forEach((market) => {
        expect(screen.getByText(market)).toBeInTheDocument();
      });
    });

    it("should render market dot indicators", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      // Find all dot indicators (should be 4 for 4 markets)
      const dots = container.querySelectorAll(".h-2.w-2.rounded-full.bg-gray-900");
      expect(dots).toHaveLength(4);
    });
  });

  describe("Title Tests", () => {
    it("should render the main title with correct text", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      
      // Check that the title contains both parts
      expect(heading).toHaveTextContent("Catering Deliveries");
      expect(heading).toHaveTextContent("We Handle");
    });

    it("should have correct ID on title", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveAttribute("id", "deliveries-heading");
    });

    it("should apply correct font styling classes", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      
      expect(heading).toHaveClass("font-black");
      expect(heading).toHaveClass("text-gray-900");
      expect(heading).toHaveClass("tracking-tight");
    });

    it("should have responsive text size classes", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      
      expect(heading).toHaveClass("text-3xl");
      expect(heading).toHaveClass("sm:text-4xl");
      expect(heading).toHaveClass("lg:text-5xl");
    });

    it("should have correct font family style", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      
      // Check that heading has an inline style with fontFamily
      expect(heading).toHaveAttribute("style");
      const style = heading.getAttribute("style");
      expect(style).toContain("font-family");
    });
  });

  describe("Image Gallery Tests", () => {
    it("should render all 7 gallery images", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const images = container.querySelectorAll("img");
      
      expect(images).toHaveLength(7);
    });

    it("should generate Cloudinary URLs correctly", () => {
      render(<VendorDeliveriesShowcase />);
      
      // Check that getCloudinaryUrl was called for each image
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-4");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-6");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-2");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-3");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-8");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-9");
      expect(getCloudinaryUrl).toHaveBeenCalledWith("food/gallery/food-10");
    });

    it("should have alt text on all images", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const images = container.querySelectorAll("img");
      
      images.forEach((img) => {
        expect(img).toHaveAttribute("alt");
        expect(img.getAttribute("alt")).toBeTruthy();
      });
    });

    it("should apply slanted card style with clip-path", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      // Find elements with the slanted card style
      const slantedCards = Array.from(container.querySelectorAll("[style*='clip-path']"));
      expect(slantedCards.length).toBeGreaterThan(0);
    });

    it("should have proper responsive sizing classes on image containers", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      // Check for responsive width classes
      const imageContainers = container.querySelectorAll(".w-\\[140px\\]");
      expect(imageContainers.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility Tests", () => {
    it("should have aria-hidden on decorative bullet separators", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      const bullets = container.querySelectorAll('span[aria-hidden="true"]');
      expect(bullets.length).toBeGreaterThan(0);
      
      bullets.forEach((bullet) => {
        expect(bullet).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("should have proper heading hierarchy with h2", () => {
      render(<VendorDeliveriesShowcase />);
      const heading = screen.getByRole("heading", { level: 2 });
      
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });

    it("should use semantic HTML with section element", () => {
      render(<VendorDeliveriesShowcase />);
      const section = screen.getByRole("region");
      
      expect(section.tagName).toBe("SECTION");
    });

    it("should have proper header landmark", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const header = container.querySelector("header");
      
      expect(header).toBeInTheDocument();
    });
  });

  describe("Responsive and Styling Tests", () => {
    it("should have responsive padding classes on section", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const section = container.querySelector("section");
      
      expect(section).toHaveClass("py-14");
      expect(section).toHaveClass("sm:py-16");
      expect(section).toHaveClass("lg:py-20");
    });

    it("should have max-width constraint on content container", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const contentContainer = container.querySelector(".max-w-6xl");
      
      expect(contentContainer).toBeInTheDocument();
    });

    it("should apply vertical offset to gallery images for alternating pattern", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      
      // Check for translate-y classes
      const translatedElements = container.querySelectorAll('[class*="translate-y"]');
      expect(translatedElements.length).toBeGreaterThan(0);
    });

    it("should have proper gap spacing between gallery images", () => {
      const { container } = render(<VendorDeliveriesShowcase />);
      const galleryContainer = container.querySelector(".gap-2");
      
      expect(galleryContainer).toBeInTheDocument();
    });
  });

  describe("Data Integrity Tests", () => {
    it("should export exactly 7 delivery types", () => {
      render(<VendorDeliveriesShowcase />);
      const deliveryTypesText = screen.getByText(/Corporate catering/);
      const paragraph = deliveryTypesText.closest("p");
      
      // Count the number of delivery type items
      const deliveryItems = [
        "Corporate catering",
        "Group orders",
        "Large food deliveries",
        "Bakery & deli catering",
        "Pantry restocking",
        "Event catering",
        "Custom requests",
      ];
      
      deliveryItems.forEach((item) => {
        expect(paragraph).toHaveTextContent(item);
      });
    });

    it("should export exactly 4 markets", () => {
      render(<VendorDeliveriesShowcase />);
      
      const markets = ["San Francisco Bay Area", "Atlanta", "Austin", "Dallas"];
      markets.forEach((market) => {
        expect(screen.getByText(market)).toBeInTheDocument();
      });
    });

    it("should have exactly 7 gallery images with correct public IDs", () => {
      render(<VendorDeliveriesShowcase />);
      
      const expectedPublicIds = [
        "food/gallery/food-4",
        "food/gallery/food-6",
        "food/gallery/food-2",
        "food/gallery/food-3",
        "food/gallery/food-8",
        "food/gallery/food-9",
        "food/gallery/food-10",
      ];
      
      expectedPublicIds.forEach((publicId) => {
        expect(getCloudinaryUrl).toHaveBeenCalledWith(publicId);
      });
    });
  });
});

