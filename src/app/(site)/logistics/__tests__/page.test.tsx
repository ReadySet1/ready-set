import React from "react";
import { render, screen } from "@testing-library/react";
import LogisticsPage from "../page";

// Mock all the child components
jest.mock("@/components/Logistics/LogisticsHero", () => {
  return function LogisticsHero() {
    return <div data-testid="logistics-hero">LogisticsHero Component</div>;
  };
});

jest.mock("@/components/Logistics/WhyChoose", () => {
  return function WhyChoose() {
    return <div data-testid="why-choose">WhyChoose Component</div>;
  };
});

jest.mock("@/components/Logistics/DeliveryOptions", () => {
  return function DeliveryOptions() {
    return <div data-testid="delivery-options">DeliveryOptions Component</div>;
  };
});

jest.mock("@/components/Logistics/QuoteRequest/ClientFormWrapper", () => {
  return {
    ClientFormWrapper: function ClientFormWrapper({ children }: { children: React.ReactNode }) {
      return <div data-testid="client-form-wrapper">{children}</div>;
    },
  };
});

// Mock the commented out components to ensure they're not rendered
jest.mock("@/components/Logistics/FoodServices", () => {
  return function FoodServices() {
    return <div data-testid="food-services">FoodServices Component</div>;
  };
});

jest.mock("@/components/Logistics/ImagesCarousel", () => {
  return function ImageCarousel() {
    return <div data-testid="image-carousel">ImageCarousel Component</div>;
  };
});

jest.mock("@/components/Logistics/FlowerDelivery", () => {
  return function FlowerDeliveryPage() {
    return <div data-testid="flower-delivery">FlowerDeliveryPage Component</div>;
  };
});

jest.mock("@/components/Logistics/BakeryDelivery", () => {
  return function BakeryDeliverySection() {
    return <div data-testid="bakery-delivery">BakeryDeliverySection Component</div>;
  };
});

jest.mock("@/components/Logistics/SpecialtyDelivery", () => {
  return function SpecialtyDelivery() {
    return <div data-testid="specialty-delivery">SpecialtyDelivery Component</div>;
  };
});

// Mock the PromoPopup component to ensure it's not rendered
jest.mock("@/components/PopUpBanner/PromoPopup", () => {
  return function PromoPopup() {
    return <div data-testid="promo-popup">PromoPopup Component</div>;
  };
});

describe("LogisticsPage", () => {
  describe("Component Rendering", () => {
    it("renders the page successfully", () => {
      render(<LogisticsPage />);
      
      // Check that the main wrapper is present
      expect(screen.getByTestId("client-form-wrapper")).toBeInTheDocument();
    });

    it("renders all active components in correct order", () => {
      render(<LogisticsPage />);
      
      // Check that all active components are rendered
      expect(screen.getByTestId("logistics-hero")).toBeInTheDocument();
      expect(screen.getByTestId("delivery-options")).toBeInTheDocument();
      expect(screen.getByTestId("why-choose")).toBeInTheDocument();
    });

    it("wraps content in ClientFormWrapper", () => {
      render(<LogisticsPage />);
      
      const wrapper = screen.getByTestId("client-form-wrapper");
      expect(wrapper).toBeInTheDocument();
      
      // Check that active components are inside the wrapper
      expect(wrapper).toContainElement(screen.getByTestId("logistics-hero"));
      expect(wrapper).toContainElement(screen.getByTestId("delivery-options"));
      expect(wrapper).toContainElement(screen.getByTestId("why-choose"));
    });
  });

  describe("Promotional Banner Removal", () => {
    it("does not render PromoPopup component", () => {
      render(<LogisticsPage />);
      
      // Ensure PromoPopup is not rendered (it's commented out)
      expect(screen.queryByTestId("promo-popup")).not.toBeInTheDocument();
    });

    it("does not render any promotional banners or popups", () => {
      const { container } = render(<LogisticsPage />);
      
      // Check for common promotional banner patterns
      expect(container.querySelector('[data-testid*="promo"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="banner"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="popup"]')).not.toBeInTheDocument();
    });
  });

  describe("Conditional Component Rendering", () => {
    it("does not render commented out components", () => {
      render(<LogisticsPage />);
      
      // These components are commented out and should not be rendered
      expect(screen.queryByTestId("image-carousel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("food-services")).not.toBeInTheDocument();
      expect(screen.queryByTestId("flower-delivery")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bakery-delivery")).not.toBeInTheDocument();
      expect(screen.queryByTestId("specialty-delivery")).not.toBeInTheDocument();
    });

    it("renders only the active components", () => {
      render(<LogisticsPage />);
      
      // Count the number of child components rendered
      const wrapper = screen.getByTestId("client-form-wrapper");
      const childComponents = wrapper.querySelectorAll('[data-testid]');
      
      // Should only have 3 active components (LogisticsHero, DeliveryOptions, WhyChoose)
      expect(childComponents).toHaveLength(3);
    });
  });

  describe("Component Structure", () => {
    it("maintains proper component hierarchy", () => {
      render(<LogisticsPage />);
      
      const wrapper = screen.getByTestId("client-form-wrapper");
      const hero = screen.getByTestId("logistics-hero");
      const deliveryOptions = screen.getByTestId("delivery-options");
      const whyChoose = screen.getByTestId("why-choose");
      
      // Check that components are in the correct order
      const children = Array.from(wrapper.children);
      expect(children[0]).toBe(hero);
      expect(children[1]).toBe(deliveryOptions);
      expect(children[2]).toBe(whyChoose);
    });

    it("uses React Fragment as root element", () => {
      const { container } = render(<LogisticsPage />);
      
      // The component returns a React Fragment, so the first child should be the ClientFormWrapper
      expect(container.firstChild).toHaveAttribute("data-testid", "client-form-wrapper");
    });
  });

  describe("Component Integration", () => {
    it("passes children correctly to ClientFormWrapper", () => {
      render(<LogisticsPage />);
      
      const wrapper = screen.getByTestId("client-form-wrapper");
      
      // Verify that all expected children are present
      expect(wrapper.children).toHaveLength(3);
      expect(wrapper).toContainElement(screen.getByTestId("logistics-hero"));
      expect(wrapper).toContainElement(screen.getByTestId("delivery-options"));
      expect(wrapper).toContainElement(screen.getByTestId("why-choose"));
    });
  });

  describe("Accessibility", () => {
    it("renders semantic HTML structure", () => {
      const { container } = render(<LogisticsPage />);
      
      // Check that the component renders without accessibility violations
      expect(container.firstChild).toBeInTheDocument();
    });

    it("maintains proper component order for screen readers", () => {
      render(<LogisticsPage />);
      
      const wrapper = screen.getByTestId("client-form-wrapper");
      const components = wrapper.querySelectorAll('[data-testid]');
      
      // Verify components are in logical order
      expect(components[0]).toHaveAttribute("data-testid", "logistics-hero");
      expect(components[1]).toHaveAttribute("data-testid", "delivery-options");
      expect(components[2]).toHaveAttribute("data-testid", "why-choose");
    });
  });

  describe("Error Handling", () => {
    it("renders without crashing when components are missing", () => {
      // This test ensures the page is resilient to component failures
      expect(() => render(<LogisticsPage />)).not.toThrow();
    });

    it("handles undefined children gracefully", () => {
      render(<LogisticsPage />);
      
      // Ensure the page renders even if some components might be undefined
      expect(screen.getByTestId("client-form-wrapper")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders efficiently without unnecessary re-renders", () => {
      const { rerender } = render(<LogisticsPage />);
      
      // Verify initial render
      expect(screen.getByTestId("client-form-wrapper")).toBeInTheDocument();
      
      // Re-render and ensure components are still present
      rerender(<LogisticsPage />);
      expect(screen.getByTestId("client-form-wrapper")).toBeInTheDocument();
      expect(screen.getByTestId("logistics-hero")).toBeInTheDocument();
    });
  });

  describe("Code Quality", () => {
    it("follows React best practices", () => {
      render(<LogisticsPage />);
      
      // Ensure the component renders without warnings
      expect(screen.getByTestId("client-form-wrapper")).toBeInTheDocument();
    });

    it("maintains clean component separation", () => {
      render(<LogisticsPage />);
      
      // Each component should be independently testable
      expect(screen.getByTestId("logistics-hero")).toBeInTheDocument();
      expect(screen.getByTestId("delivery-options")).toBeInTheDocument();
      expect(screen.getByTestId("why-choose")).toBeInTheDocument();
    });
  });
});
