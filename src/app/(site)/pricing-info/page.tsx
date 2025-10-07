import { Metadata } from "next";
import PricingLandingPage from "@/components/Pricing/PricingLandingPage";

export const metadata: Metadata = {
  title: "Pricing Information | Ready Set",
  description: "Ready Set catering delivery pricing information",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PricingInfoPage() {
  return <PricingLandingPage />;
}
