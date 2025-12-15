"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { getCloudinaryUrl } from "@/lib/cloudinary";
import ScheduleDialog from "@/components/Logistics/Schedule";

const DEFAULT_PARTNER_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true";

export interface VendorHeroProps {
  id?: string;
  heading?: string;
  highlight?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imagePublicId?: string;
  imageAlt?: string;
}

const VendorHero = ({
  id,
  heading = "Your Catering Deserves",
  highlight = "More Than Just Delivery",
  description = `Our service goes beyond food delivery as we provide solutions for restaurants, caterers, grocers, and foodservice providers from pickup all the way to complete setup.`,
  ctaLabel = "Partner With Us",
  ctaHref = DEFAULT_PARTNER_URL,
  imagePublicId = "food/catering-about-2",
  imageAlt = "Restaurant owners reviewing catering orders together",
}: VendorHeroProps) => {
  const heroImageSrc = getCloudinaryUrl(imagePublicId, { quality: 85 });

  return (
    <section
      id={id}
      className="w-full bg-white py-14 sm:py-16 lg:py-24"
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        {/* Image Column */}
        <div className="relative w-full lg:w-1/2">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={heroImageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* Content Column */}
        <div className="w-full max-w-xl space-y-6 text-center lg:w-1/2 lg:text-left">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-yellow-600">
              Catering Logistics Partner
            </p>
            <h1
              className="font-[Montserrat] text-3xl font-black leading-tight text-gray-900 sm:text-4xl lg:text-5xl"
              id={id ? `${id}-heading` : undefined}
            >
              <span className="block">{heading}</span>
              <span className="block text-gray-900">{highlight}</span>
            </h1>
          </div>

          <p className="font-[Montserrat] text-base leading-relaxed text-gray-700 sm:text-lg">
            {description}
          </p>

          <div className="flex justify-center lg:justify-start">
            <ScheduleDialog
              buttonText={ctaLabel}
              dialogTitle="Partner With Ready Set"
              dialogDescription="Schedule a consultation to discuss how we can support your catering logistics needs."
              calendarUrl={ctaHref}
              customButton={
                <Button
                  className="h-auto rounded-full bg-yellow-400 px-8 py-3 font-[Montserrat] text-base font-extrabold text-gray-900 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-500 hover:shadow-lg focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
                  aria-label={`${ctaLabel} with Ready Set`}
                >
                  {ctaLabel}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VendorHero;
