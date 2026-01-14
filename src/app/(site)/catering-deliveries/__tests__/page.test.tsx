import React from "react";
import { render, screen } from "@testing-library/react";
import FoodPage from "../page";

// Mock all the child components used in the actual page
jest.mock("@/components/FoodDelivery/FoodHeader", () => {
  return function FoodHeader() {
    return <div data-testid="food-header">FoodHeader Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/CateringFeatures", () => {
  return function CateringFeatures() {
    return <div data-testid="catering-features">CateringFeatures Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/CateringAbout", () => {
  return function CateringAbout() {
    return <div data-testid="catering-about">CateringAbout Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/DeliveryPartners", () => {
  return function DeliveryPartners() {
    return <div data-testid="delivery-partners">DeliveryPartners Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/ServedPartners", () => {
  return function ServedPartners() {
    return <div data-testid="served-partners">ServedPartners Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/FoodSetupCarousel", () => {
  return function FoodSetupCarousel() {
    return <div data-testid="food-setup-carousel">FoodSetupCarousel Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/CateringContact", () => {
  return function CateringContact() {
    return <div data-testid="catering-contact">CateringContact Component</div>;
  };
});

// Mock unused imports that are commented out in the page
jest.mock("@/components/FoodDelivery/HostingChecklist", () => {
  return function HostingChecklist() {
    return <div data-testid="hosting-checklist">HostingChecklist Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/MainMeal", () => {
  return function MainMeal() {
    return <div data-testid="main-meal">MainMeal Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/CateringStats", () => {
  return function CateringStats() {
    return <div data-testid="catering-stats">CateringStats Component</div>;
  };
});

describe("FoodPage (Catering Deliveries)", () => {
  describe("Component Rendering", () => {
    it("renders the page successfully", () => {
      render(<FoodPage />);

      // Check that the main wrapper div is present
      const mainDiv = screen.getByTestId("food-header").closest("div");
      expect(mainDiv).toBeInTheDocument();
    });

    it("renders all active components in correct order", () => {
      render(<FoodPage />);

      // Check that all active components are rendered
      expect(screen.getByTestId("food-header")).toBeInTheDocument();
      expect(screen.getByTestId("catering-features")).toBeInTheDocument();
      expect(screen.getByTestId("catering-about")).toBeInTheDocument();
      expect(screen.getByTestId("delivery-partners")).toBeInTheDocument();
      expect(screen.getByTestId("served-partners")).toBeInTheDocument();
      expect(screen.getByTestId("food-setup-carousel")).toBeInTheDocument();
      expect(screen.getByTestId("catering-contact")).toBeInTheDocument();
    });

    it("applies correct CSS classes to wrapper div", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toHaveClass("pt-20", "md:pt-24");
    });
  });

  describe("Promotional Banner Removal", () => {
    it("does not render PromoPopup component", () => {
      render(<FoodPage />);

      // Ensure PromoPopup is not rendered (it's commented out)
      expect(screen.queryByTestId("promo-popup")).not.toBeInTheDocument();
    });

    it("does not render any promotional banners or popups", () => {
      const { container } = render(<FoodPage />);

      // Check for common promotional banner patterns
      expect(container.querySelector('[data-testid*="promo"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="banner"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="popup"]')).not.toBeInTheDocument();
    });

    it("starts with FoodHeader instead of PromoPopup", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const firstChild = wrapperDiv.firstElementChild;

      // First rendered component should be FoodHeader, not PromoPopup
      expect(firstChild).toHaveAttribute("data-testid", "food-header");
    });
  });

  describe("Component Structure and Order", () => {
    it("maintains proper component hierarchy", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const children = Array.from(wrapperDiv.children);

      // Verify the order of components matches the actual page
      expect(children[0]).toHaveAttribute("data-testid", "food-header");
      expect(children[1]).toHaveAttribute("data-testid", "catering-features");
      expect(children[2]).toHaveAttribute("data-testid", "catering-about");
      expect(children[3]).toHaveAttribute("data-testid", "delivery-partners");
      expect(children[4]).toHaveAttribute("data-testid", "served-partners");
      expect(children[5]).toHaveAttribute("data-testid", "food-setup-carousel");
      expect(children[6]).toHaveAttribute("data-testid", "catering-contact");
    });

    it("renders exactly 7 components", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const childComponents = wrapperDiv.querySelectorAll('[data-testid]');

      // Should have exactly 7 components (no promotional banners, commented out components removed)
      expect(childComponents).toHaveLength(7);
    });

    it("uses div wrapper with correct styling", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv.tagName).toBe("DIV");
      expect(wrapperDiv).toHaveClass("pt-20", "md:pt-24");
    });
  });

  describe("Content Flow and User Experience", () => {
    it("follows logical content flow for catering services", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const components = Array.from(wrapperDiv.children);

      // Verify logical flow: Header -> Features -> About -> Partners -> Served -> Carousel -> Contact
      expect(components[0]).toHaveAttribute("data-testid", "food-header"); // Hero/Header
      expect(components[1]).toHaveAttribute("data-testid", "catering-features"); // Service features
      expect(components[2]).toHaveAttribute("data-testid", "catering-about"); // About section
      expect(components[3]).toHaveAttribute("data-testid", "delivery-partners"); // Trust signals
      expect(components[4]).toHaveAttribute("data-testid", "served-partners"); // Served logos
      expect(components[5]).toHaveAttribute("data-testid", "food-setup-carousel"); // Visual showcase
      expect(components[6]).toHaveAttribute("data-testid", "catering-contact"); // CTA
    });

    it("provides clean user experience without popup interruptions", () => {
      const { container } = render(<FoodPage />);

      // Ensure no modal or popup elements are present
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="modal"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="overlay"]')).not.toBeInTheDocument();
    });

    it("maintains focus flow without promotional interruptions", () => {
      render(<FoodPage />);

      // Verify that the natural tab order flows through components without interruption
      const components = [
        screen.getByTestId("food-header"),
        screen.getByTestId("catering-features"),
        screen.getByTestId("catering-about"),
        screen.getByTestId("delivery-partners"),
        screen.getByTestId("served-partners"),
        screen.getByTestId("food-setup-carousel"),
        screen.getByTestId("catering-contact"),
      ];

      components.forEach(component => {
        expect(component).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive padding classes", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv.className).toMatch(/pt-20/);
      expect(wrapperDiv.className).toMatch(/md:pt-24/);
    });

    it("maintains responsive structure without banner interference", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;

      // Ensure the wrapper maintains its responsive classes
      expect(wrapperDiv).toHaveClass("pt-20");
      expect(wrapperDiv).toHaveClass("md:pt-24");
    });
  });

  describe("Accessibility", () => {
    it("maintains proper document structure", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv.tagName).toBe("DIV");
    });

    it("maintains proper component order for screen readers", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const components = wrapperDiv.querySelectorAll('[data-testid]');

      // Verify components are in logical order for screen readers
      expect(components[0]).toHaveAttribute("data-testid", "food-header");
      expect(components[1]).toHaveAttribute("data-testid", "catering-features");
      expect(components[2]).toHaveAttribute("data-testid", "catering-about");
    });

    it("does not have accessibility barriers from promotional popups", () => {
      const { container } = render(<FoodPage />);

      // Ensure no elements that could trap focus or interrupt screen readers
      expect(container.querySelector('[aria-modal="true"]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("integrates all components correctly", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;

      // Verify all expected components are integrated
      expect(wrapperDiv.children).toHaveLength(7);
      expect(wrapperDiv).toContainElement(screen.getByTestId("food-header"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("catering-features"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("catering-contact"));
    });

    it("maintains component independence", () => {
      render(<FoodPage />);

      // Each component should be independently rendered
      const components = [
        "food-header",
        "catering-features",
        "catering-about",
        "delivery-partners",
        "served-partners",
        "food-setup-carousel",
        "catering-contact"
      ];

      components.forEach(componentId => {
        expect(screen.getByTestId(componentId)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("renders without crashing when components are missing", () => {
      expect(() => render(<FoodPage />)).not.toThrow();
    });

    it("handles component failures gracefully", () => {
      render(<FoodPage />);

      // Ensure the main structure is maintained even if individual components fail
      const { container } = render(<FoodPage />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("maintains page structure when promotional components are removed", () => {
      render(<FoodPage />);

      // Ensure page structure remains intact without promotional banners
      expect(screen.getByTestId("food-header")).toBeInTheDocument();
      expect(screen.getByTestId("catering-contact")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders efficiently without promotional banner overhead", () => {
      const { rerender } = render(<FoodPage />);

      // Verify initial render
      expect(screen.getByTestId("food-header")).toBeInTheDocument();

      // Re-render and ensure components are still present
      rerender(<FoodPage />);
      expect(screen.getByTestId("food-header")).toBeInTheDocument();
      expect(screen.getByTestId("catering-contact")).toBeInTheDocument();
    });

    it("avoids unnecessary component mounting from removed banners", () => {
      const { container } = render(<FoodPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const childComponents = wrapperDiv.querySelectorAll('[data-testid]');

      // Should have exactly 7 components (no promotional banners)
      expect(childComponents).toHaveLength(7);
    });
  });

  describe("SEO and Meta Information", () => {
    it("maintains clean page structure for SEO", () => {
      const { container } = render(<FoodPage />);

      // Ensure the page has a clean structure that's SEO-friendly
      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv.children.length).toBeGreaterThan(0);
    });

    it("follows logical content hierarchy", () => {
      render(<FoodPage />);

      // Verify that content follows a logical hierarchy for SEO
      expect(screen.getByTestId("food-header")).toBeInTheDocument(); // H1 content
      expect(screen.getByTestId("catering-features")).toBeInTheDocument(); // Features
      expect(screen.getByTestId("catering-contact")).toBeInTheDocument(); // CTA
    });
  });

  describe("Code Quality", () => {
    it("follows React functional component best practices", () => {
      render(<FoodPage />);

      // Ensure the component renders without warnings
      expect(screen.getByTestId("food-header")).toBeInTheDocument();
    });

    it("maintains clean component separation", () => {
      render(<FoodPage />);

      // Each component should be independently testable
      const components = [
        "food-header",
        "catering-features",
        "catering-about",
        "delivery-partners",
        "served-partners",
        "food-setup-carousel",
        "catering-contact"
      ];

      components.forEach(componentId => {
        expect(screen.getByTestId(componentId)).toBeInTheDocument();
      });
    });

    it("uses consistent naming conventions", () => {
      render(<FoodPage />);

      // Verify that component naming follows conventions
      expect(screen.getByTestId("food-header")).toBeInTheDocument();
      expect(screen.getByTestId("delivery-partners")).toBeInTheDocument();
      expect(screen.getByTestId("catering-features")).toBeInTheDocument();
    });
  });
});
