"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import ScheduleDialog from "@/components/Logistics/Schedule";

interface StatProps {
  value: string;
  label: string;
  delay: number;
}

const StatCard: React.FC<StatProps> = ({ value, label, delay }) => {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      data-testid="stat-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
    >
      <h3 className="mb-2 font-[Montserrat] text-3xl font-black text-yellow-400 md:text-4xl lg:text-5xl">
        {value}
      </h3>
      <p className="font-[Montserrat] text-lg font-semibold text-gray-800 md:text-xl">
        {label}
      </p>
    </motion.div>
  );
};

const CateringAbout: React.FC = () => {
  const stats = [
    { value: "350+", label: "Restaurants Served", delay: 0 },
    { value: "338K+", label: "Deliveries Completed", delay: 200 },
    { value: "98%", label: "On-Time Delivery Rate", delay: 400 },
  ];

  const checkoutItems = [
    "Pricing and Delivery Terms",
    "Hosting Service",
    "How We Operate",
    "How to Get Started",
    "Most Frequent Questions",
  ];

  return (
    <div className="w-full bg-white py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Image and Stats */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Image */}
            <div className="relative mb-8 overflow-hidden rounded-3xl">
              <Image
                src="/images/food/catering-about.png"
                alt="Restaurant owners reviewing catering orders"
                width={800}
                height={600}
                className="h-auto w-full object-cover"
                priority
              />
            </div>

            {/* Text above stats */}
            <motion.p
              className="mb-8 text-center font-[Montserrat] text-base font-medium text-gray-700 md:text-lg"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Since 2019, we&apos;ve completed over 338,000 successful catering
              deliveries from 350+ restaurants.
            </motion.p>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
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

          {/* Right Column - Content */}
          <motion.div
            className="flex flex-col justify-center"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="mb-6 font-[Montserrat] text-3xl font-black leading-tight text-gray-800 md:text-4xl lg:text-5xl">
              Delivery Designed for Your Catering
            </h2>

            <div className="mb-6 space-y-4">
              <p className="font-[Montserrat] text-base leading-relaxed text-gray-700 md:text-lg">
                At Ready Set, we specialize in catering delivery logistics.
                Since launching in 2019 in the San Francisco Bay Area,
                we&apos;ve expanded to Austin, Atlanta, and Dallas, partnering
                with hundreds of restaurants and catering brands to ensure every
                order arrives on time and perfectly presented.
              </p>

              <p className="font-[Montserrat] text-base leading-relaxed text-gray-700 md:text-lg">
                We&apos;re not a marketplace or broker — we don&apos;t take
                customer orders or list you on apps. Instead, we act as your
                behind-the-scenes delivery partner, managing every step from
                pickup to setup so your team can focus on the food and the
                experience.
              </p>
            </div>

            {/* Check out section */}
            <div className="mb-8">
              <p className="mb-4 font-[Montserrat] text-base font-semibold text-gray-800 md:text-lg">
                Check out:
              </p>
              <ul className="space-y-2">
                {checkoutItems.map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                    className="font-[Montserrat] text-base text-gray-700 md:text-lg"
                  >
                    • {item}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Learn More Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <ScheduleDialog
                buttonText="Learn More"
                dialogTitle="Schedule an Appointment"
                dialogDescription="Choose a convenient time for your appointment."
                calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                customButton={
                  <motion.button
                    className="rounded-lg bg-yellow-400 px-12 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Learn More
                  </motion.button>
                }
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CateringAbout;
