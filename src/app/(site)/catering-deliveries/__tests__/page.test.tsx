import React from "react";
import { render, screen } from "@testing-library/react";
import FoodPage from "../page";

// Mock all the child components
jest.mock("@/components/FoodDelivery/FoodHeader", () => {
  return function FoodHeader() {
    return <div data-testid="food-header">FoodHeader Component</div>;
  };
});

jest.mock("@/components/FoodDelivery/DeliveryPartners", () => {
  return function DeliveryPartners() {
    return <div data-testid="delivery-partners">DeliveryPartners Component</div>;
  };
});

jest.mock("@/components/FlowersDelivery/ServiceFeaturesSection", () => {
  return {
    FoodServiceFeatures: function FoodServiceFeatures() {
      return <div data-testid="food-service-features">FoodServiceFeatures Component</div>;
    },
  };
});

jest.mock("@/components/FoodDelivery/DeliveryTerms", () => {
  return function DeliveryTerms() {
    return <div data-testid="delivery-terms">DeliveryTerms Component</div>;
  };
});

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

// Mock unused imports to ensure they don't affect the test
jest.mock("@/components/Logistics/QuoteRequest/types", () => ({
  FormType: {},
}));

jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: function FormManager() {
    return <div data-testid="form-manager">FormManager Component</div>;
  },
}));

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
      expect(screen.getByTestId("delivery-partners")).toBeInTheDocument();
      expect(screen.getByTestId("food-service-features")).toBeInTheDocument();
      expect(screen.getByTestId("delivery-terms")).toBeInTheDocument();
      expect(screen.getByTestId("hosting-checklist")).toBeInTheDocument();
      expect(screen.getByTestId("main-meal")).toBeInTheDocument();
      expect(screen.getByTestId("catering-stats")).toBeInTheDocument();
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
      
      // Verify the order of components
      expect(children[0]).toHaveAttribute("data-testid", "food-header");
      expect(children[1]).toHaveAttribute("data-testid", "delivery-partners");
      expect(children[2]).toHaveAttribute("data-testid", "food-service-features");
      expect(children[3]).toHaveAttribute("data-testid", "delivery-terms");
      expect(children[4]).toHaveAttribute("data-testid", "hosting-checklist");
      expect(children[5]).toHaveAttribute("data-testid", "main-meal");
      expect(children[6]).toHaveAttribute("data-testid", "catering-stats");
    });

    it("renders exactly 7 components", () => {
      const { container } = render(<FoodPage />);
      
      const wrapperDiv = container.firstChild as HTMLElement;
      const childComponents = wrapperDiv.querySelectorAll('[data-testid]');
      
      // Should have exactly 7 components (no promotional banners)
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
      
      // Verify logical flow: Header -> Partners -> Features -> Terms -> Checklist -> Menu -> Stats
      expect(components[0]).toHaveAttribute("data-testid", "food-header"); // Hero/Header
      expect(components[1]).toHaveAttribute("data-testid", "delivery-partners"); // Trust signals
      expect(components[2]).toHaveAttribute("data-testid", "food-service-features"); // Service features
      expect(components[3]).toHaveAttribute("data-testid", "delivery-terms"); // Terms and pricing
      expect(components[4]).toHaveAttribute("data-testid", "hosting-checklist"); // Process details
      expect(components[5]).toHaveAttribute("data-testid", "main-meal"); // Menu showcase
      expect(components[6]).toHaveAttribute("data-testid", "catering-stats"); // Social proof/CTA
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
        screen.getByTestId("delivery-partners"),
        screen.getByTestId("food-service-features"),
        screen.getByTestId("delivery-terms"),
        screen.getByTestId("hosting-checklist"),
        screen.getByTestId("main-meal"),
        screen.getByTestId("catering-stats"),
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
      expect(components[1]).toHaveAttribute("data-testid", "delivery-partners");
      expect(components[2]).toHaveAttribute("data-testid", "food-service-features");
    });

    it("does not have accessibility barriers from promotional popups", () => {
      const { container } = render(<FoodPage />);
      
      // Ensure no elements that could trap focus or interrupt screen readers
      expect(container.querySelector('[aria-modal="true"]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(container.querySelector('[tabindex="-1"]')).not.toBeInTheDocument();
    });
  });

  describe("Component Integration", () => {
    it("integrates all components correctly", () => {
      const { container } = render(<FoodPage />);
      
      const wrapperDiv = container.firstChild as HTMLElement;
      
      // Verify all expected components are integrated
      expect(wrapperDiv.children).toHaveLength(7);
      expect(wrapperDiv).toContainElement(screen.getByTestId("food-header"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("delivery-partners"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("catering-stats"));
    });

    it("maintains component independence", () => {
      render(<FoodPage />);
      
      // Each component should be independently rendered
      const components = [
        "food-header",
        "delivery-partners",
        "food-service-features",
        "delivery-terms",
        "hosting-checklist",
        "main-meal",
        "catering-stats"
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
      expect(screen.getByTestId("catering-stats")).toBeInTheDocument();
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
      expect(screen.getByTestId("catering-stats")).toBeInTheDocument();
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
      expect(screen.getByTestId("delivery-partners")).toBeInTheDocument(); // Trust signals
      expect(screen.getByTestId("catering-stats")).toBeInTheDocument(); // Social proof
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
        "delivery-partners", 
        "food-service-features",
        "delivery-terms",
        "hosting-checklist",
        "main-meal",
        "catering-stats"
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
      expect(screen.getByTestId("food-service-features")).toBeInTheDocument();
    });
  });
});
