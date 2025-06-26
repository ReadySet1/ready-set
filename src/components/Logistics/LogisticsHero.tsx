"use client";

import React, { useState } from "react";
import { Clock, Truck, Shield } from "lucide-react";
import ServiceFeaturesSection from "@/components/ui/ServiceFeaturesSection";
import ScrollToSection from "@/components/Common/ScrollToSection";
import ScheduleDialog from "./Schedule";

const LogisticsPage: React.FC = () => {
  const [shouldScroll, setShouldScroll] = useState(false);

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

  // Handle button clicks - restored original functionality
  const handleGetQuote = () => {
    // Scroll to the "Our Services" section
    setShouldScroll(true);
  };

  return (
    <>
      <ServiceFeaturesSection
        title="Premium Logistics Services"
        subtitle="Bay Area's Most Trusted Delivery Partner Since 2019"
        backgroundImage="/images/logistics/bg-hero.png"
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
      {shouldScroll && <ScrollToSection targetId="food-services" />}
    </>
  );
};

export default LogisticsPage;
