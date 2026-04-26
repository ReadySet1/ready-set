import React from "react";
import { render, screen } from "@testing-library/react";
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

// Mock Cloudinary
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: (path: string) => `/images/${path}`,
}));

import FlowersAbout from "../FlowersAbout";

describe("FlowersAbout", () => {
  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      expect(() => render(<FlowersAbout />)).not.toThrow();
    });

    it("renders the main heading", () => {
      render(<FlowersAbout />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Keep Every Bouquet");
      expect(heading).toHaveTextContent("Looking Its Best");
    });

    it("renders the description paragraph", () => {
      render(<FlowersAbout />);
      expect(
        screen.getByText(/we specialize in local floral deliveries/i),
      ).toBeInTheDocument();
    });
  });

  describe("Stats Grid", () => {
    it("renders the Founded stat", () => {
      render(<FlowersAbout />);
      expect(screen.getByText("2019")).toBeInTheDocument();
      expect(screen.getByText("Founded")).toBeInTheDocument();
    });

    it("renders the Deliveries stat", () => {
      render(<FlowersAbout />);
      expect(screen.getByText("157K+")).toBeInTheDocument();
      expect(screen.getByText("Deliveries Completed")).toBeInTheDocument();
    });

    it("renders the On-Time Rate stat", () => {
      render(<FlowersAbout />);
      expect(screen.getByText("98%")).toBeInTheDocument();
      expect(screen.getByText("On-Time Delivery Rate")).toBeInTheDocument();
    });

    it("renders the Drivers stat", () => {
      render(<FlowersAbout />);
      expect(screen.getByText("200+")).toBeInTheDocument();
      expect(screen.getByText("Professional Drivers")).toBeInTheDocument();
    });

    it("renders all four stats in a 2-column grid", () => {
      const { container } = render(<FlowersAbout />);
      const statsGrid = container.querySelector(".grid.grid-cols-2");
      expect(statsGrid).toBeInTheDocument();
    });
  });

  describe("Image", () => {
    it("renders the florist image with correct alt text", () => {
      render(<FlowersAbout />);
      const image = screen.getByAltText(
        "Florist arranging bouquets in a flower shop",
      );
      expect(image).toBeInTheDocument();
    });
  });

  describe("CTA Link", () => {
    it("renders the 'How Our Service Works' link", () => {
      render(<FlowersAbout />);
      const link = screen.getByRole("link", {
        name: /how our service works/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/vendor-hero#vendor-hero");
    });
  });

  describe("Layout", () => {
    it("renders a two-column grid layout", () => {
      const { container } = render(<FlowersAbout />);
      const mainGrid = container.querySelector(
        ".grid.grid-cols-1.lg\\:grid-cols-2",
      );
      expect(mainGrid).toBeInTheDocument();
    });
  });
});
