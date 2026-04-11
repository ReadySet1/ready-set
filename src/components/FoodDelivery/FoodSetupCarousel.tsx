import SetupCarousel from "@/components/shared/SetupCarousel";

const FoodSetupCarousel: React.FC = () => {
  return (
    <SetupCarousel
      imageBasePath="food/foodsetup/foodsetup"
      imageCount={10}
      altPrefix="Food setup"
    />
  );
};

export default FoodSetupCarousel;
