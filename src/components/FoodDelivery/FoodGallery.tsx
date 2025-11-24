"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const FoodGallery: React.FC = () => {
  // Food images - user will add images later
  const foodImages = [
    {
      src: "/images/food/gallery/food-1.jpg",
      alt: "Catering food containers",
    },
    {
      src: "/images/food/gallery/food-2.jpg",
      alt: "Individual meal containers",
    },
    {
      src: "/images/food/gallery/food-3.jpg",
      alt: "Prepared meals in containers",
    },
    {
      src: "/images/food/gallery/food-4.jpg",
      alt: "Pasta and rice dishes",
    },
    {
      src: "/images/food/gallery/food-5.jpg",
      alt: "Salads and main courses",
    },
    {
      src: "/images/food/gallery/food-6.jpg",
      alt: "Catering containers on counter",
    },
    {
      src: "/images/food/gallery/food-7.jpg",
      alt: "Food containers with beverages",
    },
    {
      src: "/images/food/gallery/food-8.jpg",
      alt: "Stacked food containers",
    },
    {
      src: "/images/food/gallery/food-9.jpg",
      alt: "Close-up of meal containers",
    },
    {
      src: "/images/food/gallery/food-10.jpg",
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

