// src/app/(site)/catering-deliveries/page.tsx
import { Metadata } from "next";
// import { FoodServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import CateringFeatures from "@/components/FoodDelivery/CateringFeatures";
import CateringAbout from "@/components/FoodDelivery/CateringAbout";
import DeliveryPartners from "@/components/FoodDelivery/DeliveryPartners";
import ServedPartners from "@/components/FoodDelivery/ServedPartners";
import FoodSetupCarousel from "@/components/FoodDelivery/FoodSetupCarousel";
// import FoodGallery from "@/components/FoodDelivery/FoodGallery";
// import DeliveryTerms from "@/components/FoodDelivery/DeliveryTerms";
import HostingChecklist from "@/components/FoodDelivery/HostingChecklist";
import MainMeal from "@/components/FoodDelivery/MainMeal";
import FoodHeader from "@/components/FoodDelivery/FoodHeader";
import CateringStats from "@/components/FoodDelivery/CateringStats";
import CateringContact from "@/components/FoodDelivery/CateringContact";

export const metadata: Metadata = {
  title: "Catering Delivery Services",
  description:
    "Reliable catering delivery and full setup across the SF Bay Area, Austin, and Atlanta. Request a quote today.", // DRAFT — review copy
  keywords: [
    "catering delivery",
    "food delivery service",
    "event catering",
    "Bay Area catering",
  ],
  openGraph: {
    title: "Catering Delivery Services | Ready Set",
    description:
      "Reliable catering delivery and full setup across the SF Bay Area, Austin, and Atlanta. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catering Delivery Services | Ready Set",
    description:
      "Reliable catering delivery and full setup across the SF Bay Area, Austin, and Atlanta. Request a quote today.",
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
    canonical: "/catering-deliveries",
  },
};

export default function FoodPage() {
  return (
    <div className="pt-20 md:pt-24">
      <FoodHeader />
      {/* <FoodServiceFeatures /> */}
      <CateringFeatures />
      <CateringAbout />
      <DeliveryPartners />
      <ServedPartners />
      <FoodSetupCarousel />
      {/* <FoodGallery /> */}
      {/* <DeliveryTerms /> */}
      {/* <HostingChecklist /> */}
      {/* <MainMeal /> */}
      {/* <CateringStats /> */}
      <CateringContact />
    </div>
  );
}
