import FlowerHero from "@/components/FlowersDelivery/FlowerHero";
import { FlowersServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
// import DeliveryTermsAndPricing from "@/components/FlowersDelivery/DeliveryTermsAndPricing";
import FlowersAbout from "@/components/FlowersDelivery/FlowersAbout";
import { Metadata } from "next";
// import ExpertSupportSection from "@/components/FlowersDelivery/ExpertSupportSection";
import FlowersDeliveryPartners from "@/components/FlowersDelivery/FlowersDeliveryPartners";
import ServiceProcessCarousel from "@/components/FlowersDelivery/ServiceProcessCarousel";
import DelicateBlooms from "@/components/FlowersDelivery/DelicateBlooms";
import FlowersSetupCarousel from "@/components/FlowersDelivery/FlowersSetupCarousel";
import FAQSection from "@/components/FlowersDelivery/FAQSection";
import CateringContact from "@/components/FoodDelivery/CateringContact";

export const metadata: Metadata = {
  title: "Flower Delivery Services",
  description:
    "Same-day flower delivery handled with care across the SF Bay Area and Austin. Request a quote today.", // DRAFT — review copy
  keywords: [
    "flower delivery service",
    "floral logistics",
    "Bay Area flower delivery",
    "same-day flower delivery",
  ],
  openGraph: {
    title: "Flower Delivery Services | Ready Set",
    description:
      "Same-day flower delivery handled with care across the SF Bay Area and Austin. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flower Delivery Services | Ready Set",
    description:
      "Same-day flower delivery handled with care across the SF Bay Area and Austin. Request a quote today.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/flowers-deliveries",
  },
};

const FlowersPage = () => {
  return (
    <main>
      <FlowerHero />
      <FlowersServiceFeatures />
      {/* <DeliveryTermsAndPricing /> */}
      <FlowersAbout />
      {/* <ExpertSupportSection /> */}
      {/* <FlowersDeliveryPartners /> */}
      {/* <ServiceProcessCarousel /> */}
      {/* <DelicateBlooms /> */}
      <FlowersSetupCarousel />
      <CateringContact />
      {/* <FAQSection /> */}
    </main>
  );
};

export default FlowersPage;
