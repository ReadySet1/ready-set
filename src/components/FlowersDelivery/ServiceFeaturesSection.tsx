"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getCloudinaryUrl } from "@/lib/cloudinary";

interface ServiceFeatureData {
  icon: string;
  title?: string;
  altText?: string;
  description: React.ReactNode;
  delay?: number;
}

interface ServiceFeatureProps extends ServiceFeatureData {
  showTitleInBox?: boolean;
  variant?: "box" | "specialty";
}

interface ServiceFeaturesSectionProps {
  features: ServiceFeatureData[];
  showTitleInBox?: boolean;
  backgroundImage?: string;
  backgroundColor?: string;
  variant?: "box" | "specialty";
  title?: string;
  subtitle?: string;
}

const FeatureBox: React.FC<ServiceFeatureProps> = ({
  icon,
  title,
  altText,
  description,
  delay = 0,
  showTitleInBox = true,
  variant = "box",
}) => {
  const adjustedTitle =
    title === "Bulk Orders? No Problem!" ? (
      <>
        Bulk Orders?
        <br />
        No Problem!
      </>
    ) : (
      title
    );

  if (variant === "specialty") {
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
            src={icon}
            alt={altText || (typeof title === "string" ? title : "")}
            fill
            sizes="(max-width: 768px) 100vw, 280px"
            className="object-cover"
            priority
          />
        </motion.div>
        <p className="mt-6 w-full max-w-[280px] text-center text-base leading-snug text-black">
          {description}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
    >
      <motion.div
        className="flex h-[320px] w-full flex-col items-center justify-center rounded-[50px] bg-[#FFD015] p-8 shadow-md"
        whileHover={{ scale: 1.03, y: -5 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <Image
          src={icon}
          alt={altText || (typeof title === "string" ? title : "")}
          width={450}
          height={450}
          className={showTitleInBox ? "" : "mb-1"}
          priority
        />
        {showTitleInBox && title && (
          <h3 className="text-center text-3xl font-black leading-tight text-black">
            {adjustedTitle}
          </h3>
        )}
      </motion.div>
      <div className="mt-6 max-w-[340px] px-4">
        <p className="text-center text-base leading-relaxed text-black">
          {description}
        </p>
      </div>
    </motion.div>
  );
};

const ServiceFeaturesSection: React.FC<ServiceFeaturesSectionProps> = ({
  features,
  showTitleInBox = true,
  backgroundImage,
  backgroundColor,
  variant = "box",
  title = "It's Not Just What We Do",
  subtitle = "It's How We Do It",
}) => {
  const containerStyle = backgroundImage
    ? {
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : backgroundColor
      ? { backgroundColor }
      : {};

  const containerClasses =
    variant === "specialty"
      ? "w-full bg-cover bg-center bg-no-repeat"
      : "w-full";

  const innerContainerClasses =
    variant === "specialty"
      ? "mx-auto max-w-7xl px-4 py-8"
      : "mx-auto max-w-7xl px-4 py-16";

  const titleClasses =
    variant === "specialty"
      ? "text-[clamp(1.5rem,5vw,2.25rem)] font-bold leading-tight text-black"
      : "text-4xl font-bold text-gray-800 md:text-5xl";

  const gridClasses =
    variant === "specialty"
      ? "flex flex-col items-center justify-between gap-8 md:flex-row md:items-stretch md:gap-4 lg:gap-8"
      : "grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10";

  return (
    <div className={containerClasses} style={containerStyle}>
      <div className={innerContainerClasses}>
        <div
          className={
            variant === "specialty" ? "mb-12 text-center" : "mb-14 text-center"
          }
        >
          <h2 className={`mb-2 ${titleClasses}`}>{title}</h2>
          <h2
            className={`${titleClasses} ${variant === "specialty" ? "mb-8" : ""}`}
          >
            {subtitle}
          </h2>
        </div>

        <div className={gridClasses}>
          {features.map((feature, index) => (
            <FeatureBox
              key={index}
              icon={feature.icon}
              title={feature.title}
              altText={feature.altText}
              description={feature.description}
              delay={feature.delay}
              showTitleInBox={showTitleInBox}
              variant={variant}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Export both the main component and a configured version for flowers
export default ServiceFeaturesSection;

// Pre-configured component for flowers delivery (backward compatibility)
export const FlowersServiceFeatures: React.FC = () => {
  const flowersFeatures = [
    {
      icon: getCloudinaryUrl("flowers/computer"),
      title: "Bulk Orders? No Problem!",
      description: (
        <span>
          We handle a{" "}
          <span className="font-extrabold">minimum of 10 bulk orders</span> per
          route, making your logistics smoother and more efficient.
        </span>
      ),
      delay: 0,
    },
    {
      icon: getCloudinaryUrl("flowers/truck"),
      title: "Personalized Delivery Service",
      description:
        "You'll get a dedicated driver assigned to your shop. No more guessing who's coming—just familiar, reliable service every time.",
      delay: 200,
    },
    {
      icon: getCloudinaryUrl("flowers/agent"),
      title: "Hands-On Support",
      description:
        "Our helpdesk monitors every delivery from dispatch to doorstep, keeping you updated in real-time so you're never in the dark — so you can focus more on operations while we handle the admin work.",
      delay: 400,
    },
  ];

  return (
    <ServiceFeaturesSection features={flowersFeatures} showTitleInBox={true} />
  );
};

// Pre-configured component for food/catering delivery
export const FoodServiceFeatures: React.FC = () => {
  const foodFeatures = [
    {
      icon: getCloudinaryUrl("food/cards/truck"),
      altText: "Reliable Delivery Truck",
      description:
        "Our professional, reliable drivers act as an extension of your brand—punctual, presentable and committed to handling every delivery with care.",
      delay: 0,
    },
    {
      icon: getCloudinaryUrl("food/cards/bag"),
      altText: "Proper Equipment Bag",
      description:
        "We use insulated bags and pro-grade gear to keep food fresh, presentable and at the right temperature—solving a major pain point for restaurants.",
      delay: 200,
    },
    {
      icon: getCloudinaryUrl("food/cards/headset"),
      altText: "Delivery Support Headset",
      description:
        "We go beyond delivery, streamlining operations to align with industry needs and elevate the experience into a seamless extension of your service.",
      delay: 400,
    },
  ];

  return (
    <ServiceFeaturesSection
      features={foodFeatures}
      showTitleInBox={false}
      backgroundImage={getCloudinaryUrl("food/bagbg")}
    />
  );
};

// Pre-configured component for specialty delivery
export const SpecialtyServiceFeatures: React.FC = () => {
  const specialtyFeatures = [
    {
      icon: getCloudinaryUrl("food/cards/truck"),
      altText: "Reliable Delivery Truck",
      description:
        "Our HIPAA-trained drivers and support team act as a seamless extension of your brand, punctual, professional, and committed to every delivery.",
      delay: 0,
    },
    {
      icon: getCloudinaryUrl("specialty/handling"),
      altText: "Handling Specialty Items",
      description:
        "We ensure your items, whether medications, legal documents, equipment, or parcels, are delivered with the utmost care and strict confidentiality.",
      delay: 200,
    },
    {
      icon: getCloudinaryUrl("food/cards/headset"),
      altText: "Delivery Support Headset",
      description:
        "We go beyond delivery, streamlining operations to align with industry needs and elevate the experience into a seamless extension of your service.",
      delay: 400,
    },
  ];

  return (
    <ServiceFeaturesSection
      features={specialtyFeatures}
      showTitleInBox={false}
      backgroundImage={getCloudinaryUrl("food/bagbg")}
    />
  );
};
