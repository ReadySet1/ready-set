"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import ScheduleDialog from "../Logistics/Schedule";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

interface FoodHeaderProps {
  onRequestQuote?: () => void;
}

const FoodHeader: React.FC<FoodHeaderProps> = ({ onRequestQuote }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [marginTopClass, setMarginTopClass] = useState("mt-0");
  const { openForm, DialogForm } = FormManager();

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      updateMarginTopClass(window.innerWidth);
    };

    const updateMarginTopClass = (width: number) => {
      if (width < 768) {
        setMarginTopClass("mt-6");
      } else if (width < 1024) {
        setMarginTopClass("mt-8");
      } else {
        setMarginTopClass("mt-4");
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  const handleQuoteClick = () => {
    openForm("food");
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        delay: 0.2,
      },
    },
  };

  const buttonVariants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
    tap: { scale: 0.95 },
  };

  const pulseAnimation = {
    scale: [1, 1.02, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      repeatType: "reverse" as const,
    },
  };

  return (
    <section
      className={`relative h-[70vh] min-h-[600px] w-full ${marginTopClass} mb-16 md:mb-24 lg:mb-32`}
    >
      {/* Background image container */}
      <motion.div
        className="absolute inset-0 z-0"
        variants={imageVariants}
        initial="hidden"
        animate="visible"
      >
        <Image
          src="/images/food/food-containers.png"
          alt="Food containers with various prepared meals"
          fill
          className="object-cover object-center"
          priority
        />
      </motion.div>

      {/* Text content overlay */}
      <motion.div
        className="relative z-10 mx-auto flex h-full max-w-[1600px] items-center px-4 py-12 md:px-8 md:py-16 lg:px-12 lg:py-20"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="relative z-10 ml-16 w-full max-w-md space-y-3 md:ml-28 lg:ml-32"
          variants={containerVariants}
        >
          <motion.h1
            className="font-[Montserrat] text-xl font-black leading-tight tracking-tight text-gray-800 md:text-2xl lg:text-3xl"
            variants={itemVariants}
          >
            From Pickup to Complete Setup
          </motion.h1>

          <motion.p
            className="font-[Montserrat] text-xs font-medium leading-relaxed text-gray-700 md:text-sm lg:text-base"
            variants={itemVariants}
          >
            More than delivery — we&apos;re a trusted partner helping
            restaurants, caterers, and foodservice providers solve their
            toughest logistics challenges.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-4 pt-2"
            variants={itemVariants}
          >
            <motion.button
              onClick={handleQuoteClick}
              className="rounded-lg bg-yellow-300 px-8 py-3 font-[Montserrat] text-base font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-400 hover:shadow-lg md:px-10 md:py-4 md:text-lg"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              Get a Quote
            </motion.button>
            <ScheduleDialog
              buttonText="Book a Call"
              calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
              className="rounded-lg bg-yellow-300 px-8 py-3 font-[Montserrat] text-base font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-400 hover:shadow-lg md:px-10 md:py-4 md:text-lg"
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Render the dialog form */}
      {DialogForm}
    </section>
  );
};

export default FoodHeader;
