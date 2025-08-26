import React from "react";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "@/components/Common/Breadcrumb";

describe("Breadcrumb - Mobile Responsiveness", () => {
  const mockPageName = "Test Page";
  const mockPageDescription = "This is a test page description";

  describe("Responsive Layout and Sizing", () => {
    it("should have mobile-first responsive padding", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass(
        "px-3",
        "sm:px-4",
        "md:px-6",
        "lg:px-8",
      );
    });

    it("should have responsive top and bottom padding", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass(
        "pt-[80px]",
        "sm:pt-[100px]",
        "md:pt-[130px]",
        "lg:pt-[160px]",
      );
    });

    it("should have responsive bottom padding", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass(
        "pb-[40px]",
        "sm:pb-[50px]",
        "md:pb-[60px]",
      );
    });
  });

  describe("Responsive Typography", () => {
    it("should have responsive page title sizing", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const title = screen.getByText(mockPageName);
      expect(title).toHaveClass(
        "text-2xl",
        "sm:text-3xl",
        "md:text-4xl",
        "lg:text-[40px]",
      );
    });

    it("should have responsive title margins", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const title = screen.getByText(mockPageName);
      expect(title).toHaveClass("mb-3", "sm:mb-4");
    });

    it("should have responsive title line height on larger screens", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const title = screen.getByText(mockPageName);
      expect(title).toHaveClass("lg:leading-[1.2]");
    });
  });

  describe("Responsive Description", () => {
    it("should have responsive description text sizing", () => {
      render(
        <Breadcrumb
          pageName={mockPageName}
          pageDescription={mockPageDescription}
        />,
      );

      const description = screen.getByText(mockPageDescription);
      expect(description).toHaveClass("text-sm", "sm:text-base");
    });

    it("should have responsive description margins", () => {
      render(
        <Breadcrumb
          pageName={mockPageName}
          pageDescription={mockPageDescription}
        />,
      );

      const description = screen.getByText(mockPageDescription);
      expect(description).toHaveClass("mb-4", "sm:mb-5");
    });
  });

  describe("Responsive Navigation", () => {
    it("should have responsive navigation gap spacing", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const navigationList = screen.getByText("Home").closest("ul");
      expect(navigationList).toHaveClass("gap-[8px]", "sm:gap-[10px]");
    });

    it("should have responsive navigation text sizing", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const homeLink = screen.getByText("Home");
      expect(homeLink).toHaveClass("text-sm", "sm:text-base");
    });

    it("should have responsive navigation spacing", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const homeLink = screen.getByText("Home");
      expect(homeLink).toHaveClass("gap-[8px]", "sm:gap-[10px]");
    });
  });

  describe("Responsive Container Structure", () => {
    it("should have responsive margin structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const marginContainer = screen
        .getByText(mockPageName)
        .closest("div")?.parentElement;
      expect(marginContainer).toHaveClass("-mx-3", "sm:-mx-4");
    });

    it("should have responsive padding structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const paddingContainer = screen.getByText(mockPageName).closest("div");
      expect(paddingContainer).toHaveClass("px-3", "sm:px-4");
    });
  });

  describe("Responsive Background and Styling", () => {
    it("should maintain background image styling", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass(
        "bg-cover",
        "bg-center",
        "bg-no-repeat",
      );
    });

    it("should have responsive overflow handling", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass("overflow-hidden");
    });

    it("should maintain z-index and positioning", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass("relative", "z-10");
    });
  });

  describe("Responsive Border and Divider", () => {
    it("should maintain responsive border styling", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const borderDiv = screen
        .getByText(mockPageName)
        .closest("div")?.nextElementSibling;
      expect(borderDiv).toHaveClass(
        "bg-gradient-to-r",
        "from-stroke/0",
        "via-stroke",
        "to-stroke/0",
      );
    });

    it("should have responsive dark mode support", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const borderDiv = screen
        .getByText(mockPageName)
        .closest("div")?.nextElementSibling;
      expect(borderDiv).toHaveClass("dark:via-dark-3");
    });
  });

  describe("Responsive Content Alignment", () => {
    it("should maintain center alignment across all screen sizes", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const contentContainer = screen.getByText(mockPageName).closest("div");
      expect(contentContainer).toHaveClass("text-center");
    });

    it("should maintain flex layout structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const flexContainer = screen
        .getByText(mockPageName)
        .closest("div")?.parentElement;
      expect(flexContainer).toHaveClass("flex", "flex-wrap", "items-center");
    });
  });

  describe("Responsive Accessibility", () => {
    it("should maintain proper heading structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const title = screen.getByText(mockPageName);
      expect(title.tagName).toBe("H1");
    });

    it("should maintain proper link structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const homeLink = screen.getByText("Home");
      expect(homeLink.tagName).toBe("A");
      expect(homeLink).toHaveAttribute("href", "/");
    });

    it("should maintain proper list structure", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const navigationList = screen.getByText("Home").closest("ul");
      expect(navigationList).toBeInTheDocument();
    });
  });

  describe("Responsive Breakpoint Behavior", () => {
    it("should apply mobile-first responsive classes", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");

      // Mobile-first approach: base classes should be present
      expect(mainContainer).toHaveClass("px-3", "pt-[80px]", "pb-[40px]");

      // Responsive variants should also be present
      expect(mainContainer).toHaveClass("sm:px-4", "md:px-6", "lg:px-8");
    });

    it("should handle all responsive breakpoints correctly", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = screen.getByText(mockPageName).closest("div");

      // Check all breakpoint variants are present
      expect(mainContainer).toHaveClass("sm:px-4", "md:px-6", "lg:px-8");
      expect(mainContainer).toHaveClass(
        "sm:pt-[100px]",
        "md:pt-[130px]",
        "lg:pt-[160px]",
      );
      expect(mainContainer).toHaveClass("sm:pb-[50px]", "md:pb-[60px]");
    });
  });

  describe("Responsive Content Rendering", () => {
    it("should render without page description", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      expect(screen.getByText(mockPageName)).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.queryByText(mockPageDescription)).not.toBeInTheDocument();
    });

    it("should render with page description", () => {
      render(
        <Breadcrumb
          pageName={mockPageName}
          pageDescription={mockPageDescription}
        />,
      );

      expect(screen.getByText(mockPageName)).toBeInTheDocument();
      expect(screen.getByText(mockPageDescription)).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("should maintain responsive structure regardless of content", () => {
      render(
        <Breadcrumb
          pageName={mockPageName}
          pageDescription={mockPageDescription}
        />,
      );

      const mainContainer = screen.getByText(mockPageName).closest("div");
      expect(mainContainer).toHaveClass(
        "px-3",
        "sm:px-4",
        "md:px-6",
        "lg:px-8",
      );
    });
  });
});
