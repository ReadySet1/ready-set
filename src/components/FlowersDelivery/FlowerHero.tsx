"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import ScheduleDialog from "../Logistics/Schedule";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
});

interface FlowerHeroProps {
  imagePath?: string;
}

const FlowerHero: React.FC<FlowerHeroProps> = ({
  imagePath = getCloudinaryUrl("flowers/flower-delivery-hero"),
}) => {
  const [isTextAnimated, setIsTextAnimated] = useState(false);
  const { openForm, DialogForm } = FormManager();

  useEffect(() => {
    setIsTextAnimated(true);
  }, []);

  const handleQuoteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openForm("flower");
  };

  return (
    <section className="relative mt-16 flex min-h-[80dvh] w-full items-center justify-center bg-white sm:mt-24 md:mt-14 md:min-h-screen">
      <div className="container flex h-full items-center px-4 py-12 sm:px-6 sm:py-8 md:py-0 lg:px-8">
        <div className="w-full">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between md:gap-12 lg:gap-16">
            {/* Text Content */}
            <div className="w-full text-center sm:text-left md:w-1/2 md:max-w-xl md:text-left">
              <div
                className={`transition-all duration-700 ease-in-out ${isTextAnimated ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
              >
                <h1
                  className={`${playfair.className} mb-6 text-4xl font-black italic leading-[1.15] tracking-tight text-gray-900 sm:text-5xl md:mb-8 lg:text-6xl`}
                >
                  Your Go-To Flower
                  <br />
                  Delivery Partner
                  <br />
                  Since 2019
                </h1>
              </div>

              <p
                className={`max-w-md text-sm leading-relaxed text-gray-600 transition-all delay-200 duration-700 ease-in-out md:text-base ${isTextAnimated ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
              >
                <span className="font-semibold text-gray-800">
                  157,000+ Floral Deliveries Completed
                </span>{" "}
                — From San Francisco Bay Area to Atlanta, Austin, and Dallas,
                every arrangement arrives fresh and intact.
              </p>

              {/* CTA Buttons */}
              <div
                className={`mt-8 flex flex-wrap justify-center gap-4 transition-all delay-500 duration-700 ease-in-out sm:justify-start md:mt-10 md:gap-5 ${isTextAnimated ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
              >
                <button
                  onClick={handleQuoteClick}
                  className="rounded-lg bg-yellow-400 px-7 py-3 text-base font-bold text-gray-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-500 hover:shadow-lg sm:px-10"
                >
                  Get a Quote
                </button>
                <ScheduleDialog
                  buttonText="Book a Call"
                  calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                  customButton={
                    <button className="rounded-lg border-2 border-yellow-400 px-7 py-3 text-base font-bold text-gray-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-50 hover:shadow-lg sm:px-10">
                      Book a Call
                    </button>
                  }
                />
              </div>
            </div>

            {/* Hero Image */}
            <div
              className={`relative w-full md:w-1/2 transition-all delay-300 duration-700 ease-in-out ${isTextAnimated ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                <Image
                  src={imagePath}
                  alt="Flower delivery driver handing a bouquet to a customer"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {DialogForm}
    </section>
  );
};

export default FlowerHero;
