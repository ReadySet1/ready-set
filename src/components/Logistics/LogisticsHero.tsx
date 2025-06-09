"use client"; // Se necesita "use client" porque el carrusel usa hooks de React y el plugin de autoplay

import React, { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image"; // Necesario para el componente Image de Next.js
import { Clock, Truck, Shield } from "lucide-react";
import Link from "next/link";
import GetQuoteButton from "./GetQuoteButton";
import ScheduleDialog from "./Schedule";

// Importaciones del carrusel
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// Interfaz para el tipo de socio
interface Partner {
  name: string;
  logo: string;
}

const LogisticsPage = () => {
  // Lista de socios de entrega (extraída de DeliveryPartners)
  const partners: Partner[] = useMemo(
    () => [
      { name: "Deli", logo: "/images/food/partners/Deli.jpg" },
      { name: "Bobcha", logo: "/images/food/partners/bobcha.jpg" },
      { name: "Foodee", logo: "/images/food/partners/foodee.jpg" },
      { name: "Destino", logo: "/images/food/partners/destino.png" },
      { name: "Conviva", logo: "/images/food/partners/conviva.png" },
      { name: "Kasa Indian Eatery", logo: "/images/food/partners/kasa.png" },
      { name: "CaterValley", logo: "/images/food/partners/catervalley.png" },
      // Agrega cualquier socio adicional aquí si es necesario
    ],
    [],
  );

  // Estado para verificar si es móvil (extraído de DeliveryPartners, aunque no se usa directamente para cambiar estilos en este componente, es útil para el plugin de autoplay)
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Referencia para el plugin de Autoplay (extraído de DeliveryPartners)
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );

  // Variable para verificar si el código se ejecuta en el cliente (navegador)
  const isClient = typeof window !== "undefined";

  // useEffect para detectar si es móvil (extraído de DeliveryPartners)
  useEffect(() => {
    const checkIfMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []); // Se ejecuta solo una vez al montar el componente

  return (
    <div className="min-h-screen bg-white">
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
          <div className="flex flex-1 items-center justify-center px-4 pb-8 pt-28 md:pt-40">
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

          {/* Service Cards */}
          <div className="px-4 pb-8 md:pb-16">
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
                  {/* <Link
                    href="/learn-more"
                    className="inline-flex items-center text-sm font-medium text-yellow-500 hover:text-yellow-600"
                  >
                    Learn More
                    <span className="ml-2">→</span>
                  </Link> */}
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
                  {/* <Link
                    href="/learn-more"
                    className="inline-flex items-center text-sm font-medium text-yellow-500 hover:text-yellow-600"
                  >
                    Learn More
                    <span className="ml-2">→</span>
                  </Link> */}
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
                  {/* <Link
                    href="/learn-more"
                    className="inline-flex items-center text-sm font-medium text-yellow-500 hover:text-yellow-600"
                  >
                    Learn More
                    <span className="ml-2">→</span>
                  </Link> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Partners Carousel Section --- */}
      <div className="w-full bg-gray-100 py-8 md:py-12">
        <div className="mx-auto max-w-[90%] md:max-w-[80%]">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-800 md:text-3xl">
            Nuestros Socios de Entrega
          </h2>
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
      {/* --- End Partners Carousel Section --- */}
    </div>
  );
};

export default LogisticsPage;
