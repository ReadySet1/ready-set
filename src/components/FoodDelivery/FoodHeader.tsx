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
      className={`relative min-h-[500px] w-full ${marginTopClass} mb-16 bg-white md:mb-24 lg:mb-32`}
    >
      <motion.div
        className="relative mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-8 px-4 py-8 md:flex-row md:items-center md:gap-12 md:py-12 lg:gap-16 lg:py-16"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Left content - Text with dashed border path */}
        <motion.div
          className="relative z-10 w-full md:w-[45%] lg:w-[40%]"
          variants={containerVariants}
        >
          {/* Yellow dashed border path with location pins */}
          <motion.div
            className="relative min-h-[300px] rounded-2xl"
            style={{
              border: "3px dashed #facc15",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {/* Location pin icons */}
            <div className="absolute -left-3 -top-3 z-10">
              <MapPin className="h-8 w-8 text-yellow-400" fill="#facc15" />
            </div>
            <div className="absolute -bottom-3 -right-3 z-10">
              <MapPin className="h-8 w-8 text-yellow-400" fill="#facc15" />
            </div>

            {/* Content inside the border */}
            <div className="relative space-y-6 px-8 py-10 md:px-10 md:py-12">
              <motion.h1
                className="font-[Montserrat] text-3xl font-black leading-tight tracking-tight text-gray-800 md:text-4xl lg:text-5xl"
                variants={itemVariants}
              >
                From Pickup to Complete Setup
              </motion.h1>

              <motion.p
                className="font-[Montserrat] text-base font-medium leading-relaxed text-gray-700 md:text-lg lg:text-xl"
                variants={itemVariants}
              >
                More than delivery — we&apos;re a trusted partner helping
                restaurants, caterers, and foodservice providers solve their
                toughest logistics challenges.
              </motion.p>

              <motion.div
                className="flex flex-wrap items-center gap-4 pt-4"
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
            </div>
          </motion.div>

          {/* Second dashed path below the main border */}
          <motion.div
            className="relative hidden md:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {/* Vertical then horizontal dashed path */}
            <svg
              className="absolute left-[50%] top-0 h-32 w-80"
              style={{ overflow: "visible" }}
            >
              {/* Vertical line down */}
              <motion.line
                x1="0"
                y1="0"
                x2="0"
                y2="60"
                stroke="#facc15"
                strokeWidth="3"
                strokeDasharray="8 4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
              {/* Horizontal line right */}
              <motion.line
                x1="0"
                y1="60"
                x2="180"
                y2="60"
                stroke="#facc15"
                strokeWidth="3"
                strokeDasharray="8 4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
              />
            </svg>
            {/* Location pin at the end */}
            <div className="absolute left-[50%] top-[56px] z-10 ml-[176px]">
              <MapPin className="h-8 w-8 text-yellow-400" fill="#facc15" />
            </div>
          </motion.div>
        </motion.div>

        {/* Right content - Food containers image */}
        <motion.div
          className="flex w-full items-center justify-center md:mt-0 md:w-[55%] md:justify-end lg:w-[60%]"
          variants={containerVariants}
        >
          <div className="relative w-full">
            <motion.div
              className="relative flex items-center justify-end"
              variants={imageVariants}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              whileHover={{ scale: 1.01 }}
            >
              <Image
                src="/images/food/food-containers.png"
                alt="Food containers with various prepared meals"
                width={1200}
                height={900}
                className="h-auto w-full max-w-none object-contain"
                priority
                style={{ objectFit: "contain" }}
              />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
      {/* Render the dialog form */}
      {DialogForm}
    </section>
  );
};

export default FoodHeader;
