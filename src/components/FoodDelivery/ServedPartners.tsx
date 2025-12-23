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
      // Use fit to scale up logo while adding white background to remove borders
      image: `${getCloudinaryUrl("food/served/zerocater").replace("/f_auto,q_auto/", "/f_auto,q_auto,b_white,w_600,h_600,c_fit/")}`,
      alt: "Zerocater logo",
    },
    {
      name: "EzCater",
      // Use fit to scale up logo while adding white background to remove borders
      image: `${getCloudinaryUrl("food/served/ezcater").replace("/f_auto,q_auto/", "/f_auto,q_auto,b_white,w_600,h_600,c_fit/")}`,
      alt: "EzCater logo",
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
            Zerocater, EzCater, Google, Netflix, Apple
          </p>
        </motion.div>

        {/* Partner Logos Grid */}
        <div className="mt-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-10 lg:grid-cols-5 lg:gap-12">
            {partners.map((partner, index) => (
              <motion.div
                key={partner.name}
                className="flex items-center justify-center px-2 py-4 sm:px-4"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
              >
                <div className="relative h-28 w-full min-w-[160px] max-w-[240px] sm:h-32 md:h-40 lg:h-44">
                  <Image
                    src={partner.image}
                    alt={partner.alt}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 45vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 240px"
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
