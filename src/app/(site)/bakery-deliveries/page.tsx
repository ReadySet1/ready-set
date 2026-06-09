// src/app/(site)/bakery-deliveries/page.tsx

import { Metadata } from "next";
import { FoodServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import BakeryPartners from "@/components/BakeryDelivery/BakeryPartners";
import BakeryTerms from "@/components/BakeryDelivery/BakeryTerms";
import DownloadableResources from "@/components/BakeryDelivery/DownloadableResources";
import BakeryHero from "@/components/BakeryDelivery/BakeryHero";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Bakery Delivery Services for Businesses",
  description:
    "Temperature-safe bakery delivery for vendors and events in the SF Bay Area and Austin. Request a quote today.", // DRAFT — review copy
  keywords: [
    "bakery delivery",
    "food delivery service",
    "Bay Area bakery delivery",
    "event catering",
  ],
  openGraph: {
    title: "Bakery Delivery Services for Businesses | Ready Set",
    description:
      "Temperature-safe bakery delivery for vendors and events in the SF Bay Area and Austin. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
    url: "/bakery-deliveries",
    images: [
      {
        url: getCloudinaryUrl("og-food-delivery"),
        width: 1200,
        height: 630,
        alt: "Ready Set bakery delivery services",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bakery Delivery Services for Businesses | Ready Set",
    description:
      "Temperature-safe bakery delivery for vendors and events in the SF Bay Area and Austin. Request a quote today.",
    images: [getCloudinaryUrl("twitter-food-card")],
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
    canonical: "/bakery-deliveries",
  },
};

export default function BakeryPage(): React.ReactElement {
  return (
    <div className="pt-20 md:pt-24">
      <BakeryHero />
      <BakeryPartners />
      <FoodServiceFeatures />
      <BakeryTerms />
      {/* <DownloadableResources /> */}
    </div>
  );
}
