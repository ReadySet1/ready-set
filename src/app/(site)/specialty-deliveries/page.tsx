// src/app/(site)/specialty-delivery/page.tsx

import { Metadata } from "next";
import SpecialtyHero from "@/components/SpecialtyDelivery/SpecialtyHero";
import SpecialtyPartners from "@/components/SpecialtyDelivery/SpecialtyPartners";
import SpecialtyIcons from "@/components/SpecialtyDelivery/SpecialtyIcons";
import SpecialtyTerms from "@/components/SpecialtyDelivery/SpecialtyTerms";

// export const metadata: Metadata = {
//   title: "Premium Food & Bakery Delivery Services | Ready Set",
//   description:
//     "Professional food and bakery delivery services for events, parties, and corporate gatherings. Fresh, high-quality meals delivered on time in the Bay Area and Silicon Valley.",
//   keywords: [
//     "food delivery",
//     "bakery delivery",
//     "catering services",
//     "event catering",
//     "corporate catering",
//     "Bay Area food delivery",
//     "Silicon Valley catering",
//     "party catering",
//     "fresh bakery items",
//     "professional food service",
//   ],
//   authors: [{ name: "Ready Set Team" }],
//   category: "Food & Catering Services",
//   openGraph: {
//     title: "Premium Food & Bakery Delivery Services | Ready Set",
//     description:
//       "Transform your events with our exceptional food and bakery delivery services. Serving the Bay Area and Silicon Valley with fresh, delicious meals and baked goods.",
//     type: "website",
//     locale: "en_US",
//     siteName: "Ready Set",
//     url: "/food",
//     images: [
//       {
//         url: "/images/og-food-delivery.jpg", // Add your actual image path
//         width: 1200,
//         height: 630,
//         alt: "Ready Set food and bakery delivery services showcase",
//         type: "image/jpeg",
//       },
//     ],
//   },
//   twitter: {
//     card: "summary_large_image",
//     title: "Premium Food & Bakery Delivery | Ready Set",
//     description:
//       "Elevate your events with our professional food and bakery delivery services in the Bay Area and Silicon Valley. Fresh quality, on-time delivery guaranteed.",
//     images: ["/images/twitter-food-card.jpg"], // Add your actual image path
//     site: "@ReadySetDelivery", // Replace with actual handle
//     creator: "@ReadySetDelivery", // Replace with actual handle
//   },
//   robots: {
//     index: true,
//     follow: true,
//     nocache: false,
//     googleBot: {
//       index: true,
//       follow: true,
//       noimageindex: false,
//       "max-video-preview": -1,
//       "max-image-preview": "large",
//       "max-snippet": -1,
//     },
//   },
//   alternates: {
//     canonical: "/food",
//   },
//   other: {
//     "geo.region": "US-CA",
//     "geo.placename": "Bay Area, Silicon Valley",
//   },
// } satisfies Metadata;

export default function SpecialtyPage(): React.ReactElement {
  return (
    <div className="pt-20 md:pt-24">
      <SpecialtyHero />
      <SpecialtyPartners />
      <SpecialtyIcons />
      <SpecialtyTerms />
      {/* <DownloadableResources /> */}
    </div>
  );
}
