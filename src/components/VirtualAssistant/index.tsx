"use client";

import Image from "next/image";
import { motion, HTMLMotionProps, Variants } from "framer-motion";
import * as React from "react";
import FeatureCarousel from "./FeatureCarousel";
import { MaskBackground } from "./MaskBackground";
import AppointmentDialog from "./Appointment";

const HeroHeader: React.FC = () => {
  const animations: Record<string, Variants> = {
    fadeIn: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
    staggerChildren: {
      visible: {
        transition: {
          staggerChildren: 0.2,
        },
      },
    },
    scaleIn: {
      hidden: { scale: 0.8, opacity: 0 },
      visible: {
        scale: 1,
        opacity: 1,
        transition: { type: "spring", stiffness: 100 },
      },
    },
  };

  return (
    <div className="bg-transparent">
      <section className="relative isolate">
        <div className="relative isolate flex min-h-screen flex-col justify-between">
          {/* Background Image */}
          <div className="absolute inset-0 h-screen overflow-hidden">
            <picture>
              <source
                srcSet="/images/virtual/header-bg.webp"
                type="image/webp"
              />
              <Image
                src="/images/virtual/header-bg.jpg"
                alt="Background"
                fill
                className="object-cover brightness-50"
                priority
              />
            </picture>
          </div>
          <MaskBackground />

          {/* Main Content */}
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4">
            <motion.div
              {...({
                className: "flex flex-grow flex-col items-center justify-center pt-32",
                initial: "hidden",
                animate: "visible",
                variants: animations.staggerChildren
              } as HTMLMotionProps<"div">)}
            >
              {/* Hero Title */}
              <motion.div
                {...({
                  className: "mx-auto max-w-4xl text-center",
                  variants: animations.fadeIn
                } as HTMLMotionProps<"div">)}
              >
                <h1 className="font-kabel text-white">
                  <span className="block text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
                    Ready, Set, Delegate!
                  </span>
                  <span className="mt-4 block text-xl font-normal leading-relaxed md:text-2xl lg:text-4xl">
                    Expert Virtual Assistants, Ready When You Are.
                  </span>
                </h1>
              </motion.div>

              {/* CTA Button with Dialog */}
              <motion.div
                {...({
                  className: "mt-12 md:mt-16",
                  variants: animations.scaleIn
                } as HTMLMotionProps<"div">)}
              >
                <AppointmentDialog calendarUrl="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ26Tewp9laqwen17F4qh13UwlakRL20eQ6LOJn7ANJ4swhUdFfc4inaFMixVsMghhFzE3nlpTSx?gv=true" />
              </motion.div>
            </motion.div>

            {/* Feature Carousel */}
            <motion.div
              {...({
                className: "mx-auto mb-4 w-full max-w-5xl px-4",
                variants: animations.fadeIn,
                initial: "hidden",
                animate: "visible",
                transition: { delay: 0.5 }
              } as HTMLMotionProps<"div">)}
            >
              <FeatureCarousel />
            </motion.div>
          </div>

          <MaskBackground />
        </div>
      </section>
    </div>
  );
};

export default HeroHeader;