import { Metadata } from "next";

import {
  VendorDeliveriesShowcase,
  VendorHero,
  VendorServiceDrivers,
} from "@/components/VendorLanding";
import BakeryTerms from "@/components/BakeryDelivery/BakeryTerms";
import VendorOnboarding from "@/components/VendorLanding/VendorOnboarding";
import VendorDeliveryFlow from "@/components/VendorLanding/VendorDeliveryFlow";
import VendorServiceArea from "@/components/VendorLanding/VendorServiceArea";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Reliable Catering Delivery Services",
  description:
    "Catering logistics partner for restaurants, caterers, and grocers — pickup to setup. SF Bay Area and beyond. Request a quote today.", // DRAFT — review copy
  keywords: [
    "catering logistics partner",
    "restaurant delivery service",
    "vendor delivery",
    "food setup service",
  ],
  openGraph: {
    title: "Reliable Catering Delivery Services | Ready Set",
    description:
      "Catering logistics partner for restaurants, caterers, and grocers — pickup to setup. SF Bay Area and beyond. Request a quote today.",
    type: "website",
    locale: "en_US",
    siteName: "Ready Set",
    images: [
      {
        url: getCloudinaryUrl("og-image"),
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reliable Catering Delivery Services | Ready Set",
    description:
      "Catering logistics partner for restaurants, caterers, and grocers — pickup to setup. SF Bay Area and beyond. Request a quote today.",
    images: [getCloudinaryUrl("og-image")],
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
    canonical: "/vendor-hero",
  },
};

export default function VendorHeroPage() {
  return (
    <div className="pt-20 md:pt-24">
      <VendorHero id="vendor-hero" />
      <VendorDeliveriesShowcase />
      <VendorServiceDrivers />
      <BakeryTerms variant="vendor" formType="food" />
      <VendorOnboarding />
      <VendorDeliveryFlow />
      <VendorServiceArea />
    </div>
  );
}
