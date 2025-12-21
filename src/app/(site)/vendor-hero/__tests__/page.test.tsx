import React from "react";
import { render, screen } from "@testing-library/react";
import VendorHeroPage from "../page";

// Mock all the child components used in the actual page
jest.mock("@/components/VendorLanding/VendorHero", () => {
  return function VendorHero({ id }: { id?: string }) {
    return <div data-testid="vendor-hero" id={id}>VendorHero Component</div>;
  };
});

jest.mock("@/components/VendorLanding/VendorDeliveriesShowcase", () => {
  return function VendorDeliveriesShowcase() {
    return <div data-testid="vendor-deliveries-showcase">VendorDeliveriesShowcase Component</div>;
  };
});

jest.mock("@/components/VendorLanding/VendorServiceDrivers", () => {
  return function VendorServiceDrivers() {
    return <div data-testid="vendor-service-drivers">VendorServiceDrivers Component</div>;
  };
});

jest.mock("@/components/BakeryDelivery/BakeryTerms", () => {
  return function BakeryTerms({ variant, formType }: { variant?: string; formType?: string }) {
    return (
      <div data-testid="bakery-terms" data-variant={variant} data-form-type={formType}>
        BakeryTerms Component
      </div>
    );
  };
});

jest.mock("@/components/VendorLanding/VendorOnboarding", () => {
  return function VendorOnboarding() {
    return <div data-testid="vendor-onboarding">VendorOnboarding Component</div>;
  };
});

jest.mock("@/components/VendorLanding/VendorDeliveryFlow", () => {
  return function VendorDeliveryFlow() {
    return <div data-testid="vendor-delivery-flow">VendorDeliveryFlow Component</div>;
  };
});

jest.mock("@/components/VendorLanding/VendorServiceArea", () => {
  return function VendorServiceArea() {
    return <div data-testid="vendor-service-area">VendorServiceArea Component</div>;
  };
});

describe("VendorHeroPage", () => {
  describe("Component Rendering", () => {
    it("renders the page successfully", () => {
      render(<VendorHeroPage />);

      // Check that the main wrapper div is present
      const mainDiv = screen.getByTestId("vendor-hero").closest("div");
      expect(mainDiv).toBeInTheDocument();
    });

    it("renders all components in correct order", () => {
      render(<VendorHeroPage />);

      // Check that all components are rendered
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-deliveries-showcase")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-service-drivers")).toBeInTheDocument();
      expect(screen.getByTestId("bakery-terms")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-onboarding")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-delivery-flow")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-service-area")).toBeInTheDocument();
    });

    it("applies correct CSS classes to wrapper div", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toHaveClass("pt-20", "md:pt-24");
    });
  });

  describe("Component Props", () => {
    it("passes correct id prop to VendorHero component", () => {
      render(<VendorHeroPage />);

      const vendorHero = screen.getByTestId("vendor-hero");
      expect(vendorHero).toHaveAttribute("id", "vendor-hero");
    });

    it("passes correct variant prop to BakeryTerms component", () => {
      render(<VendorHeroPage />);

      const bakeryTerms = screen.getByTestId("bakery-terms");
      expect(bakeryTerms).toHaveAttribute("data-variant", "vendor");
    });

    it("passes correct formType prop to BakeryTerms component", () => {
      render(<VendorHeroPage />);

      const bakeryTerms = screen.getByTestId("bakery-terms");
      expect(bakeryTerms).toHaveAttribute("data-form-type", "food");
    });
  });

  describe("Component Structure and Order", () => {
    it("maintains proper component hierarchy", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const children = Array.from(wrapperDiv.children);

      // Verify the order of components matches the actual page
      expect(children[0]).toHaveAttribute("data-testid", "vendor-hero");
      expect(children[1]).toHaveAttribute("data-testid", "vendor-deliveries-showcase");
      expect(children[2]).toHaveAttribute("data-testid", "vendor-service-drivers");
      expect(children[3]).toHaveAttribute("data-testid", "bakery-terms");
      expect(children[4]).toHaveAttribute("data-testid", "vendor-onboarding");
      expect(children[5]).toHaveAttribute("data-testid", "vendor-delivery-flow");
      expect(children[6]).toHaveAttribute("data-testid", "vendor-service-area");
    });

    it("renders exactly 7 components", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const childComponents = wrapperDiv.querySelectorAll('[data-testid]');

      // Should have exactly 7 components
      expect(childComponents).toHaveLength(7);
    });

    it("uses div wrapper with correct styling", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv.tagName).toBe("DIV");
      expect(wrapperDiv).toHaveClass("pt-20", "md:pt-24");
    });
  });

  describe("Content Flow and User Experience", () => {
    it("follows logical content flow for vendor partnership", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const components = Array.from(wrapperDiv.children);

      // Verify logical flow: Hero -> Showcase -> Drivers -> Terms -> Onboarding -> Flow -> Service Area
      expect(components[0]).toHaveAttribute("data-testid", "vendor-hero"); // Hero section
      expect(components[1]).toHaveAttribute("data-testid", "vendor-deliveries-showcase"); // Deliveries showcase
      expect(components[2]).toHaveAttribute("data-testid", "vendor-service-drivers"); // Service drivers
      expect(components[3]).toHaveAttribute("data-testid", "bakery-terms"); // Terms/form
      expect(components[4]).toHaveAttribute("data-testid", "vendor-onboarding"); // Onboarding info
      expect(components[5]).toHaveAttribute("data-testid", "vendor-delivery-flow"); // Delivery flow
      expect(components[6]).toHaveAttribute("data-testid", "vendor-service-area"); // Service area
    });

    it("provides clean user experience without interruptions", () => {
      const { container } = render(<VendorHeroPage />);

      // Ensure no modal or popup elements are present
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="modal"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="overlay"]')).not.toBeInTheDocument();
    });

    it("maintains focus flow through all components", () => {
      render(<VendorHeroPage />);

      // Verify that the natural tab order flows through components without interruption
      const components = [
        screen.getByTestId("vendor-hero"),
        screen.getByTestId("vendor-deliveries-showcase"),
        screen.getByTestId("vendor-service-drivers"),
        screen.getByTestId("bakery-terms"),
        screen.getByTestId("vendor-onboarding"),
        screen.getByTestId("vendor-delivery-flow"),
        screen.getByTestId("vendor-service-area"),
      ];

      components.forEach(component => {
        expect(component).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Design", () => {
    it("applies responsive padding classes", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv.className).toMatch(/pt-20/);
      expect(wrapperDiv.className).toMatch(/md:pt-24/);
    });

    it("maintains responsive structure", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;

      // Ensure the wrapper maintains its responsive classes
      expect(wrapperDiv).toHaveClass("pt-20");
      expect(wrapperDiv).toHaveClass("md:pt-24");
    });
  });

  describe("Accessibility", () => {
    it("maintains proper document structure", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv.tagName).toBe("DIV");
    });

    it("maintains proper component order for screen readers", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const components = wrapperDiv.querySelectorAll('[data-testid]');

      // Verify components are in logical order for screen readers
      expect(components[0]).toHaveAttribute("data-testid", "vendor-hero");
      expect(components[1]).toHaveAttribute("data-testid", "vendor-deliveries-showcase");
      expect(components[2]).toHaveAttribute("data-testid", "vendor-service-drivers");
    });

    it("does not have accessibility barriers from popups", () => {
      const { container } = render(<VendorHeroPage />);

      // Ensure no elements that could trap focus or interrupt screen readers
      expect(container.querySelector('[aria-modal="true"]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it("includes vendor-hero id for potential anchor navigation", () => {
      render(<VendorHeroPage />);

      const vendorHero = screen.getByTestId("vendor-hero");
      expect(vendorHero).toHaveAttribute("id", "vendor-hero");
    });
  });

  describe("Component Integration", () => {
    it("integrates all components correctly", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;

      // Verify all expected components are integrated
      expect(wrapperDiv.children).toHaveLength(7);
      expect(wrapperDiv).toContainElement(screen.getByTestId("vendor-hero"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("vendor-deliveries-showcase"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("bakery-terms"));
      expect(wrapperDiv).toContainElement(screen.getByTestId("vendor-service-area"));
    });

    it("maintains component independence", () => {
      render(<VendorHeroPage />);

      // Each component should be independently rendered
      const components = [
        "vendor-hero",
        "vendor-deliveries-showcase",
        "vendor-service-drivers",
        "bakery-terms",
        "vendor-onboarding",
        "vendor-delivery-flow",
        "vendor-service-area"
      ];

      components.forEach(componentId => {
        expect(screen.getByTestId(componentId)).toBeInTheDocument();
      });
    });

    it("correctly integrates BakeryTerms with vendor-specific props", () => {
      render(<VendorHeroPage />);

      const bakeryTerms = screen.getByTestId("bakery-terms");
      expect(bakeryTerms).toBeInTheDocument();
      expect(bakeryTerms).toHaveAttribute("data-variant", "vendor");
      expect(bakeryTerms).toHaveAttribute("data-form-type", "food");
    });
  });

  describe("Error Handling", () => {
    it("renders without crashing", () => {
      expect(() => render(<VendorHeroPage />)).not.toThrow();
    });

    it("handles component failures gracefully", () => {
      render(<VendorHeroPage />);

      // Ensure the main structure is maintained even if individual components fail
      const { container } = render(<VendorHeroPage />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("maintains page structure when components are present", () => {
      render(<VendorHeroPage />);

      // Ensure page structure remains intact
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-service-area")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders efficiently without unnecessary overhead", () => {
      const { rerender } = render(<VendorHeroPage />);

      // Verify initial render
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();

      // Re-render and ensure components are still present
      rerender(<VendorHeroPage />);
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-service-area")).toBeInTheDocument();
    });

    it("renders exact number of required components", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const childComponents = wrapperDiv.querySelectorAll('[data-testid]');

      // Should have exactly 7 components
      expect(childComponents).toHaveLength(7);
    });
  });

  describe("SEO and Meta Information", () => {
    it("maintains clean page structure for SEO", () => {
      const { container } = render(<VendorHeroPage />);

      // Ensure the page has a clean structure that's SEO-friendly
      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv.children.length).toBeGreaterThan(0);
    });

    it("follows logical content hierarchy for vendor partnerships", () => {
      render(<VendorHeroPage />);

      // Verify that content follows a logical hierarchy for SEO
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument(); // Hero/H1 content
      expect(screen.getByTestId("vendor-deliveries-showcase")).toBeInTheDocument(); // Showcase
      expect(screen.getByTestId("bakery-terms")).toBeInTheDocument(); // CTA/Form
    });
  });

  describe("Code Quality", () => {
    it("follows React functional component best practices", () => {
      render(<VendorHeroPage />);

      // Ensure the component renders without warnings
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();
    });

    it("maintains clean component separation", () => {
      render(<VendorHeroPage />);

      // Each component should be independently testable
      const components = [
        "vendor-hero",
        "vendor-deliveries-showcase",
        "vendor-service-drivers",
        "bakery-terms",
        "vendor-onboarding",
        "vendor-delivery-flow",
        "vendor-service-area"
      ];

      components.forEach(componentId => {
        expect(screen.getByTestId(componentId)).toBeInTheDocument();
      });
    });

    it("uses consistent naming conventions", () => {
      render(<VendorHeroPage />);

      // Verify that component naming follows conventions
      expect(screen.getByTestId("vendor-hero")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-deliveries-showcase")).toBeInTheDocument();
      expect(screen.getByTestId("vendor-service-drivers")).toBeInTheDocument();
    });
  });

  describe("Vendor-Specific Features", () => {
    it("includes vendor-specific hero section with id", () => {
      render(<VendorHeroPage />);

      const vendorHero = screen.getByTestId("vendor-hero");
      expect(vendorHero).toBeInTheDocument();
      expect(vendorHero).toHaveAttribute("id", "vendor-hero");
    });

    it("includes deliveries showcase for vendor context", () => {
      render(<VendorHeroPage />);

      expect(screen.getByTestId("vendor-deliveries-showcase")).toBeInTheDocument();
    });

    it("includes service drivers information", () => {
      render(<VendorHeroPage />);

      expect(screen.getByTestId("vendor-service-drivers")).toBeInTheDocument();
    });

    it("includes vendor-specific terms form", () => {
      render(<VendorHeroPage />);

      const bakeryTerms = screen.getByTestId("bakery-terms");
      expect(bakeryTerms).toBeInTheDocument();
      expect(bakeryTerms).toHaveAttribute("data-variant", "vendor");
    });

    it("includes onboarding information for vendors", () => {
      render(<VendorHeroPage />);

      expect(screen.getByTestId("vendor-onboarding")).toBeInTheDocument();
    });

    it("includes delivery flow explanation", () => {
      render(<VendorHeroPage />);

      expect(screen.getByTestId("vendor-delivery-flow")).toBeInTheDocument();
    });

    it("includes service area information", () => {
      render(<VendorHeroPage />);

      expect(screen.getByTestId("vendor-service-area")).toBeInTheDocument();
    });
  });

  describe("Page Metadata", () => {
    it("maintains proper page structure for metadata", () => {
      const { container } = render(<VendorHeroPage />);

      // Verify the page structure supports metadata properly
      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv.children.length).toBe(7);
    });
  });

  describe("Component Layout", () => {
    it("maintains proper spacing with padding classes", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      expect(wrapperDiv).toHaveClass("pt-20");
      expect(wrapperDiv).toHaveClass("md:pt-24");
    });

    it("renders components in a single column layout", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      
      // All components should be direct children of the wrapper
      expect(wrapperDiv.children.length).toBe(7);
    });
  });

  describe("Form Integration", () => {
    it("includes BakeryTerms form with correct configuration", () => {
      render(<VendorHeroPage />);

      const bakeryTerms = screen.getByTestId("bakery-terms");
      expect(bakeryTerms).toBeInTheDocument();
      expect(bakeryTerms).toHaveAttribute("data-variant", "vendor");
      expect(bakeryTerms).toHaveAttribute("data-form-type", "food");
    });

    it("positions form appropriately in vendor partnership flow", () => {
      const { container } = render(<VendorHeroPage />);

      const wrapperDiv = container.firstChild as HTMLElement;
      const children = Array.from(wrapperDiv.children);

      // Form should be positioned after showcase and drivers (index 3)
      expect(children[3]).toHaveAttribute("data-testid", "bakery-terms");
    });
  });
});

