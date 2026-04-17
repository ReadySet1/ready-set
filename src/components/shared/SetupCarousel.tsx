"use client";

import Image from "next/image";
import React, { useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getCloudinaryUrl } from "@/lib/cloudinary";

interface SetupCarouselProps {
  /** Cloudinary base path for images (e.g. "food/foodsetup/foodsetup") */
  imageBasePath: string;
  /** Number of images to display */
  imageCount: number;
  /** Alt text prefix for accessibility (e.g. "Food setup") */
  altPrefix: string;
  /** Autoplay delay in milliseconds (default: 3000) */
  autoplayDelay?: number;
  /** Background color class (default: "bg-[#343434]") */
  bgClassName?: string;
}

const SetupCarousel: React.FC<SetupCarouselProps> = ({
  imageBasePath,
  imageCount,
  altPrefix,
  autoplayDelay = 3000,
  bgClassName = "bg-[#343434]",
}) => {
  const images = useMemo(
    () =>
      Array.from({ length: imageCount }, (_, i) => ({
        src: getCloudinaryUrl(`${imageBasePath}${i + 1}`),
        alt: `${altPrefix} ${i + 1}`,
      })),
    [imageBasePath, imageCount, altPrefix],
  );

  const imageColumns = useMemo(() => {
    const columns: Array<{
      top: { src: string; alt: string };
      bottom?: { src: string; alt: string };
    }> = [];
    for (let i = 0; i < images.length; i += 2) {
      columns.push({
        top: images[i]!,
        bottom: images[i + 1],
      });
    }
    return [...columns, ...columns];
  }, [images]);

  return (
    <div className={`relative w-full ${bgClassName} py-8 md:py-12 lg:py-16`}>
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
              delay: autoplayDelay,
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
                  {column.bottom && (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-lg transition-transform hover:scale-105">
                      <Image
                        src={column.bottom.src}
                        alt={column.bottom.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        onError={(
                          e: React.SyntheticEvent<HTMLImageElement>,
                        ) => {
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

export default SetupCarousel;
