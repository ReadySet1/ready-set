"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const FoodGallery: React.FC = () => {
  const foodImages = [
    {
      src: getCloudinaryUrl("food/gallery/food-1"),
      alt: "Catering food containers",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-2"),
      alt: "Individual meal containers",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-3"),
      alt: "Prepared meals in containers",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-4"),
      alt: "Pasta and rice dishes",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-5"),
      alt: "Salads and main courses",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-6"),
      alt: "Catering containers on counter",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-7"),
      alt: "Food containers with beverages",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-8"),
      alt: "Stacked food containers",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-9"),
      alt: "Close-up of meal containers",
    },
    {
      src: getCloudinaryUrl("food/gallery/food-10"),
      alt: "Variety of prepared meals",
    },
  ];

  return (
    <div className="w-full bg-yellow-400 py-12 md:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-6 lg:gap-8">
          {foodImages.map((image, index) => (
            <motion.div
              key={index}
              className="relative aspect-square overflow-hidden rounded-2xl"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
              }}
              whileHover={{ scale: 1.05 }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FoodGallery;

