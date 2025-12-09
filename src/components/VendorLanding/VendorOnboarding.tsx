import Image from "next/image";

import { getCloudinaryUrl } from "@/lib/cloudinary";

interface VendorOnboardingProps {
  /**
   * Optional override for the featured image. Defaults to a generic operations photo.
   */
  imageSrc?: string;
  imageAlt?: string;
}

const timelineSteps: Array<{ title: string; description: string }> = [
  {
    title: "Book a Consult",
    description:
      "Discuss your delivery needs and see how our service fits your operation.",
  },
  {
    title: "Get Onboarded",
    description: "Sign the Vendor Agreement and receive your onboarding guide.",
  },
  {
    title: "Create Your Account",
    description:
      "Set up your account to access your delivery dashboard; our Helpdesk will help you get everything set up.",
  },
  {
    title: "Start Sending Orders",
    description:
      "Begin placing catering delivery orders with reliable, professional drivers.",
  },
];

const defaultImage = getCloudinaryUrl("bakery/bakerybg2");

const VendorOnboarding = ({
  imageSrc = defaultImage,
  imageAlt = "Vendor delivering catered food",
}: VendorOnboardingProps) => {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 rounded-2xl bg-gray-50 p-6 shadow-xl sm:p-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <div className="relative h-[260px] overflow-hidden rounded-2xl sm:h-[320px]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
              priority
            />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Order Setup &amp; Scheduling
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-700 sm:mt-6 sm:text-base">
              <li>
                Orders should be submitted at least one week in advance to
                ensure driver availability and optimal service quality.
              </li>
              <li>
                Late submissions may be accepted with a minimum of 24
                hours&apos; notice.
              </li>
              <li>
                We accept same-day delivery requests; however, we cannot
                guarantee driver availability.
              </li>
              <li>
                Backup drivers may be available, but are not guaranteed for
                short-notice requests.
              </li>
              <li>
                Orders may be submitted via your website dashboard, Slack, text,
                or any preferred communication method — we recommend the website
                for seamless operations.
              </li>
              <li>
                Our support team will confirm each order and verify all delivery
                details.
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#58a2c2]">
                How to Get Started
              </p>
              <p className="mt-2 text-sm text-gray-700 sm:text-base">
                We make setup simple so you can focus on your catering
                operations.
              </p>
            </div>

            <ol className="relative mt-2 space-y-8">
              <span
                aria-hidden
                className="absolute left-[17px] top-4 h-[calc(100%-20px)] w-[2px] bg-gray-300 sm:left-6"
              />
              {timelineSteps.map((step, index) => (
                <li key={step.title} className="relative flex gap-4 sm:gap-6">
                  <span
                    aria-hidden
                    className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-700 bg-white text-sm font-bold text-gray-900 sm:h-6 sm:w-6"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-lg font-extrabold text-gray-900 sm:text-xl">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-gray-700 sm:text-base">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div>
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-yellow-400 px-6 py-3 text-center text-base font-extrabold text-gray-900 shadow-md transition hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500 sm:text-lg"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VendorOnboarding;
