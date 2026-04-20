import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock framer-motion - use require("react") since jest.mock is hoisted
jest.mock("framer-motion", () => {
  const R = require("react");
  const createMotionComponent = (tag: string) => {
    return R.forwardRef(
      ({ children, ...props }: Record<string, unknown>, ref: unknown) => {
        const filteredProps: Record<string, unknown> = { ref };
        for (const [key, value] of Object.entries(props)) {
          if (
            ![
              "initial",
              "animate",
              "exit",
              "whileInView",
              "whileHover",
              "whileTap",
              "viewport",
              "transition",
              "variants",
            ].includes(key)
          ) {
            filteredProps[key] = value;
          }
        }
        return R.createElement(tag, filteredProps, children as React.ReactNode);
      },
    );
  };

  return {
    __esModule: true,
    motion: {
      div: createMotionComponent("div"),
    },
    AnimatePresence: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  };
});

// Mock FormManager
const mockOpenForm = jest.fn();
jest.mock("@/components/Logistics/QuoteRequest/Quotes/FormManager", () => ({
  FormManager: () => ({
    openForm: mockOpenForm,
    closeForm: jest.fn(),
    DialogForm: null,
  }),
}));

// Mock Cloudinary
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: (path: string) => `/images/${path}`,
}));

import { FlowersServiceFeatures } from "../ServiceFeaturesSection";

describe("FlowersServiceFeatures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      expect(() => render(<FlowersServiceFeatures />)).not.toThrow();
    });

    it("renders the section title", () => {
      render(<FlowersServiceFeatures />);
      expect(screen.getByText("More Than Just Delivery")).toBeInTheDocument();
    });
  });

  describe("Feature Cards", () => {
    it("renders all three feature titles", () => {
      render(<FlowersServiceFeatures />);
      expect(screen.getByText(/Bulk Orders/)).toBeInTheDocument();
      expect(screen.getByText(/No Problem!/)).toBeInTheDocument();
      expect(screen.getByText("Hands-On Support")).toBeInTheDocument();
      expect(
        screen.getByText("Personalized Delivery Service"),
      ).toBeInTheDocument();
    });

    it("renders feature descriptions", () => {
      render(<FlowersServiceFeatures />);
      expect(screen.getByText(/10 orders per route/)).toBeInTheDocument();
      expect(
        screen.getByText(/dispatch to doorstep/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/dedicated driver assigned/),
      ).toBeInTheDocument();
    });
  });

  describe("CTA Button", () => {
    it("renders the Get Started button", () => {
      render(<FlowersServiceFeatures />);
      const button = screen.getByRole("button", { name: /get started/i });
      expect(button).toBeInTheDocument();
    });

    it("calls openForm with 'flower' when CTA is clicked", () => {
      render(<FlowersServiceFeatures />);
      const button = screen.getByRole("button", { name: /get started/i });
      fireEvent.click(button);
      expect(mockOpenForm).toHaveBeenCalledWith("flower");
    });
  });

  describe("Outline Variant", () => {
    it("renders with outline variant styling (bg-gray-50)", () => {
      const { container } = render(<FlowersServiceFeatures />);
      const outlineContainer = container.querySelector(".bg-gray-50");
      expect(outlineContainer).toBeInTheDocument();
    });

    it("renders features in a 3-column grid", () => {
      const { container } = render(<FlowersServiceFeatures />);
      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-3");
    });
  });
});
