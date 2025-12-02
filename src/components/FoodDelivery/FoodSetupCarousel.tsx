"use client";

import Image from "next/image";
import React, { useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const FoodSetupCarousel: React.FC = () => {
  // Generate array of food setup images (foodsetup1.png through foodsetup10.png)
  // Using 10 images for a 5x2 grid layout
  const foodSetupImages = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        src: `/images/food/foodsetup/foodsetup${i + 1}.png`,
        alt: `Food setup ${i + 1}`,
      })),
    [],
  );

  // Group images into columns of 2 (for 2-row layout)
  const imageColumns = useMemo(() => {
    const columns: Array<{
      top: { src: string; alt: string };
      bottom?: { src: string; alt: string };
    }> = [];
    for (let i = 0; i < foodSetupImages.length; i += 2) {
      columns.push({
        top: foodSetupImages[i]!,
        bottom: foodSetupImages[i + 1],
      });
    }
    // Duplicate columns for seamless infinite loop
    return [...columns, ...columns];
  }, [foodSetupImages]);

  return (
    <div className="relative w-full bg-yellow-400 py-8 md:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <Carousel
          opts={{
            align: "start",
            loop: true,
            dragFree: false,
            slidesToScroll: 1,
          }}
          plugins={[
            Autoplay({
              delay: 3000,
              stopOnInteraction: false,
              stopOnMouseEnter: true,
            }),
          ]}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {imageColumns.map((column, index) => (
              <CarouselItem
                key={`carousel-${index}`}
                className="basis-1/2 pl-2 md:basis-1/3 md:pl-4 lg:basis-1/5"
              >
                <div className="flex flex-col gap-3 md:gap-4 lg:gap-6">
                  {/* Top image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-lg transition-transform hover:scale-105">
                    <Image
                      src={column.top.src}
                      alt={column.top.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                  {/* Bottom image (if exists) */}
                  {column.bottom && (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-lg transition-transform hover:scale-105">
                      <Image
                        src={column.bottom.src}
                        alt={column.bottom.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                  )}
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
