"use client";

import Image from "next/image";
import React, { useMemo, useRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const FoodSetupCarousel: React.FC = () => {
  // Generate array of food setup images (foodsetup1.png through foodsetup13.png)
  const foodSetupImages = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => ({
        src: `/images/food/foodsetup/foodsetup${i + 1}.png`,
        alt: `Food setup ${i + 1}`,
      })),
    [],
  );

  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );
  const isClient = typeof window !== "undefined";

  return (
    <div className="relative w-full bg-yellow-400 py-12 md:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <Carousel
          opts={{
            align: "start",
            loop: true,
            dragFree: false,
            containScroll: false,
            slidesToScroll: 1,
          }}
          plugins={isClient ? [autoplayPlugin.current] : []}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {foodSetupImages.map((image, index) => (
              <CarouselItem
                key={index}
                className="basis-1/2 pl-2 md:basis-1/3 md:pl-4 lg:basis-1/5"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-lg transition-transform hover:scale-105">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover p-1"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
};

export default FoodSetupCarousel;

