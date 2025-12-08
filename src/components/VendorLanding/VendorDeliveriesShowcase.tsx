import Image from "next/image";
import type { CSSProperties } from "react";

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

const MARKETS = [
  "San Francisco Bay Area",
  "Atlanta",
  "Austin",
  "Dallas",
];

const GALLERY_IMAGES = [
  {
    publicId: "food/gallery/food-4",
    alt: "Fresh jars of salad with vibrant ingredients ready for delivery",
  },
  {
    publicId: "food/gallery/food-6",
    alt: "Chafing dishes filled with warm catering trays",
  },
  {
    publicId: "food/gallery/food-2",
    alt: "Individual meal boxes lined up for group delivery",
  },
  {
    publicId: "food/gallery/food-3",
    alt: "Pasta trays prepared for large event catering",
  },
  {
    publicId: "food/gallery/food-8",
    alt: "Sweet and savory bites arranged for buffet service",
  },
  {
    publicId: "food/gallery/food-9",
    alt: "Dessert shooters with berries for corporate catering",
  },
  {
    publicId: "food/gallery/food-10",
    alt: "Fresh pizzas boxed and stacked for group orders",
  },
];

const slantedCardStyle: CSSProperties = {
  clipPath: "polygon(12% 0, 100% 0, 88% 100%, 0 100%)",
};

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
            className="mt-2 font-[Montserrat] text-3xl font-black leading-tight text-gray-900 sm:text-4xl lg:text-5xl"
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
                  <span aria-hidden="true"> • </span>
                )}
              </span>
            ))}
          </p>
        </header>

        <div className="w-full overflow-hidden rounded-3xl bg-white shadow-[0_20px_55px_rgba(0,0,0,0.08)]">
          <div className="flex h-[240px] items-stretch gap-2 sm:h-[280px] sm:gap-3 md:h-[340px]">
            {GALLERY_IMAGES.map((image, index) => {
              const verticalOffset =
                index % 2 === 0 ? "translate-y-3 md:translate-y-4" : "-translate-y-3 md:-translate-y-4";

              return (
                <div
                  key={image.publicId}
                  className={`relative flex h-full w-[140px] shrink-0 items-center justify-center sm:w-[170px] md:w-[200px] ${verticalOffset}`}
                >
                  <div
                    className="relative h-full w-full overflow-hidden rounded-2xl shadow-xl"
                    style={slantedCardStyle}
                  >
                    <Image
                      src={getCloudinaryUrl(image.publicId)}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 768px) 160px, (max-width: 1024px) 190px, 220px"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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

