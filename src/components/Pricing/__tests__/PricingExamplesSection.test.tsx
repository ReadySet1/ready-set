import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PricingExamplesSection, {
  PRICING_EXAMPLES,
  formatUSD,
} from "../PricingExamplesSection";
import { pricingTiers } from "../ModernPricingLandingPage";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    a: ({ children, ...props }: Record<string, unknown>) => (
      <a {...props}>{children as React.ReactNode}</a>
    ),
    tr: ({ children, ...props }: Record<string, unknown>) => (
      <tr {...props}>{children as React.ReactNode}</tr>
    ),
  },
}));

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock Cloudinary URL builder
jest.mock("@/lib/cloudinary", () => ({
  getCloudinaryUrl: (path: string) =>
    `https://res.cloudinary.com/test/image/upload/f_auto,q_auto/ready-set/${path}`,
}));

describe("PricingExamplesSection", () => {
  it("should render the heading and all three example labels", () => {
    render(<PricingExamplesSection />);

    expect(screen.getByText("How Our Pricing Works")).toBeInTheDocument();
    expect(screen.getByText("Example 1")).toBeInTheDocument();
    expect(screen.getByText("Example 2")).toBeInTheDocument();
    expect(screen.getByText("Example 3")).toBeInTheDocument();
  });

  it("should show $70 for Example 1 with no 'lesser value applied' badge", () => {
    render(<PricingExamplesSection />);

    // Example 1: both tiers are $70, so fee is $70 and no badge
    const example1Fee = screen.getAllByText("$70");
    expect(example1Fee.length).toBeGreaterThanOrEqual(1);

    // "lesser value applied" should NOT appear for Example 1 (hc === fc)
    // It should appear exactly twice (Examples 2 and 3)
    const badges = screen.getAllByText("lesser value applied");
    expect(badges).toHaveLength(2);
  });

  it("should show $90 with 'lesser value applied' for Example 2", () => {
    render(<PricingExamplesSection />);

    // Example 2: headcount $100, food cost $90 → fee $90
    // The fee $90 should be present
    const ninetyTexts = screen.getAllByText("$90");
    expect(ninetyTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("should show $100 with 'lesser value applied' for Example 3", () => {
    render(<PricingExamplesSection />);

    // Example 3: headcount $120, food cost $100 → fee $100
    const hundredTexts = screen.getAllByText("$100");
    expect(hundredTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("should format USD correctly with comma grouping", () => {
    expect(formatUSD(1000)).toBe("$1,000");
    expect(formatUSD(70)).toBe("$70");
    expect(formatUSD(550)).toBe("$550");
  });

  it("should render both footnotes", () => {
    render(<PricingExamplesSection />);

    expect(
      screen.getByText(
        /For destinations beyond 10 miles, there is an additional \$3\.00 per mile after the first 10 miles\./,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Tolls may be added depending on the route\. If multiple deliveries are batched with the same driver, tolls and mileage are charged once for the total trip\./,
      ),
    ).toBeInTheDocument();
  });

  describe("guard test — examples stay consistent with pricingTiers", () => {
    /**
     * Parse a range string like "25-49" into [min, max].
     * Handles "0-24", "300+", etc.
     */
    function parseHeadcountRange(
      hc: string,
    ): { min: number; max: number } | null {
      if (hc.endsWith("+")) {
        const min = parseInt(hc.replace("+", ""), 10);
        return { min, max: Infinity };
      }
      const parts = hc.split("-");
      if (parts.length !== 2) return null;
      return { min: parseInt(parts[0]!, 10), max: parseInt(parts[1]!, 10) };
    }

    /**
     * Parse a food cost range like "$300-$599" or "<$300" into [min, max].
     */
    function parseFoodCostRange(
      fc: string,
    ): { min: number; max: number } | null {
      if (fc === "TBD") return null;
      if (fc.startsWith("<")) {
        const max = parseInt(fc.replace(/[<$,]/g, ""), 10);
        return { min: 0, max: max - 1 };
      }
      const parts = fc.split("-");
      if (parts.length !== 2) return null;
      return {
        min: parseInt(parts[0]!.replace(/[$,]/g, ""), 10),
        max: parseInt(parts[1]!.replace(/[$,]/g, ""), 10),
      };
    }

    function parseDeliveryPrice(d: string): number | null {
      if (d === "TBD") return null;
      return parseInt(d.replace(/[$,]/g, ""), 10);
    }

    PRICING_EXAMPLES.forEach((ex) => {
      it(`${ex.label}: headcountTierPrice matches the chart row for ${ex.headcount} guests`, () => {
        const row = pricingTiers.find((tier) => {
          const range = parseHeadcountRange(tier.headcount);
          return range && ex.headcount >= range.min && ex.headcount <= range.max;
        });
        expect(row).toBeDefined();
        const chartPrice = parseDeliveryPrice(row!.delivery);
        expect(chartPrice).toBe(ex.headcountTierPrice);
      });

      it(`${ex.label}: foodCostTierPrice matches the chart row for $${ex.foodCost} food cost`, () => {
        const row = pricingTiers.find((tier) => {
          const range = parseFoodCostRange(tier.foodCost);
          return range && ex.foodCost >= range.min && ex.foodCost <= range.max;
        });
        expect(row).toBeDefined();
        const chartPrice = parseDeliveryPrice(row!.delivery);
        expect(chartPrice).toBe(ex.foodCostTierPrice);
      });
    });
  });
});
