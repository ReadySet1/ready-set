"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { Clock, Truck, Shield } from "lucide-react";
import Link from "next/link";
import GetQuoteButton from "./GetQuoteButton";
import ScheduleDialog from "./Schedule";

// Carousel imports
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// Partner interface
interface Partner {
  name: string;
  logo: string;
}

const LogisticsPage = () => {
  // Partners list
  const partners: Partner[] = useMemo(
    () => [
      { name: "Deli", logo: "/images/food/partners/Deli.jpg" },
      { name: "Bobcha", logo: "/images/food/partners/bobcha.jpg" },
      { name: "Foodee", logo: "/images/food/partners/foodee.jpg" },
      { name: "Destino", logo: "/images/food/partners/destino.png" },
      { name: "Conviva", logo: "/images/food/partners/conviva.png" },
      { name: "Kasa Indian Eatery", logo: "/images/food/partners/kasa.png" },
      { name: "CaterValley", logo: "/images/food/partners/catervalley.png" },
    ],
    [],
  );

  // Mobile state
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Autoplay plugin reference
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );

  // Client-side check
  const isClient = typeof window !== "undefined";

  // Mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative min-h-screen">
        {/* Background Image */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/images/logistics/bg-hero.png')",
              backgroundSize: "cover",
            }}
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Centered Card */}
          <div className="relative z-30 flex flex-1 items-center justify-center px-4 pb-8 pt-28 md:pt-40">
            <div className="w-full max-w-2xl rounded-2xl bg-white/95 p-4 text-center shadow-lg backdrop-blur-sm md:p-10">
              <h1 className="mb-3 text-2xl font-bold text-gray-900 md:text-4xl">
                Premium Logistics Services
              </h1>
              <p className="mb-6 text-sm text-gray-600 md:mb-8 md:text-lg">
                Bay Area's Most Trusted Delivery Partner Since 2019
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row md:gap-4">
                <GetQuoteButton />
                <ScheduleDialog
                  calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                  buttonText="Schedule a Call"
                />
              </div>
            </div>
          </div>

          {/* Partners Carousel */}
          <div className="z-40 px-4 pb-8 pt-8 md:pb-16 md:pt-16">
            {" "}
            <div className="mx-auto max-w-[90%] md:max-w-[80%]">
              <Carousel
                opts={{
                  align: "center",
                  loop: true,
                  dragFree: false,
                  containScroll: false,
                  slidesToScroll: 3,
                }}
                plugins={isClient ? [autoplayPlugin.current] : []}
                className="w-full"
              >
                <CarouselContent className="-ml-0 -mr-0">
                  {partners.map((partner) => (
                    <CarouselItem
                      key={partner.name}
                      className="basis-1/3 pl-0 pr-0"
                    >
                      <div className="mx-1 md:mx-2">
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

      <div className="bg-gray-900 px-4 py-8 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {/* Specialized Delivery Card */}
            <div className="rounded-xl bg-white p-5 shadow-lg">
              <div className="mb-2">
                <Truck className="h-5 w-5 text-yellow-400" />
              </div>
              <h3 className="mb-2 text-base font-semibold">
                Specialized Delivery
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Expert handling of your needs with temperature-controlled
                vehicles and trained professionals.
              </p>
            </div>

            {/* Time-Critical Delivery Card */}
            <div className="rounded-xl bg-white p-5 shadow-lg">
              <div className="mb-2">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <h3 className="mb-2 text-base font-semibold">
                Time-Critical Delivery
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Guaranteed on-time delivery for your events with real-time
                tracking and dedicated route optimization.
              </p>
            </div>

            {/* Quality Guaranteed Card */}
            <div className="rounded-xl bg-white p-5 shadow-lg">
              <div className="mb-2">
                <Shield className="h-5 w-5 text-yellow-400" />
              </div>
              <h3 className="mb-2 text-base font-semibold">
                Quality Guaranteed
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Trusted by leading tech companies including Apple, Google,
                Facebook, and Netflix for reliable service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsPage;
