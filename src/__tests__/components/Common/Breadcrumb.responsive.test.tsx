import React from "react";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "@/components/Common/Breadcrumb";

describe("Breadcrumb - Mobile Responsiveness", () => {
  const mockPageName = "Test Page";
  const mockPageDescription = "This is a test page description";

  // Helper to get the main container (outermost styled div with background)
  const getMainContainer = () => {
    const title = screen.getByText(mockPageName);
    // Navigate up: h1 -> text-center -> w-full px-3 -> flex -mx-3 -> relative px-3 -> main container
    return title.closest("div")?.parentElement?.parentElement?.parentElement?.parentElement;
  };

  // Helper to get the content wrapper with responsive padding
  const getContentWrapper = () => {
    const title = screen.getByText(mockPageName);
    // Navigate up: h1 -> text-center -> w-full px-3 -> flex -mx-3 -> relative px-3
    return title.closest("div")?.parentElement?.parentElement?.parentElement;
  };

  describe("Responsive Layout and Sizing", () => {
    it("should have mobile-first responsive padding on content wrapper", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const contentWrapper = getContentWrapper();
      expect(contentWrapper).toHaveClass(
        "px-3",
        "sm:px-4",
        "md:px-6",
        "lg:px-8",
      );
    });

    it("should have responsive top padding on main container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      expect(mainContainer).toHaveClass(
        "pt-[80px]",
        "sm:pt-[100px]",
        "md:pt-[130px]",
        "lg:pt-[160px]",
      );
    });

    it("should have responsive bottom padding on main container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
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
    it("should have responsive margin structure on flex container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      // Navigate: h1 -> text-center -> w-full -> flex -mx-3
      const flexContainer = screen
        .getByText(mockPageName)
        .closest("div")?.parentElement?.parentElement;
      expect(flexContainer).toHaveClass("-mx-3", "sm:-mx-4");
    });

    it("should have responsive padding structure on inner container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      // Navigate: h1 -> text-center -> w-full px-3
      const innerContainer = screen.getByText(mockPageName).closest("div")?.parentElement;
      expect(innerContainer).toHaveClass("px-3", "sm:px-4");
    });
  });

  describe("Responsive Background and Styling", () => {
    it("should maintain background image styling on main container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      expect(mainContainer).toHaveClass(
        "bg-cover",
        "bg-center",
        "bg-no-repeat",
      );
    });

    it("should have overflow handling on main container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      expect(mainContainer).toHaveClass("overflow-hidden");
    });

    it("should maintain z-index and positioning on main container", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      expect(mainContainer).toHaveClass("relative", "z-10");
    });
  });

  describe("Responsive Border and Divider", () => {
    it("should have gradient border styling", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      // The border div is the first child of main container (absolute positioned)
      const mainContainer = getMainContainer();
      const borderDiv = mainContainer?.querySelector(".absolute");
      expect(borderDiv).toHaveClass(
        "bg-gradient-to-r",
        "from-stroke/0",
        "via-stroke",
        "to-stroke/0",
      );
    });

    it("should have dark mode support for border", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      const borderDiv = mainContainer?.querySelector(".absolute");
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

      // Navigate: h1 -> text-center -> w-full -> flex container
      const flexContainer = screen
        .getByText(mockPageName)
        .closest("div")?.parentElement?.parentElement;
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

      const mainContainer = getMainContainer();
      const contentWrapper = getContentWrapper();

      // Mobile-first padding on main container
      expect(mainContainer).toHaveClass("pt-[80px]", "pb-[40px]");

      // Responsive padding variants on content wrapper
      expect(contentWrapper).toHaveClass("px-3", "sm:px-4", "md:px-6", "lg:px-8");
    });

    it("should handle all responsive breakpoints correctly", () => {
      render(<Breadcrumb pageName={mockPageName} />);

      const mainContainer = getMainContainer();
      const contentWrapper = getContentWrapper();

      // Check responsive padding on content wrapper
      expect(contentWrapper).toHaveClass("sm:px-4", "md:px-6", "lg:px-8");

      // Check responsive vertical padding on main container
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

      const contentWrapper = getContentWrapper();
      expect(contentWrapper).toHaveClass(
        "px-3",
        "sm:px-4",
        "md:px-6",
        "lg:px-8",
      );
    });
  });
});
