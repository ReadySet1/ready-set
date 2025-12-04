"use client";

import Image from "next/image";
import * as React from "react";
import Autoplay from "embla-carousel-autoplay";

import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const images = [
  {
    src: getCloudinaryUrl("hero/slider1"),
    alt: "Image 1 description",
  },
  {
    src: getCloudinaryUrl("hero/slider2"),
    alt: "Image 2 description",
  },
  {
    src: getCloudinaryUrl("hero/slider3"),
    alt: "Image 3 description",
  },
];

export function CarouselPlugin() {
  const plugin = React.useRef(
    Autoplay({ delay: 2000, stopOnInteraction: true }),
  );

  return (
    <Carousel
      plugins={[plugin.current]}
      className="mx-auto w-full max-w-[845px]"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
     <CarouselContent>
  {images.map((image, index) => (
    <CarouselItem key={index}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[16/9]">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 768px) 100vw, 845px"
              quality={80}
              priority={index === 0}
              className="object-cover rounded-md"
            />
          </div>
        </CardContent>
      </Card>
    </CarouselItem>
  ))}
</CarouselContent>
    </Carousel>
  );
}
