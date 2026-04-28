"use client";

import React from "react";
import { Clock, Truck, Shield } from "lucide-react";
import ServiceFeaturesSection from "@/components/ui/ServiceFeaturesSection";
import ScheduleDialog from "./Schedule";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const LogisticsPage: React.FC = () => {
  const { openForm, DialogForm } = FormManager();

  // Logistics-specific features
  const logisticsFeatures = [
    {
      icon: Truck,
      title: "Specialized Delivery",
      description:
        "Expert handling of your needs with temperature-controlled vehicles and trained professionals.",
    },
    {
      icon: Clock,
      title: "Time-Critical Delivery",
      description:
        "Guaranteed on-time delivery for your events with real-time tracking and dedicated route optimization.",
    },
    {
      icon: Shield,
      title: "Quality Guaranteed",
      description:
        "Trusted by leading tech companies including Apple, Google, Facebook, and Netflix for reliable service.",
    },
  ];

  // Open the Catering / Food quote modal directly (most common service).
  // Previously scrolled to the food-services anchor, which left users with
  // an extra step ("now pick a service"). Modal-first matches the CTA copy.
  const handleGetQuote = () => {
    openForm("food");
  };

  return (
    <>
      <ServiceFeaturesSection
        title="Premium Logistics Services"
        subtitle="Bay Area's Most Trusted Delivery Partner Since 2019"
        backgroundImage={getCloudinaryUrl("logistics/bg-hero")}
        features={logisticsFeatures}
        primaryButtonText="Get Quote"
        secondaryButtonText="Schedule a Call"
        onPrimaryClick={handleGetQuote}
        customSecondaryButton={
          <ScheduleDialog
            buttonText="Schedule a Call"
            calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
            className="rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50"
          />
        }
        variant="logistics"
      />
      {DialogForm}
    </>
  );
};

export default LogisticsPage;
