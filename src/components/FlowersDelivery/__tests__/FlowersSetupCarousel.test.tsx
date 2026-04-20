import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the shared SetupCarousel component directly
jest.mock("@/components/shared/SetupCarousel", () => {
  const R = require("react");
  return {
    __esModule: true,
    default: function MockSetupCarousel(props: {
      imageBasePath: string;
      imageCount: number;
      altPrefix: string;
    }) {
      return R.createElement("div", {
        "data-testid": "setup-carousel",
        "data-image-base-path": props.imageBasePath,
        "data-image-count": String(props.imageCount),
        "data-alt-prefix": props.altPrefix,
      });
    },
  };
});

import FlowersSetupCarousel from "../FlowersSetupCarousel";

describe("FlowersSetupCarousel", () => {
  it("renders without crashing", () => {
    expect(() => render(<FlowersSetupCarousel />)).not.toThrow();
  });

  it("renders the SetupCarousel component", () => {
    render(<FlowersSetupCarousel />);
    expect(screen.getByTestId("setup-carousel")).toBeInTheDocument();
  });

  it("passes the correct imageBasePath prop", () => {
    render(<FlowersSetupCarousel />);
    expect(screen.getByTestId("setup-carousel")).toHaveAttribute(
      "data-image-base-path",
      "flowers/flowersetup/flowersetup",
    );
  });

  it("passes imageCount of 6", () => {
    render(<FlowersSetupCarousel />);
    expect(screen.getByTestId("setup-carousel")).toHaveAttribute(
      "data-image-count",
      "6",
    );
  });

  it("passes the correct altPrefix prop", () => {
    render(<FlowersSetupCarousel />);
    expect(screen.getByTestId("setup-carousel")).toHaveAttribute(
      "data-alt-prefix",
      "Flower arrangement",
    );
  });
});
