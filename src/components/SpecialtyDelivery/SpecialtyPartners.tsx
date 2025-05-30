"use client";

import Image from "next/image";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Partner {
  name: string;
  logo: string;
}

const SpecialtyPartners: React.FC = () => {
  const partners: Partner[] = useMemo(
    () => [
      { name: "Deli", logo: "/images/food/partners/Deli.jpg" },
      { name: "Bobcha", logo: "/images/food/partners/bobcha.jpg" },
      { name: "Foodee", logo: "/images/food/partners/foodee.jpg" },
      { name: "Destino", logo: "/images/food/partners/destino.png" },
      { name: "Conviva", logo: "/images/food/partners/conviva.png" },
      { name: "Kasa Indian Eatery", logo: "/images/food/partners/kasa.png" },
      { name: "CaterValley", logo: "/images/food/partners/catervalley.png" },
      { name: "Quivx", logo: "/images/food/partners/quivx.png" },
    ],
    [],
  );

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [topImageMargin, setTopImageMargin] = useState<string>("-40px");
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );
  const isClient = typeof window !== "undefined";

  useEffect(() => {
    const checkIfMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);

      if (width < 640) {
        setTopImageMargin("-20px");
      } else if (width < 768) {
        setTopImageMargin("-30px");
      } else {
        setTopImageMargin("-40px");
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <div className="relative flex min-h-[600px] w-full items-center justify-center overflow-hidden bg-gray-100">
      {/* Background Image with flowers */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/specialty/specialtydelivery1.png"
          alt="Flower shop background"
          fill
          style={{ objectFit: "cover" }}
          className="opacity-100 saturate-150"
        />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        {/* Top section with penguin logo */}
        <div
          className="relative mx-auto mt-8 w-full max-w-3xl px-4 md:mt-16 md:px-0"
          style={{ marginTop: topImageMargin }}
        >
          <Image
            src="/images/bakery/deliverysupport1.png"
            alt="Delivery Support"
            width={800}
            height={400}
            className="w-full rounded-xl shadow-xl"
            priority
          />
        </div>
        <div className="flex-grow" />

        {/* Partners slider at bottom - Fixed spacing issues */}
        <div className="w-full pb-8 pt-4 md:pb-8 md:pt-0">
          <div className="mx-auto max-w-[90%] md:max-w-[80%]">
            <Carousel
              opts={{
                align: "center",
                loop: true,
                dragFree: false,
                containScroll: "trimSnaps",
                slidesToScroll: 1,
              }}
              plugins={isClient ? [autoplayPlugin.current] : []}
              className="w-full overflow-visible"
            >
              <CarouselContent className="ml-0">
                {partners.map((partner) => (
                  <CarouselItem
                    key={partner.name}
                    className="basis-1/3 pl-0 pr-4"
                  >
                    <div className="w-full">
                      <div className="relative h-20 w-full overflow-hidden rounded-2xl border-4 border-yellow-400 bg-white shadow-lg md:h-24">
                        <Image
                          src={partner.logo}
                          alt={partner.name}
                          fill
                          className="object-contain p-2"
                          style={{ objectFit: "contain" }}
                        />
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialtyPartners;
