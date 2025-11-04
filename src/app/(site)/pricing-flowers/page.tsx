import { Metadata } from "next";
import FlowerPricingLandingPage from "@/components/Pricing/FlowerPricingLandingPage";

export const metadata: Metadata = {
  title: "Flower Package Delivery Pricing | Ready Set",
  description:
    "Package delivery pricing for flower businesses across Bay Area regions",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FlowerPricingPage() {
  return <FlowerPricingLandingPage />;
}
