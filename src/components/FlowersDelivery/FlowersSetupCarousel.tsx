import SetupCarousel from "@/components/shared/SetupCarousel";

const FlowersSetupCarousel: React.FC = () => {
  return (
    <SetupCarousel
      imageBasePath="flowers/flowersetup/flowersetup"
      imageCount={10}
      altPrefix="Flower arrangement"
    />
  );
};

export default FlowersSetupCarousel;
