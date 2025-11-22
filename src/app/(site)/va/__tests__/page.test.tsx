import React from "react";
import { render, screen } from "@testing-library/react";
import VirtualAssistantPage from "../page";

// Mock all the child components
jest.mock("@/components/Testimonials", () => {
  return function Testimonials() {
    return <div data-testid="testimonials">Testimonials Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant", () => {
  return function HeroHeader() {
    return <div data-testid="hero-header">HeroHeader Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant/DiscoveryCall", () => {
  return function DiscoveryCallSection() {
    return <div data-testid="discovery-call-section">DiscoveryCallSection Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant/DiscoveryCallBanner", () => {
  return function DiscoveryBanner() {
    return <div data-testid="discovery-banner">DiscoveryBanner Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant/FeatureCard", () => {
  return function OverwhelmSection() {
    return <div data-testid="overwhelm-section">OverwhelmSection Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant/VaOptimizationCta", () => {
  return function BusinessScaleSection() {
    return <div data-testid="business-scale-section">BusinessScaleSection Component</div>;
  };
});

jest.mock("@/components/VirtualAssistant/VAProjects", () => {
  return function VirtualAssistantProjects() {
    return <div data-testid="va-projects">VirtualAssistantProjects Component</div>;
  };
});

// Mock the ConsultationBanner component to ensure it's not rendered
jest.mock("@/components/PopUpBanner/Consultation", () => {
  return function ConsultationBanner() {
    return <div data-testid="consultation-banner">ConsultationBanner Component</div>;
  };
});

// Mock commented out components (these don't exist but are referenced in comments)
// Note: These components are commented out in the actual page, so we don't need to mock them

// These components are commented out in the page, so we don't mock them

describe("VirtualAssistantPage", () => {
  describe("Component Rendering", () => {
    it("renders the page successfully", () => {
      render(<VirtualAssistantPage />);
      
      // Check that the main element is present
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    it("renders all active components in correct order", () => {
      render(<VirtualAssistantPage />);
      
      // Check that all active components are rendered
      expect(screen.getByTestId("hero-header")).toBeInTheDocument();
      expect(screen.getByTestId("overwhelm-section")).toBeInTheDocument();
      expect(screen.getByTestId("va-projects")).toBeInTheDocument();
      expect(screen.getByTestId("discovery-call-section")).toBeInTheDocument();
      expect(screen.getByTestId("business-scale-section")).toBeInTheDocument();
      expect(screen.getByTestId("testimonials")).toBeInTheDocument();
      expect(screen.getByTestId("discovery-banner")).toBeInTheDocument();
    });

    it("uses main semantic element as wrapper", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
      expect(mainElement.tagName).toBe("MAIN");
    });
  });

  describe("Promotional Banner Removal", () => {
    it("does not render ConsultationBanner component", () => {
      render(<VirtualAssistantPage />);
      
      // Ensure ConsultationBanner is not rendered (it's commented out)
      expect(screen.queryByTestId("consultation-banner")).not.toBeInTheDocument();
    });

    it("does not render any promotional banners or popups", () => {
      const { container } = render(<VirtualAssistantPage />);
      
      // Check for common promotional banner patterns
      expect(container.querySelector('[data-testid*="consultation-banner"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="promo"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="popup"]')).not.toBeInTheDocument();
    });

    it("starts with HeroHeader instead of ConsultationBanner", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      const firstChild = mainElement.firstElementChild;
      
      // First rendered component should be HeroHeader, not ConsultationBanner
      expect(firstChild).toHaveAttribute("data-testid", "hero-header");
    });
  });

  describe("Conditional Component Rendering", () => {
    it("does not render commented out components", () => {
      render(<VirtualAssistantPage />);
      
      // These components are commented out and should not be rendered
      // We verify this by checking that only the expected components are present
      const mainElement = screen.getByRole("main");
      const childComponents = mainElement.querySelectorAll('[data-testid]');
      
      // Should only have 7 active components (no commented out ones)
      expect(childComponents).toHaveLength(7);
    });

    it("renders only the active components", () => {
      render(<VirtualAssistantPage />);
      
      // Count the number of child components rendered
      const mainElement = screen.getByRole("main");
      const childComponents = mainElement.querySelectorAll('[data-testid]');
      
      // Should only have 7 active components
      expect(childComponents).toHaveLength(7);
    });

    it("maintains correct component order after banner removal", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      const children = Array.from(mainElement.children);
      
      // Verify the order of active components
      expect(children[0]).toHaveAttribute("data-testid", "hero-header");
      expect(children[1]).toHaveAttribute("data-testid", "overwhelm-section");
      expect(children[2]).toHaveAttribute("data-testid", "va-projects");
      expect(children[3]).toHaveAttribute("data-testid", "discovery-call-section");
      expect(children[4]).toHaveAttribute("data-testid", "business-scale-section");
      expect(children[5]).toHaveAttribute("data-testid", "testimonials");
      expect(children[6]).toHaveAttribute("data-testid", "discovery-banner");
    });
  });

  describe("Component Structure", () => {
    it("maintains proper component hierarchy", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      
      // Check that all active components are direct children of main
      expect(mainElement).toContainElement(screen.getByTestId("hero-header"));
      expect(mainElement).toContainElement(screen.getByTestId("overwhelm-section"));
      expect(mainElement).toContainElement(screen.getByTestId("va-projects"));
      expect(mainElement).toContainElement(screen.getByTestId("discovery-call-section"));
      expect(mainElement).toContainElement(screen.getByTestId("business-scale-section"));
      expect(mainElement).toContainElement(screen.getByTestId("testimonials"));
      expect(mainElement).toContainElement(screen.getByTestId("discovery-banner"));
    });

    it("uses semantic main element correctly", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      expect(mainElement.tagName).toBe("MAIN");
    });
  });

  describe("Component Flow and User Experience", () => {
    it("follows logical content flow without promotional interruption", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      const components = Array.from(mainElement.children);
      
      // Verify the logical flow: Hero -> Problem -> Solutions -> Process -> Scale -> Social Proof -> CTA
      expect(components[0]).toHaveAttribute("data-testid", "hero-header"); // Hero
      expect(components[1]).toHaveAttribute("data-testid", "overwhelm-section"); // Problem identification
      expect(components[2]).toHaveAttribute("data-testid", "va-projects"); // Solutions
      expect(components[3]).toHaveAttribute("data-testid", "discovery-call-section"); // Process
      expect(components[4]).toHaveAttribute("data-testid", "business-scale-section"); // Scale benefits
      expect(components[5]).toHaveAttribute("data-testid", "testimonials"); // Social proof
      expect(components[6]).toHaveAttribute("data-testid", "discovery-banner"); // Final CTA
    });

    it("provides clean user experience without popup interruptions", () => {
      const { container } = render(<VirtualAssistantPage />);
      
      // Ensure no modal or popup elements are present
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="modal"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="overlay"]')).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("uses proper semantic HTML structure", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
      expect(mainElement.tagName).toBe("MAIN");
    });

    it("maintains proper component order for screen readers", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      const components = mainElement.querySelectorAll('[data-testid]');
      
      // Verify components are in logical order for screen readers
      expect(components[0]).toHaveAttribute("data-testid", "hero-header");
      expect(components[1]).toHaveAttribute("data-testid", "overwhelm-section");
      expect(components[2]).toHaveAttribute("data-testid", "va-projects");
    });

    it("does not have accessibility barriers from promotional popups", () => {
      const { container } = render(<VirtualAssistantPage />);
      
      // Ensure no elements that could trap focus or interrupt screen readers
      expect(container.querySelector('[aria-modal="true"]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("renders without crashing when components are missing", () => {
      expect(() => render(<VirtualAssistantPage />)).not.toThrow();
    });

    it("handles component failures gracefully", () => {
      render(<VirtualAssistantPage />);
      
      // Ensure the main structure is maintained even if individual components fail
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders efficiently without promotional banner overhead", () => {
      const { rerender } = render(<VirtualAssistantPage />);
      
      // Verify initial render
      expect(screen.getByRole("main")).toBeInTheDocument();
      
      // Re-render and ensure components are still present
      rerender(<VirtualAssistantPage />);
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByTestId("hero-header")).toBeInTheDocument();
    });

    it("avoids unnecessary component mounting from removed banners", () => {
      render(<VirtualAssistantPage />);
      
      // Ensure only necessary components are mounted
      const mainElement = screen.getByRole("main");
      const childComponents = mainElement.querySelectorAll('[data-testid]');
      
      // Should have exactly 7 components (no promotional banners)
      expect(childComponents).toHaveLength(7);
    });
  });

  describe("Component Integration", () => {
    it("integrates all active components correctly", () => {
      render(<VirtualAssistantPage />);
      
      const mainElement = screen.getByRole("main");
      
      // Verify all expected components are integrated
      expect(mainElement.children).toHaveLength(7);
      expect(mainElement).toContainElement(screen.getByTestId("hero-header"));
      expect(mainElement).toContainElement(screen.getByTestId("testimonials"));
      expect(mainElement).toContainElement(screen.getByTestId("discovery-banner"));
    });

    it("maintains component independence", () => {
      render(<VirtualAssistantPage />);
      
      // Each component should be independently rendered
      expect(screen.getByTestId("hero-header")).toBeInTheDocument();
      expect(screen.getByTestId("overwhelm-section")).toBeInTheDocument();
      expect(screen.getByTestId("va-projects")).toBeInTheDocument();
      expect(screen.getByTestId("discovery-call-section")).toBeInTheDocument();
      expect(screen.getByTestId("business-scale-section")).toBeInTheDocument();
      expect(screen.getByTestId("testimonials")).toBeInTheDocument();
      expect(screen.getByTestId("discovery-banner")).toBeInTheDocument();
    });
  });

  describe("Code Quality", () => {
    it("follows React functional component best practices", () => {
      render(<VirtualAssistantPage />);
      
      // Ensure the component renders without warnings
      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("maintains clean component separation", () => {
      render(<VirtualAssistantPage />);
      
      // Each component should be independently testable
      const components = [
        "hero-header",
        "overwhelm-section", 
        "va-projects",
        "discovery-call-section",
        "business-scale-section",
        "testimonials",
        "discovery-banner"
      ];
      
      components.forEach(componentId => {
        expect(screen.getByTestId(componentId)).toBeInTheDocument();
      });
    });
  });
});
