import React from "react";
import { render, screen } from "@testing-library/react";
import FoodGallery from "../FoodGallery";

// Mock framer-motion since it's mocked in jest.setup.ts
// The mock converts motion components to regular divs

describe("FoodGallery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      const { container } = render(<FoodGallery />);

      const mainContainer = container.querySelector(
        ".w-full.bg-yellow-400.py-12"
      );
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass(
        "w-full",
        "bg-yellow-400",
        "py-12"
      );
    });

    it("renders the max-width wrapper", () => {
      const { container } = render(<FoodGallery />);

      const wrapper = container.querySelector(".mx-auto.max-w-7xl.px-4");
      expect(wrapper).toBeInTheDocument();
    });

    it("renders a grid container with responsive columns", () => {
      const { container } = render(<FoodGallery />);

      const grid = container.querySelector(
        ".grid.grid-cols-2.md\\:grid-cols-5"
      );
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Image Rendering", () => {
    it("renders all 10 food gallery images", () => {
      render(<FoodGallery />);

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(10);
    });

    it("renders images with correct alt text", () => {
      render(<FoodGallery />);

      expect(
        screen.getByAltText("Catering food containers")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Individual meal containers")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Prepared meals in containers")
      ).toBeInTheDocument();
      expect(screen.getByAltText("Pasta and rice dishes")).toBeInTheDocument();
      expect(
        screen.getByAltText("Salads and main courses")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Catering containers on counter")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Food containers with beverages")
      ).toBeInTheDocument();
      expect(screen.getByAltText("Stacked food containers")).toBeInTheDocument();
      expect(
        screen.getByAltText("Close-up of meal containers")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Variety of prepared meals")
      ).toBeInTheDocument();
    });

    it("renders images with correct src paths", () => {
      render(<FoodGallery />);

      const images = screen.getAllByRole("img");

      images.forEach((image, index) => {
        expect(image).toHaveAttribute(
          "src",
          expect.stringContaining(`food-${index + 1}`)
        );
      });
    });
  });

  describe("Image Container Styling", () => {
    it("renders image containers with correct aspect ratio", () => {
      const { container } = render(<FoodGallery />);

      const imageContainers = container.querySelectorAll(".aspect-square");
      expect(imageContainers).toHaveLength(10);
    });

    it("renders image containers with rounded corners", () => {
      const { container } = render(<FoodGallery />);

      const imageContainers = container.querySelectorAll(".rounded-2xl");
      expect(imageContainers).toHaveLength(10);
    });

    it("renders image containers with overflow hidden", () => {
      const { container } = render(<FoodGallery />);

      const imageContainers = container.querySelectorAll(".overflow-hidden");
      expect(imageContainers).toHaveLength(10);
    });
  });

  describe("Responsive Behavior", () => {
    it("applies mobile grid layout (2 columns)", () => {
      const { container } = render(<FoodGallery />);

      const grid = container.querySelector(".grid-cols-2");
      expect(grid).toBeInTheDocument();
    });

    it("applies desktop grid layout (5 columns)", () => {
      const { container } = render(<FoodGallery />);

      const grid = container.querySelector(".md\\:grid-cols-5");
      expect(grid).toBeInTheDocument();
    });

    it("applies responsive gap styling", () => {
      const { container } = render(<FoodGallery />);

      const grid = container.querySelector(
        ".gap-4.md\\:gap-6.lg\\:gap-8"
      );
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("all images have alt text for screen readers", () => {
      render(<FoodGallery />);

      const images = screen.getAllByRole("img");
      images.forEach((image) => {
        expect(image).toHaveAttribute("alt");
        expect(image.getAttribute("alt")).not.toBe("");
      });
    });

    it("images have descriptive alt text (not generic)", () => {
      render(<FoodGallery />);

      const images = screen.getAllByRole("img");
      images.forEach((image) => {
        const altText = image.getAttribute("alt");
        expect(altText).not.toMatch(/^image$/i);
        expect(altText).not.toMatch(/^photo$/i);
        expect(altText).not.toMatch(/^picture$/i);
      });
    });
  });

  describe("Next.js Image Optimization", () => {
    it("renders images with object-cover for proper scaling", () => {
      const { container } = render(<FoodGallery />);

      const images = container.querySelectorAll("img.object-cover");
      expect(images.length).toBeGreaterThan(0);
    });

    it("images use fill layout mode", () => {
      const { container } = render(<FoodGallery />);

      // Next.js Image with fill prop sets position: absolute
      const imageWrappers = container.querySelectorAll(".relative");
      expect(imageWrappers.length).toBeGreaterThanOrEqual(10);
    });
  });
});
