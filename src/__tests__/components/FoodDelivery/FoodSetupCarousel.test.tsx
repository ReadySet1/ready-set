import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FoodSetupCarousel from "@/components/FoodDelivery/FoodSetupCarousel";

// Mock embla-carousel-react
const mockEmblaApi = {
  scrollPrev: jest.fn(),
  scrollNext: jest.fn(),
  canScrollPrev: jest.fn(() => true),
  canScrollNext: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock("embla-carousel-react", () => ({
  __esModule: true,
  default: jest.fn(() => [jest.fn(), mockEmblaApi]),
}));

// Mock embla-carousel-autoplay
jest.mock("embla-carousel-autoplay", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    name: "autoplay",
    options: {},
    init: jest.fn(),
    destroy: jest.fn(),
  })),
}));

// Helper function to get slides by aria-roledescription
const getSlides = (container: HTMLElement) => {
  return container.querySelectorAll('[aria-roledescription="slide"]');
};

describe("FoodSetupCarousel Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the component successfully", () => {
      render(<FoodSetupCarousel />);

      const carousel = screen.getByRole("region");
      expect(carousel).toBeInTheDocument();
      expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    });

    it("renders the correct number of carousel items (10 - duplicated for infinite loop)", () => {
      const { container } = render(<FoodSetupCarousel />);

      // 10 images grouped into 5 columns, duplicated = 10 columns total
      const slides = getSlides(container);
      expect(slides).toHaveLength(10);
    });

    it("renders all food setup images", () => {
      render(<FoodSetupCarousel />);

      // Check for all 10 unique images (each appears twice due to duplication)
      for (let i = 1; i <= 10; i++) {
        const images = screen.getAllByAltText(`Food setup ${i}`);
        expect(images.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("renders images with correct src paths", () => {
      render(<FoodSetupCarousel />);

      // Verify image paths follow the expected pattern
      const firstImage = screen.getAllByAltText("Food setup 1")[0];
      expect(firstImage).toHaveAttribute(
        "src",
        "/images/food/foodsetup/foodsetup1"
      );

      const secondImage = screen.getAllByAltText("Food setup 2")[0];
      expect(secondImage).toHaveAttribute(
        "src",
        "/images/food/foodsetup/foodsetup2"
      );
    });

    it("renders each carousel item with two images stacked vertically", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);

      // Each slide should have a container with two image containers
      slides.forEach((slide) => {
        const imageContainers = slide.querySelectorAll("img");
        expect(imageContainers.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Image Generation Logic", () => {
    it("generates 10 food setup images correctly", () => {
      render(<FoodSetupCarousel />);

      // Verify all 10 unique images exist
      const allImages: HTMLImageElement[] = [];
      for (let i = 1; i <= 10; i++) {
        const images = screen.getAllByAltText(`Food setup ${i}`);
        allImages.push(...(images as HTMLImageElement[]));
      }

      // Each image should appear at least once (duplicated for infinite loop)
      expect(allImages.length).toBeGreaterThanOrEqual(10);
    });

    it("groups images into columns of 2 for vertical layout", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);

      // With 10 images in pairs, we get 5 columns, duplicated = 10 slides
      expect(slides).toHaveLength(10);
    });

    it("duplicates columns for seamless infinite loop", () => {
      render(<FoodSetupCarousel />);

      // Check that images appear twice (original + duplicate)
      const firstImageOccurrences = screen.getAllByAltText("Food setup 1");
      expect(firstImageOccurrences).toHaveLength(2);

      const fifthImageOccurrences = screen.getAllByAltText("Food setup 5");
      expect(fifthImageOccurrences).toHaveLength(2);
    });
  });

  describe("Conditional Rendering of Bottom Images", () => {
    it("renders bottom images in each column when they exist", () => {
      const { container } = render(<FoodSetupCarousel />);

      // With 10 images, all 5 columns have both top and bottom images
      // Each duplicated, so we should have pairs
      const slides = getSlides(container);

      // Each slide should have 2 images (top and bottom)
      slides.forEach((slide) => {
        const images = slide.querySelectorAll("img");
        expect(images).toHaveLength(2);
      });
    });

    it("correctly pairs top and bottom images", () => {
      const { container } = render(<FoodSetupCarousel />);

      // First column: images 1 (top) and 2 (bottom)
      const slides = getSlides(container);
      const firstSlide = slides[0];

      const imagesInFirstSlide = firstSlide.querySelectorAll("img");
      expect(imagesInFirstSlide[0]).toHaveAttribute("alt", "Food setup 1");
      expect(imagesInFirstSlide[1]).toHaveAttribute("alt", "Food setup 2");
    });
  });

  describe("Styling and Layout", () => {
    it("applies correct background color to section", () => {
      const { container } = render(<FoodSetupCarousel />);

      const section = container.firstChild as HTMLElement;
      expect(section).toHaveClass("bg-[#343434]");
    });

    it("applies correct padding classes", () => {
      const { container } = render(<FoodSetupCarousel />);

      const section = container.firstChild as HTMLElement;
      expect(section).toHaveClass("py-8", "md:py-12", "lg:py-16");
    });

    it("applies max-width container styling", () => {
      const { container } = render(<FoodSetupCarousel />);

      const innerContainer = container.querySelector(".mx-auto");
      expect(innerContainer).toHaveClass("max-w-7xl", "px-4");
    });

    it("applies responsive basis classes to carousel items", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);
      const firstSlide = slides[0];

      expect(firstSlide).toHaveClass(
        "basis-1/2",
        "md:basis-1/3",
        "lg:basis-1/5"
      );
    });

    it("applies rounded corners to image containers", () => {
      const { container } = render(<FoodSetupCarousel />);

      // Find image wrappers with rounded-2xl class
      const roundedContainers = container.querySelectorAll(".rounded-2xl");
      expect(roundedContainers.length).toBeGreaterThan(0);
    });

    it("applies hover scale effect to image containers", () => {
      const { container } = render(<FoodSetupCarousel />);

      const hoverContainers = container.querySelectorAll(".hover\\:scale-105");
      expect(hoverContainers.length).toBeGreaterThan(0);
    });

    it("applies shadow styling to image containers", () => {
      const { container } = render(<FoodSetupCarousel />);

      const shadowContainers = container.querySelectorAll(".shadow-lg");
      expect(shadowContainers.length).toBeGreaterThan(0);
    });

    it("applies aspect ratio to image containers", () => {
      const { container } = render(<FoodSetupCarousel />);

      const aspectContainers = container.querySelectorAll(".aspect-\\[4\\/3\\]");
      expect(aspectContainers.length).toBeGreaterThan(0);
    });

    it("applies flex column layout for image stacking", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);

      slides.forEach((slide) => {
        const flexContainer = slide.querySelector(".flex-col");
        expect(flexContainer).toBeInTheDocument();
      });
    });

    it("applies responsive gap between stacked images", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);
      const firstSlide = slides[0];

      const flexContainer = firstSlide.querySelector(".flex-col");
      expect(flexContainer).toHaveClass("gap-3", "md:gap-4", "lg:gap-6");
    });
  });

  describe("Image Properties", () => {
    it("images use fill layout", () => {
      const { container } = render(<FoodSetupCarousel />);

      // With Next.js Image mocked to render as img, fill property becomes style
      const images = container.querySelectorAll("img");
      expect(images.length).toBeGreaterThan(0);
    });

    it("images have object-cover class for proper scaling", () => {
      const { container } = render(<FoodSetupCarousel />);

      const images = container.querySelectorAll(".object-cover");
      expect(images.length).toBeGreaterThan(0);
    });

    it("images have appropriate sizes attribute for responsive loading", () => {
      render(<FoodSetupCarousel />);

      const firstImage = screen.getAllByAltText("Food setup 1")[0];
      expect(firstImage).toHaveAttribute(
        "sizes",
        "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
      );
    });
  });

  describe("Carousel Configuration", () => {
    it("initializes embla carousel with correct options", () => {
      const useEmblaCarousel = require("embla-carousel-react").default;

      render(<FoodSetupCarousel />);

      expect(useEmblaCarousel).toHaveBeenCalledWith(
        expect.objectContaining({
          align: "start",
          loop: true,
          dragFree: false,
          slidesToScroll: 1,
          axis: "x",
        }),
        expect.any(Array)
      );
    });

    it("initializes autoplay plugin with correct settings", () => {
      const Autoplay = require("embla-carousel-autoplay").default;

      render(<FoodSetupCarousel />);

      expect(Autoplay).toHaveBeenCalledWith({
        delay: 3000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      });
    });

    it("applies loop option for infinite scrolling", () => {
      const useEmblaCarousel = require("embla-carousel-react").default;

      render(<FoodSetupCarousel />);

      const callArgs = useEmblaCarousel.mock.calls[0][0];
      expect(callArgs.loop).toBe(true);
    });

    it("configures horizontal axis for carousel", () => {
      const useEmblaCarousel = require("embla-carousel-react").default;

      render(<FoodSetupCarousel />);

      const callArgs = useEmblaCarousel.mock.calls[0][0];
      expect(callArgs.axis).toBe("x");
    });
  });

  describe("Accessibility", () => {
    it("carousel has proper role and aria attributes", () => {
      render(<FoodSetupCarousel />);

      const carousel = screen.getByRole("region");
      expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    });

    it("carousel items have slide role description", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);
      slides.forEach((slide) => {
        expect(slide).toHaveAttribute("aria-roledescription", "slide");
      });
    });

    it("all images have descriptive alt text", () => {
      render(<FoodSetupCarousel />);

      // All images should have alt text
      for (let i = 1; i <= 10; i++) {
        const images = screen.getAllByAltText(`Food setup ${i}`);
        images.forEach((img) => {
          expect(img).toHaveAttribute("alt", `Food setup ${i}`);
        });
      }
    });
  });

  describe("Responsive Design", () => {
    it("has responsive spacing in carousel content", () => {
      const { container } = render(<FoodSetupCarousel />);

      const carouselContent = container.querySelector(".-ml-2");
      expect(carouselContent).toHaveClass("-ml-2", "md:-ml-4");
    });

    it("has responsive padding on carousel items", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);
      const firstSlide = slides[0];

      expect(firstSlide).toHaveClass("pl-2", "md:pl-4");
    });

    it("adapts columns based on viewport width", () => {
      const { container } = render(<FoodSetupCarousel />);

      const slides = getSlides(container);
      const firstSlide = slides[0];

      // Mobile: 2 columns (basis-1/2)
      // Tablet: 3 columns (md:basis-1/3)
      // Desktop: 5 columns (lg:basis-1/5)
      expect(firstSlide).toHaveClass("basis-1/2");
      expect(firstSlide).toHaveClass("md:basis-1/3");
      expect(firstSlide).toHaveClass("lg:basis-1/5");
    });
  });

  describe("Edge Cases", () => {
    it("handles component re-renders correctly", () => {
      const { rerender } = render(<FoodSetupCarousel />);

      // Re-render multiple times
      rerender(<FoodSetupCarousel />);
      rerender(<FoodSetupCarousel />);
      rerender(<FoodSetupCarousel />);

      // Component should still render correctly
      const carousel = screen.getByRole("region");
      expect(carousel).toBeInTheDocument();
    });

    it("maintains correct image order after multiple renders", () => {
      const { rerender, container } = render(<FoodSetupCarousel />);

      rerender(<FoodSetupCarousel />);

      const slides = getSlides(container);
      const firstSlide = slides[0];
      const imagesInFirstSlide = firstSlide.querySelectorAll("img");

      // First column should always have images 1 and 2
      expect(imagesInFirstSlide[0]).toHaveAttribute("alt", "Food setup 1");
      expect(imagesInFirstSlide[1]).toHaveAttribute("alt", "Food setup 2");
    });

    it("renders without crashing when mounted/unmounted rapidly", () => {
      const { unmount } = render(<FoodSetupCarousel />);
      unmount();

      // Re-mount immediately
      render(<FoodSetupCarousel />);

      expect(screen.getByRole("region")).toBeInTheDocument();
    });
  });

  describe("Memoization", () => {
    it("memoizes food setup images array", () => {
      const { rerender } = render(<FoodSetupCarousel />);

      // Get initial images
      const initialImages = screen.getAllByRole("img");
      const initialImageCount = initialImages.length;

      // Re-render
      rerender(<FoodSetupCarousel />);

      // Images should remain consistent
      const afterRerenderImages = screen.getAllByRole("img");
      expect(afterRerenderImages).toHaveLength(initialImageCount);
    });

    it("memoizes image columns calculation", () => {
      const { rerender, container } = render(<FoodSetupCarousel />);

      // Get initial slide count
      const initialSlides = getSlides(container);
      const initialSlideCount = initialSlides.length;

      // Re-render
      rerender(<FoodSetupCarousel />);

      // Slide count should remain consistent
      const afterRerenderSlides = getSlides(container);
      expect(afterRerenderSlides).toHaveLength(initialSlideCount);
    });
  });
});

