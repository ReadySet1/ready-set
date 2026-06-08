// src/app/(site)/specialty-delivery/page.tsx

import { Metadata } from "next";
import SpecialtyHero from "@/components/SpecialtyDelivery/SpecialtyHero";
import SpecialtyPartners from "@/components/SpecialtyDelivery/SpecialtyPartners";
import { SpecialtyServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import SpecialtyTerms from "@/components/SpecialtyDelivery/SpecialtyTerms";
import { getCloudinaryUrl } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Specialty Delivery Services for Businesses",
  description:
    "Specialty and white-glove delivery for sensitive, high-value items. SF Bay Area, Austin, Dallas. Request a quote today.", // DRAFT — review copy
  keywords: [
    "specialty delivery",
    "white-glove delivery",
    "high-value item delivery",
    "Bay Area courier",
  ],
  openGraph: {
    title: "Specialty Delivery Services for Businesses | Ready Set",
    description:
      "Specialty and white-glove delivery for sensitive, high-value items. SF Bay Area, Austin, Dallas. Request a quote today.",
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
    title: "Specialty Delivery Services for Businesses | Ready Set",
    description:
      "Specialty and white-glove delivery for sensitive, high-value items. SF Bay Area, Austin, Dallas. Request a quote today.",
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
    canonical: "/specialty-deliveries",
  },
};

export default function SpecialtyPage(): React.ReactElement {
  return (
    <div className="pt-20 md:pt-24">
      <SpecialtyHero />
      <SpecialtyPartners />
      <SpecialtyServiceFeatures />
      <SpecialtyTerms />
      {/* <DownloadableResources /> */}
    </div>
  );
}
