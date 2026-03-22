"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import ScheduleDialog from "@/components/Logistics/Schedule";

const LOGISTICS_CALENDAR_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true";

export interface PartnerLogo {
  name: string;
  image: string;
  alt: string;
  url: string;
}

export interface DeliveryPartnersProps {
  title?: string;
  subtitle?: string;
  partners?: PartnerLogo[];
  ctaLabel?: string;
  calendarUrl?: string;
}

const DEFAULT_FOOD_PARTNERS: PartnerLogo[] = [
    {
      name: "Destino",
      image: getCloudinaryUrl("food/partners/destino"),
      alt: "Destino logo",
      url: "https://www.destinosf.com/",
    },
    {
      name: "Grace Deli & Cafe",
      image: getCloudinaryUrl("food/partners/grace"),
      alt: "Grace Deli & Cafe logo",
      url: "https://www.grace303.com/",
    },
    {
      name: "Kasa Indian Eatery",
      image: getCloudinaryUrl("food/partners/kasa"),
      alt: "Kasa Indian Eatery logo",
      url: "https://kasaindian.com/",
    },
    {
      name: "Hungry",
      image: getCloudinaryUrl("food/partners/hungry"),
      alt: "Hungry logo",
      url: "https://www.tryhungry.com/",
    },
    {
      name: "CaterValley",
      image: getCloudinaryUrl("food/partners/catervalley"),
      alt: "CaterValley logo",
      url: "https://catervalley.com/",
    },
    {
      name: "Conviva",
      image: getCloudinaryUrl("food/partners/conviva"),
      alt: "Conviva logo",
      url: "https://www.conviva.com/",
    },
    {
      name: "Roost Roast",
      image: getCloudinaryUrl("food/partners/roostroast"),
      alt: "Roost Roast logo",
      url: "https://www.roostandroast.com/",
    },
    {
      name: "Noor Indian Fusion Kitchen",
      image: getCloudinaryUrl("food/partners/noor"),
      alt: "Noor Indian Fusion Kitchen logo",
      url: "https://noorfusionkitchen.com/",
    },
    {
      name: "Food.ee",
      image: getCloudinaryUrl("food/partners/foodee"),
      alt: "Food.ee logo",
      url: "https://specials.tryhungry.com/foodeeandhungry",
    },
    {
      name: "La BBQ",
      image: getCloudinaryUrl("food/partners/labbq"),
      alt: "La BBQ logo",
      url: "https://labarbecue.com/#",
    },
  ];

const DeliveryPartners: React.FC<DeliveryPartnersProps> = ({
  title = "Our Food Delivery Partners",
  subtitle = "We're proud to collaborate with some of the top names in the industry:",
  partners = DEFAULT_FOOD_PARTNERS,
  ctaLabel = "Partner With Us",
  calendarUrl = LOGISTICS_CALENDAR_URL,
}) => {
  return (
    <div className="w-full bg-white py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4">
        {/* Title Section */}
        <motion.div
          className="mb-4 text-center"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="mb-3 font-[Montserrat] text-3xl font-black text-gray-800 md:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="font-[Montserrat] text-base font-medium text-gray-600 md:text-lg">
            {subtitle}
          </p>
        </motion.div>

        {/* Partner Logos Grid */}
        <div className="mt-12">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8 lg:gap-10">
            {partners.slice(0, 8).map((partner, index) => (
              <motion.div
                key={partner.name}
                className="flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
              >
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative h-24 w-full max-w-[200px] transition-transform hover:scale-105 md:h-32 lg:h-36"
                  aria-label={`Visit ${partner.name} website`}
                >
                  <Image
                    src={partner.image}
                    alt={partner.alt}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                  />
                </a>
              </motion.div>
            ))}
          </div>
          {/* Remaining logos centered */}
          {partners.length > 8 && (
            <div className="mt-8 flex flex-wrap justify-center gap-6 md:mt-10 md:gap-8 lg:gap-10">
              {partners.slice(8).map((partner, index) => (
                <motion.div
                  key={partner.name}
                  className="flex w-[calc(50%-12px)] items-center justify-center md:w-[calc(25%-24px)]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: 0.8 + index * 0.1,
                  }}
                >
                  <a
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-24 w-full max-w-[200px] transition-transform hover:scale-105 md:h-32 lg:h-36"
                    aria-label={`Visit ${partner.name} website`}
                  >
                    <Image
                      src={partner.image}
                      alt={partner.alt}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                    />
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Partner With Us Button */}
        <motion.div
          className="mt-12 flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <ScheduleDialog
            buttonText={ctaLabel}
            calendarUrl={calendarUrl}
            className="rounded-lg bg-yellow-400 px-8 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryPartners;
