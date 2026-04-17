import type { FC } from "react";
import SetupCarousel from "@/components/shared/SetupCarousel";

const FlowersSetupCarousel: FC = () => {
  return (
    <SetupCarousel
      imageBasePath="flowers/flowersetup/flowersetup"
      imageCount={6}
      altPrefix="Flower arrangement"
    />
  );
};

export default FlowersSetupCarousel;
