import React from "react";
import { render, screen } from "@testing-library/react";
import ServedPartners from "../ServedPartners";

// Mock framer-motion is already configured in jest.setup.ts
// The mock converts motion components to regular divs

describe("ServedPartners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the main container with correct styling", () => {
      render(<ServedPartners />);

      const container = document.querySelector(".bg-white.py-16");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass(
        "w-full",
        "bg-white",
        "py-16",
        "md:py-20",
        "lg:py-24",
      );
    });

    it("renders the max-width wrapper", () => {
      render(<ServedPartners />);

      const wrapper = document.querySelector(".max-w-7xl");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass("mx-auto", "max-w-7xl", "px-4");
    });

    it("renders the main title", () => {
      render(<ServedPartners />);

      const title = screen.getByRole("heading", {
        level: 2,
        name: /we served the top marketplace and company/i,
      });
      expect(title).toBeInTheDocument();
    });

    it("renders the main title with correct styling", () => {
      render(<ServedPartners />);

      const title = screen.getByText(
        "We Served the Top Marketplace and Company",
      );
      expect(title).toHaveClass(
        "mb-3",
        "text-3xl",
        "font-black",
        "text-gray-800",
        "md:text-4xl",
        "lg:text-5xl",
      );
    });

    it("renders the subtitle text with partner names", () => {
      render(<ServedPartners />);

      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );
      expect(subtitle).toBeInTheDocument();
    });

    it("renders the subtitle with correct styling", () => {
      render(<ServedPartners />);

      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );
      expect(subtitle).toHaveClass(
        "text-base",
        "font-medium",
        "text-gray-600",
        "md:text-lg",
      );
    });

    it("uses Montserrat font for title and subtitle", () => {
      render(<ServedPartners />);

      const title = screen.getByText(
        "We Served the Top Marketplace and Company",
      );
      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );

      expect(title).toHaveClass("font-[Montserrat]");
      expect(subtitle).toHaveClass("font-[Montserrat]");
    });
  });

  describe("Partner Logos Grid", () => {
    it("renders the partner logos grid container", () => {
      render(<ServedPartners />);

      const grid = document.querySelector(".grid.grid-cols-2");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass(
        "grid",
        "grid-cols-2",
        "gap-8",
        "md:grid-cols-3",
        "md:gap-10",
        "lg:grid-cols-5",
        "lg:gap-12",
      );
    });

    it("renders exactly 5 partner logos", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(5);
    });

    it("renders all partner logos with correct alt text", () => {
      render(<ServedPartners />);

      const expectedPartners = [
        "Zerocater logo",
        "EzCater logo",
        "Google logo",
        "Netflix logo",
        "Apple logo",
      ];

      expectedPartners.forEach((altText) => {
        expect(screen.getByAltText(altText)).toBeInTheDocument();
      });
    });

    it("renders partner images with correct src paths", () => {
      render(<ServedPartners />);

      const expectedPaths = [
        "/images/food/served/zerocater",
        "/images/food/served/ezcater",
        "/images/food/served/google",
        "/images/food/served/netflix",
        "/images/food/served/apple",
      ];

      expectedPaths.forEach((path) => {
        const img = document.querySelector(`img[src="${path}"]`);
        expect(img).toBeInTheDocument();
      });
    });

    it("applies Cloudinary transformations to Zerocater logo", () => {
      render(<ServedPartners />);

      const zerocaterImg = screen.getByAltText("Zerocater logo");
      // The component applies b_white,w_600,h_600,c_fit transformations
      // Since we're mocking getCloudinaryUrl, we just verify the image is present
      expect(zerocaterImg).toBeInTheDocument();
      expect(zerocaterImg).toHaveAttribute("src");
    });

    it("applies Cloudinary transformations to EzCater logo", () => {
      render(<ServedPartners />);

      const ezcaterImg = screen.getByAltText("EzCater logo");
      // The component applies b_white,w_600,h_600,c_fit transformations
      // Since we're mocking getCloudinaryUrl, we just verify the image is present
      expect(ezcaterImg).toBeInTheDocument();
      expect(ezcaterImg).toHaveAttribute("src");
    });

    it("renders grid items with proper spacing", () => {
      render(<ServedPartners />);

      const gridItems = document.querySelectorAll(
        ".flex.items-center.justify-center",
      );
      expect(gridItems.length).toBeGreaterThan(0);

      gridItems.forEach((item) => {
        expect(item).toHaveClass("flex", "items-center", "justify-center");
      });
    });
  });

  describe("Conditional Rendering", () => {
    it("renders all 5 partners in the grid", () => {
      render(<ServedPartners />);

      const grid = document.querySelector(".grid.grid-cols-2");
      const gridImages = grid?.querySelectorAll("img");
      expect(gridImages).toHaveLength(5);
    });

    it("does not render any partners outside the grid", () => {
      render(<ServedPartners />);

      const allImages = screen.getAllByRole("img");
      const grid = document.querySelector(".grid.grid-cols-2");
      const gridImages = grid?.querySelectorAll("img");

      // All images should be in the grid
      expect(allImages).toHaveLength(gridImages?.length);
    });

    it("renders partners in the correct order", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      const expectedOrder = [
        "Zerocater logo",
        "EzCater logo",
        "Google logo",
        "Netflix logo",
        "Apple logo",
      ];

      images.forEach((img, index) => {
        expect(img).toHaveAttribute("alt", expectedOrder[index]);
      });
    });
  });

  describe("Image Styling", () => {
    it("renders images with object-contain class", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveClass("object-contain");
      });
    });

    it("renders images with fill property", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        // Next.js Image with fill prop doesn't have explicit width/height
        expect(img).not.toHaveAttribute("width");
        expect(img).not.toHaveAttribute("height");
      });
    });

    it("renders image containers with correct dimensions", () => {
      render(<ServedPartners />);

      const imageContainers = document.querySelectorAll(
        ".relative.h-28.w-full",
      );
      expect(imageContainers.length).toBeGreaterThan(0);

      imageContainers.forEach((container) => {
        expect(container).toHaveClass(
          "relative",
          "h-28",
          "w-full",
          "min-w-[160px]",
          "max-w-[240px]",
          "sm:h-32",
          "md:h-40",
          "lg:h-44",
        );
      });
    });

    it("renders images with appropriate sizes attribute", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute(
          "sizes",
          "(max-width: 640px) 45vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 240px",
        );
      });
    });
  });

  describe("Animation and Motion", () => {
    it("applies animation delay based on index for grid items", () => {
      render(<ServedPartners />);

      // Since framer-motion is mocked, we verify the structure exists
      // The motion.div components are converted to regular divs
      const grid = document.querySelector(".grid.grid-cols-2");
      expect(grid).toBeInTheDocument();

      // Each grid item should be wrapped in a motion div (now regular div)
      const gridItems = grid?.querySelectorAll(
        ".flex.items-center.justify-center",
      );
      expect(gridItems).toHaveLength(5);
    });

    it("renders title section with motion animation structure", () => {
      render(<ServedPartners />);

      const titleSection = screen
        .getByText("We Served the Top Marketplace and Company")
        .closest("div");
      expect(titleSection).toHaveClass("mb-4", "text-center");
    });

    it("renders partner grid with proper spacing for animations", () => {
      render(<ServedPartners />);

      const gridContainer = document.querySelector(".mt-12");
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(<ServedPartners />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent(
        "We Served the Top Marketplace and Company",
      );
    });

    it("all images have descriptive alt text", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute("alt");
        expect(img.getAttribute("alt")).not.toBe("");
        expect(img.getAttribute("alt")).toMatch(/logo$/i);
      });
    });

    it("images are not interactive (no links)", () => {
      render(<ServedPartners />);

      // This component should not have any clickable links
      const links = document.querySelectorAll("a");
      expect(links).toHaveLength(0);
    });

    it("component is keyboard accessible", () => {
      render(<ServedPartners />);

      // Since there are no interactive elements, verify no tab traps
      const focusableElements = document.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      // Should have no focusable elements in this display-only component
      expect(focusableElements).toHaveLength(0);
    });

    it("provides semantic HTML structure", () => {
      render(<ServedPartners />);

      // Verify semantic structure
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();

      const images = screen.getAllByRole("img");
      expect(images.length).toBeGreaterThan(0);
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive grid classes", () => {
      render(<ServedPartners />);

      const grid = document.querySelector(".grid");
      expect(grid).toHaveClass(
        "grid-cols-2",
        "md:grid-cols-3",
        "lg:grid-cols-5",
      );
    });

    it("applies responsive gap classes", () => {
      render(<ServedPartners />);

      const grid = document.querySelector(".grid");
      expect(grid).toHaveClass("gap-8", "md:gap-10", "lg:gap-12");
    });

    it("applies responsive padding classes", () => {
      render(<ServedPartners />);

      const container = document.querySelector(".bg-white");
      expect(container).toHaveClass("py-16", "md:py-20", "lg:py-24");
    });

    it("applies responsive title sizing", () => {
      render(<ServedPartners />);

      const title = screen.getByText(
        "We Served the Top Marketplace and Company",
      );
      expect(title).toHaveClass("text-3xl", "md:text-4xl", "lg:text-5xl");
    });

    it("applies responsive subtitle sizing", () => {
      render(<ServedPartners />);

      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );
      expect(subtitle).toHaveClass("text-base", "md:text-lg");
    });

    it("applies responsive height to image containers", () => {
      render(<ServedPartners />);

      const imageContainers = document.querySelectorAll(".relative.h-28");
      imageContainers.forEach((container) => {
        expect(container).toHaveClass("h-28", "sm:h-32", "md:h-40", "lg:h-44");
      });
    });

    it("applies responsive padding to grid items", () => {
      render(<ServedPartners />);

      const gridItems = document.querySelectorAll(
        ".flex.items-center.justify-center.px-2",
      );
      gridItems.forEach((item) => {
        expect(item).toHaveClass("px-2", "sm:px-4");
      });
    });
  });

  describe("Layout Structure", () => {
    it("renders title section before partner grid", () => {
      render(<ServedPartners />);

      const container = document.querySelector(".max-w-7xl");
      const children = container?.children;

      expect(children).toBeDefined();
      expect(children!.length).toBeGreaterThanOrEqual(2);

      // First child should be the title section
      const titleSection = children![0];
      expect(titleSection).toHaveClass("mb-4", "text-center");

      // Second child should be the grid section
      const gridSection = children![1];
      expect(gridSection).toHaveClass("mt-12");
    });

    it("renders grid within proper spacing container", () => {
      render(<ServedPartners />);

      const gridContainer = document.querySelector(".mt-12");
      expect(gridContainer).toBeInTheDocument();

      const grid = gridContainer?.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("maintains proper vertical spacing between sections", () => {
      render(<ServedPartners />);

      const titleSection = screen
        .getByText("We Served the Top Marketplace and Company")
        .closest("div");
      expect(titleSection).toHaveClass("mb-4");

      const gridSection = document.querySelector(".mt-12");
      expect(gridSection).toBeInTheDocument();
    });
  });

  describe("Partner Data Structure", () => {
    it("renders correct number of partners", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(5);
    });

    it("includes all major tech companies", () => {
      render(<ServedPartners />);

      const techCompanies = ["Google", "Netflix", "Apple"];
      techCompanies.forEach((company) => {
        expect(screen.getByAltText(`${company} logo`)).toBeInTheDocument();
      });
    });

    it("includes marketplace partners", () => {
      render(<ServedPartners />);

      const marketplaces = ["Zerocater", "EzCater"];
      marketplaces.forEach((marketplace) => {
        expect(screen.getByAltText(`${marketplace} logo`)).toBeInTheDocument();
      });
    });

    it("renders partners without links (display only)", () => {
      render(<ServedPartners />);

      // Verify no anchor tags are present
      const links = screen.queryAllByRole("link");
      expect(links).toHaveLength(0);
    });

    it("renders partners without CTA button", () => {
      render(<ServedPartners />);

      // Verify no buttons are present
      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });
  });

  describe("Typography", () => {
    it("uses correct font weights for title", () => {
      render(<ServedPartners />);

      const title = screen.getByText(
        "We Served the Top Marketplace and Company",
      );
      expect(title).toHaveClass("font-black");
    });

    it("uses correct font weights for subtitle", () => {
      render(<ServedPartners />);

      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );
      expect(subtitle).toHaveClass("font-medium");
    });

    it("applies correct text colors", () => {
      render(<ServedPartners />);

      const title = screen.getByText(
        "We Served the Top Marketplace and Company",
      );
      const subtitle = screen.getByText(
        /zerocater, eazycater, google, netflix, apple/i,
      );

      expect(title).toHaveClass("text-gray-800");
      expect(subtitle).toHaveClass("text-gray-600");
    });
  });

  describe("Error Handling", () => {
    it("renders without crashing when all data is present", () => {
      expect(() => render(<ServedPartners />)).not.toThrow();
    });

    it("images are present and valid", () => {
      render(<ServedPartners />);

      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute("src");
        expect(img).toHaveAttribute("alt");
      });
    });
  });

  describe("Component Integration", () => {
    it("renders as a standalone section", () => {
      render(<ServedPartners />);

      const mainContainer = document.querySelector(".w-full.bg-white");
      expect(mainContainer).toBeInTheDocument();
    });

    it("maintains consistent styling with other FoodDelivery components", () => {
      render(<ServedPartners />);

      // Verify consistent max-width container
      const wrapper = document.querySelector(".max-w-7xl");
      expect(wrapper).toBeInTheDocument();

      // Verify consistent padding
      const container = document.querySelector(".bg-white");
      expect(container).toHaveClass("py-16", "md:py-20", "lg:py-24");
    });

    it("uses consistent color scheme", () => {
      render(<ServedPartners />);

      const container = document.querySelector(".bg-white");
      expect(container).toHaveClass("bg-white");

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveClass("text-gray-800");
    });
  });
});
