import Image from "next/image";

import { getCloudinaryUrl } from "@/lib/cloudinary";

type Testimonial = {
  companyName: string;
  quote: string;
  author: string;
};

const testimonials: Testimonial[] = [
  {
    companyName: "CaterValley",
    quote:
      "I wanted my first project as a model to be with someone I trusted, so I contacted Delora for a portfolio-building shoot. She guided me through everything while respecting my own preferences. I would not trade that experience for anything.",
    author: "Kaleb Bautista",
  },
  {
    companyName: "CaterValley",
    quote:
      "Ready Set helped us deliver a consistent client experience. Communication stayed clear from pickup to setup, and the team handled every detail with care.",
    author: "Jamie Nguyen",
  },
  {
    companyName: "CaterValley",
    quote:
      "Professional, punctual, and thoughtful. Our clients noticed the difference immediately, and we felt confident in every delivery.",
    author: "Taylor Brooks",
  },
];

const caterValleyLogo = getCloudinaryUrl("food/partners/catervalley");

const VendorTestimonial = () => {
  const activeIndex = 0;
  const activeTestimonial = testimonials[activeIndex] ?? testimonials[0];

  if (!activeTestimonial) {
    return null;
  }

  return (
    <section
      aria-labelledby="vendor-testimonial-heading"
      className="bg-white px-4 py-16 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-10 flex items-center justify-center">
          <Image
            src={caterValleyLogo}
            alt="CaterValley logo"
            width={170}
            height={54}
            className="h-14 w-auto object-contain"
            priority
          />
          <span className="sr-only">CaterValley</span>
        </div>

        <div className="space-y-4">
          <p
            id="vendor-testimonial-heading"
            className="text-lg font-medium leading-relaxed text-gray-900 sm:text-xl"
          >
            &quot;{activeTestimonial.quote}&quot;
          </p>
          <p className="text-lg font-semibold text-gray-900 sm:text-xl">
            {activeTestimonial.author}
          </p>
        </div>

        <div
          className="mt-6 flex items-center gap-3"
          role="list"
          aria-label="Testimonial indicators"
        >
          {testimonials.map((testimonial, index) => {
            const isActive = index === activeIndex;
            return (
              <span
                key={`${testimonial.author}-${index}`}
                role="listitem"
                aria-current={isActive}
                aria-label={`Testimonial ${index + 1} of ${testimonials.length}`}
                className={`h-3 w-3 rounded-full ${
                  isActive ? "bg-gray-900" : "bg-gray-300"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default VendorTestimonial;
