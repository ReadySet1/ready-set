import { Metadata } from "next";

import {
  VendorDeliveriesShowcase,
  VendorHero,
  VendorServiceDrivers,
} from "@/components/VendorLanding";
import BakeryTerms from "@/components/BakeryDelivery/BakeryTerms";

export const metadata: Metadata = {
  title: "Vendor Partnership | Ready Set",
  description:
    "Partner with Ready Set for catering logistics that go beyond delivery—from pickup to complete setup for restaurants, caterers, grocers, and foodservice providers.",
};

export default function VendorHeroPage() {
  return (
    <div className="pt-20 md:pt-24">
      <VendorHero id="vendor-hero" />
      <VendorDeliveriesShowcase />
      <VendorServiceDrivers />
      <BakeryTerms variant="vendor" formType="food" />
    </div>
  );
}
