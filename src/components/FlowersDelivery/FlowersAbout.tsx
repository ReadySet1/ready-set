"use client";

import React from "react";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { motion } from "framer-motion";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import Link from "next/link";

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
});

interface StatProps {
  value: string;
  label: string;
  delay: number;
}

const StatCard: React.FC<StatProps> = ({ value, label, delay }) => {
  return (
    <motion.div
      className="flex flex-col items-start justify-center rounded-2xl bg-gray-50 px-6 py-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
    >
      <h3 className="mb-1 text-3xl font-black italic text-yellow-400 md:text-4xl">
        {value}
      </h3>
      <p className="text-sm font-semibold text-gray-800 md:text-base">
        {label}
      </p>
    </motion.div>
  );
};

const FlowersAbout: React.FC = () => {
  const stats = [
    { value: "2019", label: "Founded", delay: 0 },
    { value: "157K+", label: "Deliveries Completed", delay: 100 },
    { value: "98%", label: "On-Time Delivery Rate", delay: 200 },
    { value: "200+", label: "Professional Drivers", delay: 300 },
  ];

  return (
    <div className="w-full bg-white py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Heading, Description, Stats */}
          <motion.div
            className="flex flex-col justify-center"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2
              className={`${playfair.className} mb-6 text-3xl font-black italic leading-tight text-gray-900 md:text-4xl lg:text-5xl`}
            >
              Keep Every Bouquet
              <br />
              Looking Its Best
            </h2>

            <p className="mb-8 max-w-lg text-sm leading-relaxed text-gray-600 md:text-base">
              At Ready Set, we specialize in local floral deliveries across
              cities such as San Francisco, Atlanta, and Austin, offering
              real-time tracking and careful handling to ensure your blooms
              arrive on time and maintain your shop&apos;s reputation.
            </p>

            {/* 2x2 Stats Grid */}
            <div className="grid max-w-md grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <StatCard
                  key={index}
                  value={stat.value}
                  label={stat.label}
                  delay={stat.delay}
                />
              ))}
            </div>
          </motion.div>

          {/* Right Column - Image + CTA */}
          <motion.div
            className="flex flex-col items-center justify-center"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-full overflow-hidden rounded-3xl border-t-4 border-yellow-400">
              <Image
                src={getCloudinaryUrl("flowers/flowers-about")}
                alt="Florist arranging bouquets in a flower shop"
                width={800}
                height={600}
                className="h-auto w-full object-cover"
                priority
              />
            </div>

            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <Link
                href="/vendor-hero#vendor-hero"
                className="inline-block rounded-lg border-2 border-gray-900 px-10 py-3.5 text-base font-extrabold text-gray-900 transition-all hover:-translate-y-0.5 hover:bg-gray-900 hover:text-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              >
                How Our Service Works
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FlowersAbout;
