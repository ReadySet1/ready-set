"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface PartnerLogo {
  name: string;
  image: string;
  alt: string;
}

const DeliveryPartners: React.FC = () => {
  // Partner logos - user will add images later
  const partners: PartnerLogo[] = [
    { name: "Destino", image: "/images/food/partners/destino.png", alt: "Destino logo" },
    { name: "Grace Deli & Cafe", image: "/images/food/partners/grace.png", alt: "Grace Deli & Cafe logo" },
    { name: "Kasa Indian Eatery", image: "/images/food/partners/kasa.png", alt: "Kasa Indian Eatery logo" },
    { name: "Hungry", image: "/images/food/partners/hungry.png", alt: "Hungry logo" },
    { name: "CaterValley", image: "/images/food/partners/catervalley.png", alt: "CaterValley logo" },
    { name: "Conviva", image: "/images/food/partners/conviva.png", alt: "Conviva logo" },
    { name: "Roost Roast", image: "/images/food/partners/roostroast.png", alt: "Roost Roast logo" },
    { name: "Noor Indian Fusion Kitchen", image: "/images/food/partners/noor.png", alt: "Noor Indian Fusion Kitchen logo" },
    { name: "Food.ee", image: "/images/food/partners/foodee.jpg", alt: "Food.ee logo" },
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
            Our Food Delivery Partners
          </h2>
          <p className="font-[Montserrat] text-base font-medium text-gray-600 md:text-lg">
            We&apos;re proud to collaborate with some of the top names in the industry:
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
                <div className="relative h-24 w-full max-w-[200px] transition-transform hover:scale-105 md:h-32 lg:h-36">
                  <Image
                    src={partner.image}
                    alt={partner.alt}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                    onError={(e) => {
                      // Hide image if it fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
          {/* Last logo centered */}
          {partners.length > 8 && (
            <motion.div
              className="mt-8 flex justify-center md:mt-10"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: 0.8,
              }}
            >
              <div className="relative h-24 w-full max-w-[200px] transition-transform hover:scale-105 md:h-32 lg:h-36">
                <Image
                  src={partners[8].image}
                  alt={partners[8].alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 200px"
                  onError={(e) => {
                    // Hide image if it fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryPartners;
