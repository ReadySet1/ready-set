export interface PricingExample {
  readonly id: string;
  readonly label: string;
  readonly headcount: number;
  readonly foodCost: number;
  readonly headcountTierLabel: string;
  readonly headcountTierPrice: number;
  readonly foodCostTierLabel: string;
  readonly foodCostTierPrice: number;
}

export const PRICING_EXAMPLES: readonly PricingExample[] = [
  {
    id: "example-1",
    label: "Example 1",
    headcount: 40,
    foodCost: 550,
    headcountTierLabel: "25\u201349 guests",
    headcountTierPrice: 70,
    foodCostTierLabel: "$300\u2013$599",
    foodCostTierPrice: 70,
  },
  {
    id: "example-2",
    label: "Example 2",
    headcount: 80,
    foodCost: 850,
    headcountTierLabel: "75\u201399 guests",
    headcountTierPrice: 100,
    foodCostTierLabel: "$600\u2013$899",
    foodCostTierPrice: 90,
  },
  {
    id: "example-3",
    label: "Example 3",
    headcount: 120,
    foodCost: 1000,
    headcountTierLabel: "100\u2013124 guests",
    headcountTierPrice: 120,
    foodCostTierLabel: "$900\u2013$1,199",
    foodCostTierPrice: 100,
  },
] as const;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUSD(value: number): string {
  return usdFormatter.format(value);
}

export default function PricingExamplesSection() {
  return (
    <div className="mt-6 sm:mt-8 md:mt-12">
      <section aria-labelledby="pricing-examples-heading">
        <h2
          id="pricing-examples-heading"
          className="mb-2 text-2xl font-bold text-gray-900 sm:mb-3 sm:text-3xl md:mb-4 md:text-4xl"
        >
          How Our Pricing Works
        </h2>
        <p className="mb-4 text-sm text-gray-600 sm:mb-5 sm:text-base md:mb-6 md:text-lg">
          The delivery fee is the{" "}
          <strong className="font-semibold text-gray-900">lower</strong> of the
          headcount rate and the food-cost rate, each looked up independently on
          the chart above.
        </p>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
          {PRICING_EXAMPLES.map((ex) => {
            const deliveryFee = Math.min(
              ex.headcountTierPrice,
              ex.foodCostTierPrice,
            );
            const isLesserApplied =
              ex.headcountTierPrice !== ex.foodCostTierPrice;

            return (
              <div
                key={ex.id}
                className="rounded-xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5 md:p-6"
              >
                <h3 className="mb-3 text-base font-bold text-gray-900 sm:mb-4 sm:text-lg md:text-xl">
                  {ex.label}
                </h3>
                <dl className="space-y-2 sm:space-y-2.5 md:space-y-3">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-xs text-gray-600 sm:text-sm md:text-base">
                      Headcount
                    </dt>
                    <dd className="text-xs font-semibold text-gray-900 sm:text-sm md:text-base">
                      {ex.headcount} guests
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <dt className="text-xs text-gray-600 sm:text-sm md:text-base">
                      Food Cost
                    </dt>
                    <dd className="text-xs font-semibold text-gray-900 sm:text-sm md:text-base">
                      {formatUSD(ex.foodCost)}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <dt className="text-xs text-gray-600 sm:text-sm md:text-base">
                      Headcount Tier
                    </dt>
                    <dd className="text-xs font-semibold text-gray-900 sm:text-sm md:text-base">
                      {ex.headcountTierLabel}: {formatUSD(ex.headcountTierPrice)}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <dt className="text-xs text-gray-600 sm:text-sm md:text-base">
                      Food Cost Tier
                    </dt>
                    <dd className="text-xs font-semibold text-gray-900 sm:text-sm md:text-base">
                      {ex.foodCostTierLabel}: {formatUSD(ex.foodCostTierPrice)}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-gray-200 pt-2 sm:pt-2.5 md:pt-3">
                    <dt className="text-xs font-bold text-gray-900 sm:text-sm md:text-base">
                      Delivery Fee
                    </dt>
                    <dd className="flex items-center gap-1.5 text-base font-black text-yellow-600 sm:gap-2 sm:text-lg md:text-xl">
                      {formatUSD(deliveryFee)}
                      {isLesserApplied && (
                        <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 sm:text-sm">
                          lesser value applied
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-1 sm:mt-5 sm:space-y-1.5 md:mt-6">
          <p className="text-xs text-gray-600 sm:text-sm">
            For destinations beyond 10 miles, there is an additional $3.00 per
            mile after the first 10 miles.
          </p>
          <p className="text-xs text-gray-600 sm:text-sm">
            Tolls may be added depending on the route. If multiple deliveries
            are batched with the same driver, tolls and mileage are charged once
            for the total trip.
          </p>
        </div>
      </section>
    </div>
  );
}
