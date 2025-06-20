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

// Background image settings interface
interface BackgroundImageSettings {
  src: string;
  size: "cover" | "contain" | "auto" | string;
  position: string;
  repeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
  attachment?: "fixed" | "scroll" | "local";
}

// Viewport dimensions interface
interface ViewportDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Custom hook for responsive background
const useResponsiveBackground = (imageSrc: string): BackgroundImageSettings => {
  const [settings, setSettings] = useState<BackgroundImageSettings>({
    src: imageSrc,
    size: "cover",
    position: "center center",
    repeat: "no-repeat",
    attachment: "fixed",
  });

  useEffect(() => {
    const calculateBackgroundSettings = (): void => {
      const viewport: ViewportDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
        aspectRatio: window.innerWidth / window.innerHeight,
      };

      let newSettings: BackgroundImageSettings;

      // Optimize for 1920x1080 and similar widescreen resolutions
      if (viewport.width >= 1920 && viewport.aspectRatio >= 1.7) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 20%", // Balanced positioning now that card is moved down
          repeat: "no-repeat",
          attachment: "fixed",
        };
      } else if (viewport.width >= 1366 && viewport.aspectRatio > 1.5) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 18%", // Balanced positioning for medium screens
          repeat: "no-repeat",
          attachment: "fixed",
        };
      } else if (viewport.aspectRatio > 1.3) {
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 15%", // Balanced positioning for smaller screens
          repeat: "no-repeat",
          attachment: "scroll",
        };
      } else {
        // Mobile and portrait orientations
        newSettings = {
          src: imageSrc,
          size: "cover",
          position: "center 12%", // Balanced positioning for mobile
          repeat: "no-repeat",
          attachment: "scroll",
        };
      }

      setSettings(newSettings);
    };

    calculateBackgroundSettings();

    const debouncedResize = debounce(calculateBackgroundSettings, 150);
    window.addEventListener("resize", debouncedResize);

    return () => window.removeEventListener("resize", debouncedResize);
  }, [imageSrc]);

  return settings;
};

const LogisticsPage: React.FC = () => {
  // Responsive background hook
  const backgroundSettings = useResponsiveBackground(
    "/images/logistics/bg-hero.png",
  );

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

  // Mobile detection with debouncing
  useEffect(() => {
    const checkIfMobile = (): void => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    checkIfMobile();
    const debouncedCheck = debounce(checkIfMobile, 150);
    window.addEventListener("resize", debouncedCheck);
    return () => window.removeEventListener("resize", debouncedCheck);
  }, []);

  // Background style object
  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `url('${backgroundSettings.src}')`,
    backgroundSize: backgroundSettings.size,
    backgroundPosition: backgroundSettings.position,
    backgroundRepeat: backgroundSettings.repeat,
    backgroundAttachment: backgroundSettings.attachment,
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative min-h-screen">
        {/* Background Image with Responsive Settings */}
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={backgroundStyle} />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Centered Card - Moved further down */}
          <div className="relative z-30 flex flex-1 items-center justify-center px-4 pb-8 pt-48 md:pt-60">
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

          {/* Partners Carousel - Moved further down as well */}
          <div className="z-40 px-4 pb-16 pt-2 md:pb-24 md:pt-4">
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

      {/* Service Cards Section */}
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
