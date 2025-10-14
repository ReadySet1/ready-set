// app/components/DeliveryOptions.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormManager,
  FormType,
} from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

interface DeliveryOptionCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  formType: FormType;
  learnMoreRoute: string;
  onGetQuoteClick: (formType: FormType) => void;
  onLearnMoreClick: (route: string) => void;
}

const DeliveryOptionCard: React.FC<DeliveryOptionCardProps> = ({
  title,
  description,
  imageSrc,
  imageAlt,
  formType,
  learnMoreRoute,
  onGetQuoteClick,
  onLearnMoreClick,
}) => {
  const handleQuoteClick = () => {
        onGetQuoteClick(formType);
  };

  const handleLearnMoreClick = () => {
        onLearnMoreClick(learnMoreRoute);
  };

  return (
    <div className="transform overflow-hidden rounded-lg bg-white shadow-md transition duration-300 hover:scale-105">
      <h3 className="p-6 pb-3 text-center text-2xl font-semibold text-gray-800">
        {title}
      </h3>

      <div className="relative mx-4 mb-4 overflow-hidden rounded-lg">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={500}
          height={300}
          className="h-auto w-full rounded-lg object-cover"
          style={{
            aspectRatio: "5/3",
            objectFit: "cover",
          }}
          priority={false}
        />
      </div>

      <div className="p-6 pt-0">
        <p className="mb-6 text-base text-gray-600">{description}</p>

        <div className="flex items-center justify-center space-x-4">
          <button
            type="button"
            className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-gray-800 transition duration-300 ease-in-out hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
            onClick={handleQuoteClick}
          >
            Get a Quote
          </button>

          <button
            type="button"
            className="rounded-lg bg-yellow-300 px-6 py-3 font-bold text-gray-800 transition duration-300 ease-in-out hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
            onClick={handleLearnMoreClick}
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeliveryItem {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  formType: FormType;
  learnMoreRoute: string;
}

const DeliveryOptions: React.FC = () => {
  const router = useRouter();
  const { openForm, DialogForm } = FormManager();

  const deliveryData: DeliveryItem[] = [
    {
      title: "Catering Deliveries",
      description:
        "We deliver meals for daily team lunches, corporate events, and special occasions.",
      imageSrc: "/images/logistics/deliveries/cateringdeliveries.png",
      imageAlt: "Catering food display with various dishes and trays",
      formType: "food",
      learnMoreRoute: "/catering-deliveries",
    },
    {
      title: "Flower Deliveries",
      description:
        "We partner with local flower shops to help deliver joy and connection to communities.",
      imageSrc: "/images/logistics/deliveries/flowerdeliveries.png",
      imageAlt: "Bouquet of colorful tulips and flowers",
      formType: "flower",
      learnMoreRoute: "/flowers-deliveries",
    },
    {
      title: "Bakery Deliveries",
      description:
        "We're not just about catering; we now deliver for local bakeries too.",
      imageSrc: "/images/logistics/deliveries/bakerydeliveries.png",
      imageAlt: "Assortment of fresh baked breads and pastries",
      formType: "bakery",
      learnMoreRoute: "/bakery-deliveries",
    },
    {
      title: "Specialty Deliveries",
      description:
        "We offer Specialty Delivery for urgent, high-value items such as legal documents, medications, and custom orders.",
      imageSrc: "/images/logistics/deliveries/specialtydeliveries.png",
      imageAlt: "Stack of neatly wrapped brown delivery packages",
      formType: "specialty",
      learnMoreRoute: "/specialty-deliveries",
    },
  ];

  // Centralized handler for opening forms
  const handleGetQuoteClick = (formType: FormType) => {
        openForm(formType);
  };

  // Handler for Learn More navigation
  const handleLearnMoreClick = (route: string) => {
        router.push(route);
  };

  return (
    <section id="food-services" className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black leading-tight tracking-wider text-yellow-400">
            OUR SERVICES
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-600">
            With Ready Set, you can trust your delivery needs are handled with
            precision and professionalism. Let's keep your business moving,
            fresh, fast, and on time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10">
          {deliveryData.map((item, index) => (
            <DeliveryOptionCard
              key={`delivery-${index}-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              title={item.title}
              description={item.description}
              imageSrc={item.imageSrc}
              imageAlt={item.imageAlt}
              formType={item.formType}
              learnMoreRoute={item.learnMoreRoute}
              onGetQuoteClick={handleGetQuoteClick}
              onLearnMoreClick={handleLearnMoreClick}
            />
          ))}
        </div>
      </div>

      {DialogForm}
    </section>
  );
};

export default DeliveryOptions;
