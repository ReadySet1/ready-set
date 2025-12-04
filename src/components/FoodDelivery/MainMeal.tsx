"use client";

import Image from "next/image";
import React from "react";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const MainMeal: React.FC = () => {
  return (
    <div className="relative min-h-[500px] w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={getCloudinaryUrl("food/fooddeliverybg1")}
          alt="Fondo de Comida"
          fill
          style={{ objectFit: "cover" }}
          className="saturate-125 opacity-90"
        />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 py-6 pt-16 md:px-6 md:pt-24">
        {/* Main image positioned lower */}
        <div className="mx-auto mt-12 max-w-full md:mt-16">
          <Image
            src={getCloudinaryUrl("food/mainmeal")}
            alt="Buffet de Comida"
            width={1000}
            height={500}
            style={{
              maxWidth: "100%",
              height: "auto",
              display: "block",
              margin: "0 auto",
            }}
            className="rounded-md"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default MainMeal;
