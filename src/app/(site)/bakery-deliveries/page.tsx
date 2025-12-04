// src/app/(site)/bakery-deliveries/page.tsx

import { Metadata } from "next";
import { FoodServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import BakeryPartners from "@/components/BakeryDelivery/BakeryPartners";
import BakeryTerms from "@/components/BakeryDelivery/BakeryTerms";
import DownloadableResources from "@/components/BakeryDelivery/DownloadableResources";
import BakeryHero from "@/components/BakeryDelivery/BakeryHero";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Premium Food & Bakery Delivery Services | Ready Set",
  description:
    "Professional food and bakery delivery services for events, parties, and corporate gatherings. Fresh, high-quality meals delivered on time in the Bay Area and Silicon Valley.",
  keywords: [
    "food delivery",
    "bakery delivery",
    "catering services",
    "event catering",
    "corporate catering",
    "Bay Area food delivery",
    "Silicon Valley catering",
    "party catering",
    "fresh bakery items",
    "professional food service",
  ],
  authors: [{ name: "Ready Set Team" }],
  category: "Food & Catering Services",
  openGraph: {
    title: "Premium Food & Bakery Delivery Services | Ready Set",
    description:
      "Transform your events with our exceptional food and bakery delivery services. Serving the Bay Area and Silicon Valley with fresh, delicious meals and baked goods.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
    url: "/bakery-deliveries",
    images: [
      {
        url: getCloudinaryUrl("og-food-delivery"),
        width: 1200,
        height: 630,
        alt: "Ready Set food and bakery delivery services showcase",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Premium Food & Bakery Delivery | Ready Set",
    description:
      "Elevate your events with our professional food and bakery delivery services in the Bay Area and Silicon Valley. Fresh quality, on-time delivery guaranteed.",
    images: [getCloudinaryUrl("twitter-food-card")],
    site: "@ReadySetDelivery", // Replace with actual handle
    creator: "@ReadySetDelivery", // Replace with actual handle
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/bakery-deliveries",
  },
  other: {
    "geo.region": "US-CA",
    "geo.placename": "Bay Area, Silicon Valley",
  },
} satisfies Metadata;

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
