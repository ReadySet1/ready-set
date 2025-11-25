"use client";

import React from "react";
import { motion } from "framer-motion";
import { MapPin, Headset, Truck } from "lucide-react";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay,
}) => {
  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
    >
      <motion.div
        className="flex w-full max-w-[380px] flex-col items-center rounded-3xl border-4 border-yellow-400 bg-white p-8 shadow-sm"
        whileHover={{ scale: 1.03, y: -5 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="mb-6 text-yellow-400">{icon}</div>
        <h3 className="mb-4 text-center text-xl font-black uppercase leading-tight tracking-wide text-gray-800 md:text-2xl">
          {title}
        </h3>
        <p className="text-center text-base leading-relaxed text-gray-700">
          {description}
        </p>
      </motion.div>
    </motion.div>
  );
};

const CateringFeatures: React.FC = () => {
  const { openForm, DialogForm } = FormManager();

  const handleGetStarted = () => {
    openForm("food");
  };

  const features = [
    {
      icon: <MapPin size={80} strokeWidth={2.5} fill="currentColor" />,
      title: "Flexible Coordination",
      description:
        "We simplify coordination and make sure every delivery is confirmed, scheduled, and on time.",
      delay: 0,
    },
    {
      icon: <Headset size={80} strokeWidth={2.5} />,
      title: "Transparent Service",
      description:
        "With real-time tracking and responsive support, you always know where your order is.",
      delay: 200,
    },
    {
      icon: <Truck size={80} strokeWidth={2.5} />,
      title: "Hands-Off Experience",
      description:
        "Dependable, trained drivers handle every detail, from quick drop-offs to full setups.",
      delay: 400,
    },
  ];

  return (
    <div className="w-full bg-gray-50 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        {/* Title */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-black text-gray-800 md:text-5xl lg:text-6xl">
            More Than Just Delivery
          </h2>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={feature.delay}
            />
          ))}
        </div>

        {/* Get Started Button */}
        <motion.div
          className="mt-16 flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.button
            onClick={handleGetStarted}
            className="rounded-lg bg-yellow-400 px-12 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
          </motion.button>
        </motion.div>
      </div>
      {/* Render the dialog form */}
      {DialogForm}
    </div>
  );
};

export default CateringFeatures;
