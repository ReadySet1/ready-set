"use client";

import Image from "next/image";
import ScheduleDialog from "../Logistics/Schedule";
import { FormType } from "../Logistics/QuoteRequest/types";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import { getCloudinaryUrl } from "@/lib/cloudinary";

interface BakeryTermsProps {
  onRequestQuote?: (formType: FormType) => void;
  variant?: "bakery" | "vendor";
  formType?: FormType;
}

const BakeryTerms = ({
  onRequestQuote,
  variant = "bakery",
  formType = "bakery",
}: BakeryTermsProps) => {
  const { openForm, DialogForm } = FormManager();

  const handleQuoteClick = () => {
    onRequestQuote?.(formType);
    openForm(formType ?? "bakery");
  };

  const renderBakeryContent = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-8 pt-16 md:py-8">
      {/* Dark container */}
      <div className="mb-3 w-full max-w-4xl rounded-2xl bg-gray-900 p-4 text-center md:mb-6 md:p-10">
        <h2 className="mb-3 text-xl font-bold text-white md:mb-6 md:text-5xl">
          Package Delivery Terms <br /> & Pricing Chart
        </h2>
        <div className="flex flex-row items-center justify-center gap-6 md:gap-8">
          <button
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-gray-900 shadow-lg transition-all duration-200 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 md:px-6 md:py-3 md:text-lg"
            onClick={handleQuoteClick}
          >
            Get a Quote
          </button>
          <ScheduleDialog
            buttonText="Book a Call"
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-gray-900 shadow-lg transition-all duration-200 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 md:px-6 md:py-3 md:text-lg"
            calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
          />
        </div>
      </div>

      {/* White container - with responsive layout (1 column on mobile, 2 columns on desktop) */}
      <div className="w-full max-w-4xl rounded-xl bg-white p-4 text-left shadow-lg md:p-8">
        <ul className="list-disc space-y-4 pl-5">
          <li className="text-sm leading-snug md:text-base md:leading-normal">
            Pricing is based on a Maximum order of 10 packages per route.
          </li>
          <li className="text-sm leading-snug md:text-base md:leading-normal">
            Fees are based on the delivery zone; packages may have multiple
            zones in a route.
          </li>
          <li className="text-sm leading-snug md:text-base md:leading-normal">
            Toll will be charged regardless of the direction of the bridges
            crossed. Only 1 toll charged per route.
          </li>
          <li className="text-sm leading-snug md:text-base md:leading-normal">
            The default terms are to be paid on a net 7; this may vary based on
            volume and mutual agreement.
          </li>
          <li className="text-sm leading-snug md:text-base md:leading-normal">
            Late payments are the greater of 3.5% of the invoice or $25 per
            month after 30 days.
          </li>
        </ul>
      </div>
    </div>
  );

  const renderVendorContent = () => (
    <div className="absolute inset-0 flex items-center justify-center px-4 pb-32 pt-24 sm:pb-40 sm:pt-32">
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <div className="w-full rounded-2xl border-[10px] border-gray-300 bg-[#f3f3f3] p-4 shadow-2xl sm:p-6 lg:p-8">
          <div className="rounded-xl bg-white px-6 py-6 shadow-md sm:px-10 sm:py-8 lg:px-14">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                Package Delivery Terms
                <br />& Pricing Chart
              </h2>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-6 md:gap-8">
                <button
                  className="rounded-lg bg-yellow-400 px-6 py-3 text-base font-extrabold text-gray-900 shadow-md transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2"
                  onClick={handleQuoteClick}
                >
                  Get a Quote
                </button>
                <ScheduleDialog
                  buttonText="Book a Call"
                  className="rounded-lg bg-yellow-400 px-6 py-3 text-base font-extrabold text-gray-900 shadow-md transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2"
                  calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
                />
              </div>
            </div>

            <div className="mt-10 grid gap-10 text-gray-900 md:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold sm:text-lg">
                    Headcount vs Food Cost
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
                    <li>
                      Delivery cost is based on the lesser, please make sure to
                      update your order sheet weekly by end of day Friday.
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-extrabold sm:text-lg">
                    Mileage Rate
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
                    <li>$3.00 per mile after 10 miles</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-extrabold sm:text-lg">
                    Daily Drive Discount
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed sm:text-base">
                    <li>2 Drives/Day-$5/drive</li>
                    <li>3 Drives/Day-$10/drive</li>
                    <li>4 Drives/Day-$15/drive</li>
                  </ul>
                </div>
              </div>

              <div>
                <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed sm:text-base">
                  <li>
                    If the drive is batched together with the same driver, we
                    only charge tolls/mileage once for the total trip.
                  </li>
                  <li>
                    Hosting events requires advanced notice and is based on
                    availability.
                  </li>
                  <li>
                    Default terms are to be paid on a NET 7; this can vary based
                    on volume.
                  </li>
                  <li>
                    Late payments are the greater amount to an interest rate of
                    2.5% of the invoice or $25 per month after 30 days.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl">
          <ScheduleDialog
            buttonText="Hosting Services? Let's Talk"
            className="block w-full rounded-lg bg-yellow-400 px-6 py-2.5 text-center text-base font-bold text-gray-900 shadow-md transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 sm:text-lg"
            calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <div className="relative">
        <Image
          src={getCloudinaryUrl("food/food-dishes")}
          alt="Food dishes"
          width={1200}
          height={800}
          className="h-[800px] w-full object-cover"
          priority
        />
        {variant === "vendor" ? renderVendorContent() : renderBakeryContent()}
      </div>
      {DialogForm}
    </div>
  );
};

export default BakeryTerms;
