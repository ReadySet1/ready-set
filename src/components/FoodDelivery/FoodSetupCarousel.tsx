import type { FC } from "react";
import SetupCarousel from "@/components/shared/SetupCarousel";

const FoodSetupCarousel: FC = () => {
  return (
    <SetupCarousel
      imageBasePath="food/foodsetup/foodsetup"
      imageCount={10}
      altPrefix="Food setup"
    />
  );
};

export default FoodSetupCarousel;
