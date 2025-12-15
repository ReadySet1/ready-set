import Image from "next/image";

import { getCloudinaryUrl } from "@/lib/cloudinary";
import ScheduleDialog from "@/components/Logistics/Schedule";

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

const defaultImage = getCloudinaryUrl("food/food-delivery");

const VendorOnboarding = ({
  imageSrc = defaultImage,
  imageAlt = "Vendor delivering catered food",
}: VendorOnboardingProps) => {
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:px-8">
        <div className="rounded-2xl bg-gray-300 p-5 sm:p-6 md:p-8 lg:order-2">
          <div className="flex flex-col gap-5 sm:gap-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                How to Get Started
              </h2>
              <p className="mt-2 text-sm text-gray-700 sm:text-base">
                We make setup simple so you can focus on your catering
                operations.
              </p>
            </div>

            <ol className="relative mt-1 space-y-6 sm:mt-2 sm:space-y-8">
              <span
                aria-hidden
                className="absolute left-[9px] top-4 h-[calc(100%-24px)] w-[2px] bg-gray-400 sm:left-[11px]"
              />
              {timelineSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex gap-3 sm:gap-4 md:gap-6"
                >
                  <span
                    aria-hidden
                    className="relative z-10 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-700 bg-white text-xs font-bold text-gray-900 sm:h-6 sm:w-6 sm:text-sm"
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 space-y-1 pb-1">
                    <h3 className="text-base font-extrabold leading-tight text-gray-900 sm:text-lg md:text-xl">
                      {step.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-gray-700 sm:text-sm md:text-base">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-2 flex justify-center">
              <ScheduleDialog
                buttonText="Get Started"
                dialogTitle="Schedule Your Consultation"
                dialogDescription="Choose a convenient time to discuss your catering delivery needs."
                calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                customButton={
                  <button className="rounded-lg bg-yellow-400 px-6 py-2.5 text-center text-sm font-extrabold text-gray-900 shadow-md transition hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500 sm:px-8 sm:text-base">
                    Get Started
                  </button>
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 sm:space-y-6 lg:order-1 lg:-ml-8">
          <div className="relative h-[220px] sm:h-[260px] md:h-[320px]">
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
            <h2 className="text-xl font-extrabold text-gray-900 sm:text-2xl md:text-3xl">
              Order Setup &amp; Scheduling
            </h2>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-gray-700 sm:mt-4 sm:space-y-3 sm:text-sm md:mt-6 md:text-base">
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
      </div>
    </section>
  );
};

export default VendorOnboarding;
