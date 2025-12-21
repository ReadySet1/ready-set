"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getCloudinaryUrl } from "@/lib/cloudinary";

interface PartnerLogo {
  name: string;
  image: string;
  alt: string;
}

/**
 * ServedPartners Component
 *
 * Displays a grid of marketplace and company logos that Ready Set has served.
 * This component shows logos without clickable links and without a CTA button,
 * focusing purely on brand credibility and social proof.
 */
const ServedPartners: React.FC = () => {
  const partners: PartnerLogo[] = [
    {
      name: "Zerocater",
      image: getCloudinaryUrl("food/served/zerocater"),
      alt: "Zerocater logo",
    },
    {
      name: "EazyCater",
      image: getCloudinaryUrl("food/served/ezcater"),
      alt: "EazyCater logo",
    },
    {
      name: "Google",
      image: getCloudinaryUrl("food/served/google"),
      alt: "Google logo",
    },
    {
      name: "Netflix",
      image: getCloudinaryUrl("food/served/netflix"),
      alt: "Netflix logo",
    },
    {
      name: "Apple",
      image: getCloudinaryUrl("food/served/apple"),
      alt: "Apple logo",
    },
  ];

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
            We Served the Top Marketplace and Company
          </h2>
          <p className="font-[Montserrat] text-base font-medium text-gray-600 md:text-lg">
            Zerocater, EazyCater, Google, Netflix, Apple
          </p>
        </motion.div>

        {/* Partner Logos Grid */}
        <div className="mt-12">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-5 lg:gap-10">
            {partners.map((partner, index) => (
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
                <div
                  className="relative h-24 w-full max-w-[200px] md:h-32 lg:h-36"
                  aria-label={partner.name}
                >
                  <Image
                    src={partner.image}
                    alt={partner.alt}
                    fill
                    className="object-contain grayscale transition-all duration-300 hover:grayscale-0"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 200px"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServedPartners;
