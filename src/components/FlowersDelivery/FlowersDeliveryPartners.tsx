"use client";

import React from "react";
import DeliveryPartners from "@/components/FoodDelivery/DeliveryPartners";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import type { PartnerLogo } from "@/components/FoodDelivery/DeliveryPartners";

const FLOWERS_PARTNERS: PartnerLogo[] = [
  {
    name: "FTD",
    image: getCloudinaryUrl("flowers/partners/ftd"),
    alt: "FTD logo",
    url: "https://www.ftd.com/",
  },
  {
    name: "Bloom Link",
    image: getCloudinaryUrl("flowers/partners/bloomlink"),
    alt: "Bloom Link logo",
    url: "https://www.bloomlink.com/",
  },
  {
    name: "H Bloom",
    image: getCloudinaryUrl("flowers/partners/hbloom"),
    alt: "H Bloom logo",
    url: "https://www.hbloom.com/",
  },
  {
    name: "Dove / Teleflora",
    image: getCloudinaryUrl("flowers/partners/teleflora"),
    alt: "Dove / Teleflora logo",
    url: "https://www.teleflora.com/",
  },
  {
    name: "Lovingly",
    image: getCloudinaryUrl("flowers/partners/lovingly"),
    alt: "Lovingly logo",
    url: "https://www.lovingly.com/",
  },
  {
    name: "Floom",
    image: getCloudinaryUrl("flowers/partners/floom"),
    alt: "Floom logo",
    url: "https://www.floom.com/",
  },
  {
    name: "Bloom Nation",
    image: getCloudinaryUrl("flowers/partners/bloomnation"),
    alt: "Bloom Nation logo",
    url: "https://www.bloomnation.com/",
  },
  {
    name: "Flower Shop Network",
    image: getCloudinaryUrl("flowers/partners/flowershopnetwork"),
    alt: "Flower Shop Network logo",
    url: "https://www.flowershopnetwork.com/",
  },
];

const FlowersDeliveryPartners: React.FC = () => {
  return (
    <DeliveryPartners
      title="Our Floral Delivery Partners"
      subtitle="We're proud to collaborate with some of the top names in the floral industry:"
      partners={FLOWERS_PARTNERS}
      ctaLabel="Partner With Us"
    />
  );
};

export default FlowersDeliveryPartners;
