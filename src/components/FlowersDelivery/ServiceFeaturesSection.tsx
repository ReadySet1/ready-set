"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Headset, Truck } from "lucide-react";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import { getCloudinaryUrl } from "@/lib/cloudinary";

interface ServiceFeatureData {
  icon: string | React.ReactNode;
  title?: string;
  altText?: string;
  description: React.ReactNode;
  delay?: number;
}

interface ServiceFeatureProps extends ServiceFeatureData {
  showTitleInBox?: boolean;
  variant?: "box" | "specialty" | "outline";
}

interface ServiceFeaturesSectionProps {
  features: ServiceFeatureData[];
  showTitleInBox?: boolean;
  backgroundImage?: string;
  backgroundColor?: string;
  variant?: "box" | "specialty" | "outline";
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaClick?: (e: React.MouseEvent) => void;
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

  if (variant === "outline") {
    return (
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay / 1000 }}
      >
        <motion.div
          className="flex h-full w-full flex-col items-center justify-start rounded-3xl border border-gray-200 px-8 py-10"
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="mb-6 text-gray-400">
            {typeof icon === "string" ? (
              <Image
                src={icon}
                alt={altText || (typeof title === "string" ? title : "")}
                width={48}
                height={48}
                className="opacity-50"
              />
            ) : (
              icon
            )}
          </div>
          {title && (
            <h3 className="mb-4 text-center text-sm font-extrabold uppercase tracking-widest text-gray-800">
              {adjustedTitle}
            </h3>
          )}
          <p className="text-center text-sm leading-relaxed text-gray-500">
            {description}
          </p>
        </motion.div>
      </motion.div>
    );
  }

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
            src={icon as string}
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
          src={icon as string}
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
  ctaLabel,
  onCtaClick,
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

  const isOutline = variant === "outline";

  const containerClasses =
    variant === "specialty"
      ? "w-full bg-cover bg-center bg-no-repeat"
      : isOutline
        ? "w-full bg-gray-50"
        : "w-full";

  const innerContainerClasses =
    variant === "specialty"
      ? "mx-auto max-w-7xl px-4 py-8"
      : "mx-auto max-w-7xl px-4 py-16 md:py-24";

  const titleClasses =
    variant === "specialty"
      ? "text-[clamp(1.5rem,5vw,2.25rem)] font-bold leading-tight text-black"
      : isOutline
        ? "text-3xl font-bold text-gray-900 md:text-4xl"
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
            variant === "specialty"
              ? "mb-12 text-center"
              : isOutline
                ? "mb-12 text-center"
                : "mb-14 text-center"
          }
        >
          <h2 className={titleClasses}>{title}</h2>
          {subtitle && (
            <h2
              className={`mt-2 ${titleClasses} ${variant === "specialty" ? "mb-8" : ""}`}
            >
              {subtitle}
            </h2>
          )}
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

        {ctaLabel && onCtaClick && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={onCtaClick}
              className="rounded-lg bg-yellow-400 px-8 py-3 text-base font-bold text-gray-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-yellow-500 hover:shadow-lg"
            >
              {ctaLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Export both the main component and a configured version for flowers
export default ServiceFeaturesSection;

// Pre-configured component for flowers delivery
export const FlowersServiceFeatures: React.FC = () => {
  const { openForm, DialogForm } = FormManager();

  const flowersFeatures: ServiceFeatureData[] = [
    {
      icon: <MapPin size={48} strokeWidth={1.2} className="text-gray-400" />,
      title: "Bulk Orders? No Problem!",
      description:
        "We handle at least 10 orders per route, keeping your logistics smooth and efficient.",
      delay: 0,
    },
    {
      icon: <Headset size={48} strokeWidth={1.2} className="text-gray-400" />,
      title: "Hands-On Support",
      description:
        "We monitor every delivery from dispatch to doorstep with real-time updates.",
      delay: 200,
    },
    {
      icon: <Truck size={48} strokeWidth={1.2} className="text-gray-400" />,
      title: "Personalized Delivery Service",
      description:
        "A dedicated driver assigned to your shop. Reliable, familiar service every time.",
      delay: 400,
    },
  ];

  return (
    <>
      <ServiceFeaturesSection
        features={flowersFeatures}
        showTitleInBox={true}
        variant="outline"
        title="More Than Just Delivery"
        subtitle=""
        ctaLabel="Get Started"
        onCtaClick={(e) => {
          e.preventDefault();
          openForm("flower");
        }}
      />
      {DialogForm}
    </>
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
