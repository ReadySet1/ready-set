// src/app/(site)/specialty-delivery/page.tsx

import { Metadata } from "next";
import SpecialtyHero from "@/components/SpecialtyDelivery/SpecialtyHero";
import SpecialtyPartners from "@/components/SpecialtyDelivery/SpecialtyPartners";
import { SpecialtyServiceFeatures } from "@/components/FlowersDelivery/ServiceFeaturesSection";
import SpecialtyTerms from "@/components/SpecialtyDelivery/SpecialtyTerms";

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
