"use client";

import React from "react";
import ScheduleDialog from "@/components/Logistics/Schedule";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

/**
 * CateringStats Component
 *
 * Displays catering company statistics with call-to-action buttons.
 */
const CateringStats: React.FC = () => {
  const { openForm, DialogForm } = FormManager();

  /**
   * Handles the "Get a Quote" button click
   * Opens the food delivery quote form
   */
  const handleQuoteClick = () => {
        openForm("food");
  };

  return (
    <section className="w-full bg-white py-12 md:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Statistics and CTA Section */}
        <div className="flex flex-col items-center justify-center space-y-6 text-center">
          {/* Statistics Text */}
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
              Since 2019, we've completed over{" "}
              <span className="text-yellow-500">338,000</span> successful
              catering deliveries with{" "}
              <span className="text-yellow-500">350+</span> restaurant partners.
            </h2>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:gap-6">
            <button
              onClick={handleQuoteClick}
              className="w-full rounded-lg bg-yellow-500 px-8 py-3 text-base font-bold text-gray-900 shadow-lg transition-all duration-200 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
            >
              Get a Quote
            </button>
            <ScheduleDialog
              buttonText="Book a Call"
              className="w-full rounded-lg bg-yellow-500 px-8 py-3 text-base font-bold text-gray-900 shadow-lg transition-all duration-200 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
              calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
            />
          </div>
        </div>
      </div>

      {/* Render the dialog form */}
      {DialogForm}
    </section>
  );
};

export default CateringStats;
