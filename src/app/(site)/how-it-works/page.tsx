import Breadcrumb from "@/components/Common/Breadcrumb";
import HowItWorks from "@/components/HowItWorks";
import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/how-it-works",
  },
};

const HowItWorksPage = () => {
  return (
    <>
      <Breadcrumb pageName="How It Works" pagePath="/how-it-works" />
      <HowItWorks />
    </>
  );
};
export default HowItWorksPage;
