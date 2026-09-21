import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import PricingExamplesSection, {
  PRICING_EXAMPLES,
  formatUSD,
} from "../PricingExamplesSection";
import { pricingTiers } from "../ModernPricingLandingPage";
import { calculateDeliveryCost } from "@/lib/calculator/delivery-cost-calculator";

/**
 * Every example on the page is a ≤10-mile, single-stop, single-drive quote,
 * so the engine call that backs it fixes those inputs.
 */
const BASELINE_INPUT = {
  totalMileage: 0,
  numberOfDrives: 1,
  numberOfStops: 1,
} as const;

/** Returns the card element that renders a given example. */
function getExampleCard(label: string): HTMLElement {
  const card = screen.getByRole("heading", { name: label }).closest("div");
  if (!card) throw new Error(`No card found for ${label}`);
  return card as HTMLElement;
}

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

    // Example 1: both tiers are $70, so the cost is $70 and no badge
    const card = getExampleCard("Example 1");
    expect(within(card).getByText("$70")).toBeInTheDocument();
    expect(
      within(card).queryByText("lesser value applied"),
    ).not.toBeInTheDocument();

    // "lesser value applied" should appear exactly twice (Examples 2 and 3)
    const badges = screen.getAllByText("lesser value applied");
    expect(badges).toHaveLength(2);
  });

  it("should show $90 with 'lesser value applied' for Example 2", () => {
    render(<PricingExamplesSection />);

    // Example 2: headcount tier $100, food cost tier $90 → cost $90
    const card = getExampleCard("Example 2");
    expect(within(card).getByText("$90")).toBeInTheDocument();
    expect(within(card).getByText("lesser value applied")).toBeInTheDocument();
  });

  it("should show $100 with 'lesser value applied' for Example 3", () => {
    render(<PricingExamplesSection />);

    // Example 3: headcount tier $120, food cost tier $100 → cost $100
    const card = getExampleCard("Example 3");
    expect(within(card).getByText("$100")).toBeInTheDocument();
    expect(within(card).getByText("lesser value applied")).toBeInTheDocument();
  });

  it("should label the total 'Delivery Cost', matching the rate chart", () => {
    render(<PricingExamplesSection />);

    expect(screen.getAllByText("Delivery Cost")).toHaveLength(
      PRICING_EXAMPLES.length,
    );
    expect(screen.queryByText("Delivery Fee")).not.toBeInTheDocument();
  });

  it("should format USD correctly with comma grouping", () => {
    expect(formatUSD(1000)).toBe("$1,000");
    expect(formatUSD(70)).toBe("$70");
    expect(formatUSD(550)).toBe("$550");
  });

  it("should render every footnote", () => {
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

    expect(
      screen.getByText(
        /Additional stops are \$5\.00 each\. The first stop is included in the delivery cost\./,
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

  describe("guard test — examples stay consistent with the calculator engine", () => {
    PRICING_EXAMPLES.forEach((ex) => {
      it(`${ex.label}: headcountTierPrice is what the engine charges for ${ex.headcount} guests alone`, () => {
        const { deliveryCost } = calculateDeliveryCost({
          ...BASELINE_INPUT,
          headcount: ex.headcount,
          foodCost: 0,
        });
        expect(deliveryCost).toBe(ex.headcountTierPrice);
      });

      it(`${ex.label}: foodCostTierPrice is what the engine charges for $${ex.foodCost} of food alone`, () => {
        const { deliveryCost } = calculateDeliveryCost({
          ...BASELINE_INPUT,
          headcount: 0,
          foodCost: ex.foodCost,
        });
        expect(deliveryCost).toBe(ex.foodCostTierPrice);
      });

      it(`${ex.label}: the rendered delivery cost equals the engine's deliveryCost`, () => {
        const { deliveryCost } = calculateDeliveryCost({
          ...BASELINE_INPUT,
          headcount: ex.headcount,
          foodCost: ex.foodCost,
        });

        // The lesser-of-two-tiers rule the copy describes.
        expect(deliveryCost).toBe(
          Math.min(ex.headcountTierPrice, ex.foodCostTierPrice),
        );

        render(<PricingExamplesSection />);
        const card = getExampleCard(ex.label);
        expect(
          within(card).getByText(formatUSD(deliveryCost)),
        ).toBeInTheDocument();
      });
    });

    it("the published additional-stop charge is the rate the engine applies", () => {
      const oneStop = calculateDeliveryCost({
        ...BASELINE_INPUT,
        numberOfStops: 1,
        headcount: 40,
        foodCost: 550,
      });
      const twoStops = calculateDeliveryCost({
        ...BASELINE_INPUT,
        numberOfStops: 2,
        headcount: 40,
        foodCost: 550,
      });

      const ratePerExtraStop =
        twoStops.extraStopsCharge - oneStop.extraStopsCharge;
      expect(oneStop.extraStopsCharge).toBe(0);
      expect(ratePerExtraStop).toBe(5);

      render(<PricingExamplesSection />);
      expect(
        screen.getByText(
          new RegExp(
            `Additional stops are \\$${ratePerExtraStop.toFixed(2)} each\\.`,
          ),
        ),
      ).toBeInTheDocument();
    });
  });
});
