// app/components/DeliveryOptions.tsx
import Image from "next/image";

interface DeliveryOptionCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

const DeliveryOptionCard: React.FC<DeliveryOptionCardProps> = ({
  title,
  description,
  imageSrc,
  imageAlt,
}) => {
  return (
    <div className="transform overflow-hidden rounded-lg bg-white shadow-md transition duration-300 hover:scale-105">
      <div className="relative h-48 w-full">
        <Image
          src={imageSrc}
          alt={imageAlt}
          layout="fill"
          objectFit="cover"
          className="rounded-t-lg"
        />
      </div>
      <div className="p-6">
        <h3 className="mb-3 text-2xl font-semibold text-gray-800">{title}</h3>
        <p className="mb-6 text-base text-gray-600">{description}</p>
        <div className="flex space-x-4">
          <a
            href="#"
            className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-gray-800 transition duration-300 ease-in-out hover:bg-yellow-500"
          >
            Get a Quote
          </a>
          <a
            href="#"
            className="rounded-lg bg-yellow-300 px-6 py-3 font-bold text-gray-800 transition duration-300 ease-in-out hover:bg-yellow-400"
          >
            Learn More
          </a>
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
}

const DeliveryOptions: React.FC = () => {
  const deliveryData: DeliveryItem[] = [
    {
      title: "Catering Deliveries",
      description:
        "We deliver meals for daily team lunches, corporate events, and special occasions.",
      imageSrc: "/images/catering-deliveries.jpg",
      imageAlt: "Catering food display",
    },
    {
      title: "Flower Deliveries",
      description:
        "We partner with local flower shops to help deliver joy and connection to communities.",
      imageSrc: "/images/flower-deliveries.jpg",
      imageAlt: "Bouquet of colorful flowers",
    },
    {
      title: "Bakery Deliveries",
      description:
        "We're not just about catering; we now deliver for local bakeries too.",
      imageSrc: "/images/bakery-deliveries.jpg",
      imageAlt: "Assortment of fresh baked goods",
    },
    {
      title: "Specialty Deliveries",
      description:
        "We offer Specialty Delivery for urgent, high-value items such as legal documents, medications, and custom orders.",
      imageSrc: "/images/specialty-deliveries.jpg",
      imageAlt: "Stack of neatly wrapped brown packages",
    },
  ];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {deliveryData.map((item, index) => (
            <DeliveryOptionCard
              key={index}
              title={item.title}
              description={item.description}
              imageSrc={item.imageSrc}
              imageAlt={item.imageAlt}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default DeliveryOptions;
