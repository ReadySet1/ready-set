import { Metadata } from "next";
import ModernPricingLandingPage from "@/components/Pricing/ModernPricingLandingPage";

export const metadata: Metadata = {
  title: "Pricing | Ready Set Catering Delivery",
  description: "Transparent, competitive pricing for premium catering delivery and hosting services. View our delivery rates and hosting packages.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PricingPage() {
  return <ModernPricingLandingPage />;
}
