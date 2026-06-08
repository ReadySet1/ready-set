// src/app/(site)/logistics/page.tsx

import { Metadata } from "next";
import LogisticsHero from "@/components/Logistics/LogisticsHero";
import WhyChoose from "@/components/Logistics/WhyChoose";
import FoodServices from "@/components/Logistics/FoodServices";
import ImageCarousel from "@/components/Logistics/ImagesCarousel";
import FlowerDeliveryPage from "@/components/Logistics/FlowerDelivery";
import SpecialtyDelivery from "@/components/Logistics/SpecialtyDelivery";
import BakeryDeliverySection from "@/components/Logistics/BakeryDelivery";
import { ClientFormWrapper } from "@/components/Logistics/QuoteRequest/ClientFormWrapper";
import DeliveryOptions from "@/components/Logistics/DeliveryOptions";

export const metadata: Metadata = {
  title: "Delivery Services for Businesses",
  description:
    "On-demand business delivery and logistics built for reliability. Serving the SF Bay Area, Austin, and Dallas. Request a quote today.", // DRAFT — review copy
  keywords: [
    "business delivery service",
    "catering logistics",
    "Bay Area delivery",
    "on-demand courier",
  ],
  openGraph: {
    title: "Delivery Services for Businesses | Ready Set",
    description:
      "On-demand business delivery and logistics built for reliability. Serving the SF Bay Area, Austin, and Dallas. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
  },
  twitter: {
    card: "summary_large_image",
    title: "Delivery Services for Businesses | Ready Set",
    description:
      "On-demand business delivery and logistics built for reliability. Serving the SF Bay Area, Austin, and Dallas. Request a quote today.",
  },
  alternates: {
    canonical: "/logistics",
  },
};

export default function LogisticsPage() {
  return (
    <>
      <ClientFormWrapper>
        <LogisticsHero />
        <DeliveryOptions />
        <WhyChoose />
        {/* <ImageCarousel />
        <FoodServices />
        <FlowerDeliveryPage />
        <BakeryDeliverySection />
        <SpecialtyDelivery /> */}
      </ClientFormWrapper>
    </>
  );
}
