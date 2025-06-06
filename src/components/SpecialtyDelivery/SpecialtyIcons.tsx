"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface ServiceFeatureProps {
  imageUrl: string;
  altText: string;
  description: React.ReactNode;
  delay?: number;
}

const ServiceFeature: React.FC<ServiceFeatureProps> = ({
  imageUrl,
  altText,
  description,
  delay = 0,
}) => {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
    >
      <motion.div
        className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-[24px]"
        whileHover={{ scale: 1.03, y: -5 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <Image
          src={imageUrl}
          alt={altText}
          fill
          sizes="(max-width: 768px) 100vw, 280px"
          className="object-cover"
          priority
        />
      </motion.div>
      <p className="mt-6 w-full max-w-[280px] text-center text-base leading-snug text-black sm:text-justify">
        {description}
      </p>
    </motion.div>
  );
};

const SpecialtyIcons: React.FC = () => {
  const serviceFeatures = [
    {
      imageUrl: "/images/food/cards/truck.png",
      altText: "Reliable Delivery Truck",
      description:
        "Our HIPAA-trained drivers and support team act as a seamless extension of your brand, punctual, professional, and committed to every delivery.",
      delay: 0,
    },
    {
      imageUrl: "/images/specialty/handling.png",
      altText: "Handling Specialty Items",
      description:
        "We ensure your items, whether medications, legal documents, equipment, or parcels, are delivered with the utmost care and strict confidentiality.",
      delay: 200,
    },
    {
      imageUrl: "/images/food/cards/headset.png",
      altText: "Delivery Support Headset",
      description:
        "We go beyond delivery, streamlining operations to align with industry needs and elevate the experience into a seamless extension of your service.",
      delay: 400,
    },
  ];

  return (
    <div
      className="w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/images/food/bagbg.png')` }}
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-[clamp(1.5rem,5vw,2.25rem)] font-bold leading-tight text-black">
            It's Not Just What We Do
          </h2>
          <h2 className="mb-8 text-[clamp(1.5rem,5vw,2.25rem)] font-bold leading-tight text-black">
            It's How We Do It
          </h2>
        </div>

        <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-stretch md:gap-4 lg:gap-8">
          {serviceFeatures.map((feature, index) => (
            <ServiceFeature
              key={index}
              imageUrl={feature.imageUrl}
              altText={feature.altText}
              description={feature.description}
              delay={feature.delay}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpecialtyIcons;
