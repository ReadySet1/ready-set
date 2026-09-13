"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import ScheduleDialog from "../Logistics/Schedule";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import { getCloudinaryUrl, ASSET_CACHE_VERSION } from "@/lib/cloudinary";

const FoodHeader: React.FC = () => {
  const { openForm, DialogForm } = FormManager();

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

  const buttonVariants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
    tap: { scale: 0.95 },
  };

  const heroBtnClasses =
    "rounded-full bg-yellow-300 px-6 py-2.5 font-[Montserrat] text-sm font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-400 hover:shadow-lg sm:px-8 sm:py-3 sm:text-base md:px-10 md:py-4 md:text-lg";

  return (
    <section
      className="relative min-h-[520px] w-full md:h-[70vh] md:min-h-[600px] mt-6 md:mt-8 lg:mt-4 mb-16 md:mb-24 lg:mb-32"
    >
      {/* Background image container */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={getCloudinaryUrl("food/catering-hero", { version: ASSET_CACHE_VERSION })}
          alt="Restaurant owners reviewing an order on a laptop"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />
      </div>

      {/* Text content overlay */}
      <motion.div
        className="relative z-10 mx-auto h-full max-w-[1600px] px-4 md:px-8 lg:px-12"
        initial={false}
        animate="visible"
        variants={containerVariants}
      >
        <div className="flex h-full flex-col justify-end pb-12 md:pb-16">
          <motion.div
            className="w-full max-w-[55%] space-y-3 rounded-lg bg-black/40 p-4 backdrop-blur-sm sm:max-w-[50%] md:max-w-md md:rounded-none md:bg-transparent md:p-0 md:backdrop-blur-none"
            initial={false}
            variants={containerVariants}
          >
            <motion.h1
              className="font-[Montserrat] text-2xl font-black leading-tight text-white md:text-4xl lg:text-5xl"
              initial={false}
              variants={itemVariants}
            >
              Because Great Food Deserves Great Delivery.
            </motion.h1>

            <motion.div
              className="flex flex-row flex-wrap gap-4 pt-2"
              initial={false}
              variants={itemVariants}
            >
              <motion.button
                onClick={handleQuoteClick}
                className={heroBtnClasses}
                initial={false}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                Get a Quote
              </motion.button>
              <ScheduleDialog
                buttonText="Book a Call"
                calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                className={heroBtnClasses}
              />
            </motion.div>
          </motion.div>

          {/* Description - flows under buttons on mobile, positioned bottom-right on md+ */}
          <motion.p
            className="mt-4 max-w-md font-[Montserrat] text-base font-medium leading-relaxed text-white/90 md:absolute md:bottom-10 md:right-8 md:mt-0 md:max-w-md md:text-center md:text-lg lg:right-12"
            initial={false}
            variants={itemVariants}
          >
            More than delivery — we&apos;re a trusted partner helping
            restaurants, caterers, and foodservice providers solve their
            toughest logistics challenges.
          </motion.p>
        </div>
      </motion.div>

      {/* Render the dialog form */}
      {DialogForm}
    </section>
  );
};

export default FoodHeader;
