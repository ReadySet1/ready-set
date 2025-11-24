// src/app/(site)/catering-deliveries/page.tsx
import { Metadata } from "next";
// import { FoodServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import CateringFeatures from "@/components/FoodDelivery/CateringFeatures";
import CateringAbout from "@/components/FoodDelivery/CateringAbout";
import DeliveryTerms from "@/components/FoodDelivery/DeliveryTerms";
import HostingChecklist from "@/components/FoodDelivery/HostingChecklist";
import MainMeal from "@/components/FoodDelivery/MainMeal";
import FoodHeader from "@/components/FoodDelivery/FoodHeader";
import PromoPopup from "@/components/PopUpBanner/PromoPopup";
import CateringStats from "@/components/FoodDelivery/CateringStats";

export const metadata: Metadata = {
  title: "Food Delivery Services for Events | Ready Set",
  description:
    "We offer reliable and efficient catering delivery services for your events. Delicious food delivered right to your door in Bay Area and Sillicon Valley!",
  keywords: [
    "food delivery",
    "catering delivery",
    "event food",
    "catering service",
    "banquet delivery",
  ],
  openGraph: {
    title: "Exceptional Catering and Food Delivery Services | Ready Set",
    description:
      "Make your event a success with our high-quality food delivery. Serving in Bay Area and Sillicon Valley, always ensuring a memorable culinary experience.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your Brand: Hassle-Free Food Delivery for Events",
    description:
      "Need delicious food for your next event? We handle the delivery in Bay Area and Sillicon Valley! Contact us today.",
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
};

export default function FoodPage() {
  return (
    <div className="pt-20 md:pt-24">
      <PromoPopup />
      <FoodHeader />
      {/* <DeliveryPartners /> */}
      {/* <FoodServiceFeatures /> */}
      <CateringFeatures />
      <CateringAbout />
      <DeliveryTerms />
      <HostingChecklist />
      <MainMeal />
      <CateringStats />
    </div>
  );
}
