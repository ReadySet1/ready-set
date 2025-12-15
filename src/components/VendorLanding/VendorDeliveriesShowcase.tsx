import Image from "next/image";

import { getCloudinaryUrl } from "@/lib/cloudinary";

const DELIVERY_TYPES = [
  "Corporate catering",
  "Group orders",
  "Large food deliveries",
  "Bakery & deli catering",
  "Pantry restocking",
  "Event catering",
  "Custom requests",
];

const MARKETS = ["San Francisco Bay Area", "Atlanta", "Austin", "Dallas"];

const VendorDeliveriesShowcase = () => {
  return (
    <section
      className="w-full bg-white py-14 sm:py-16 lg:py-20"
      aria-labelledby="deliveries-heading"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 sm:px-6">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gray-900">
            Catering Deliveries
          </p>
          <h2
            id="deliveries-heading"
            className="mt-2 text-3xl font-black leading-[1.1] tracking-tight text-gray-900 sm:text-4xl lg:text-5xl"
            style={{
              fontFamily:
                "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
              fontWeight: 900,
            }}
          >
            Catering Deliveries
            <br />
            We Handle
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-gray-700 sm:text-lg">
            {DELIVERY_TYPES.map((item, index) => (
              <span key={item}>
                {item}
                {index < DELIVERY_TYPES.length - 1 && (
                  <span aria-hidden="true" className="mx-3 inline-block">
                    •
                  </span>
                )}
              </span>
            ))}
          </p>
        </header>

        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl sm:aspect-[21/9]">
          <Image
            src={getCloudinaryUrl("food/gallery-food-2")}
            alt="Catering delivery showcase"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 1200px, 1400px"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700 sm:gap-6">
          {MARKETS.map((city) => (
            <div key={city} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-gray-900"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{city}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VendorDeliveriesShowcase;
