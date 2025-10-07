"use client";

import React from "react";
import Image from "next/image";

const PricingLandingPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Yellow Section with Table */}
      <section className="relative bg-[#FFD700] px-8 py-16">
        {/* Decorative White Circles in Corners */}
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-white opacity-90"></div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full bg-white opacity-90"></div>

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-52 w-52 items-center justify-center rounded-full bg-white shadow-xl">
              <Image
                src="/images/logo/logo.png"
                alt="Ready Set Logo"
                width={200}
                height={200}
                className="object-contain p-6"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-8 text-center text-5xl font-black text-black">
            Terms & Pricing Chart
          </h1>

          {/* Pricing Table */}
          <div className="overflow-hidden rounded-lg border-4 border-black shadow-2xl">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-black text-white">
                  <th className="border-r-2 border-white px-8 py-4 text-left text-lg font-bold">
                    Headcount
                  </th>
                  <th className="border-r-2 border-white bg-gray-600 px-8 py-4 text-left text-lg font-bold">
                    Food Cost
                  </th>
                  <th className="px-8 py-4 text-left text-lg font-bold">
                    Delivery Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { headcount: "0-24", foodCost: "<$300", delivery: "$60" },
                  {
                    headcount: "25-49",
                    foodCost: "$300-$599",
                    delivery: "$70",
                  },
                  {
                    headcount: "50-74",
                    foodCost: "$600-$899",
                    delivery: "$90",
                  },
                  {
                    headcount: "75-99",
                    foodCost: "$900-$1199",
                    delivery: "$100",
                  },
                  {
                    headcount: "100-124",
                    foodCost: "$1200-$1499",
                    delivery: "$120",
                  },
                  {
                    headcount: "125-149",
                    foodCost: "$1500-$1699",
                    delivery: "$150",
                  },
                  {
                    headcount: "150-174",
                    foodCost: "$1700-$1899",
                    delivery: "$180",
                  },
                  {
                    headcount: "175-199",
                    foodCost: "$1900-$2099",
                    delivery: "$210",
                  },
                  {
                    headcount: "200-249",
                    foodCost: "$2100-$2299",
                    delivery: "$280",
                  },
                  {
                    headcount: "250-299",
                    foodCost: "$2300-$2499",
                    delivery: "$310",
                  },
                  { headcount: "300+", foodCost: "TBD", delivery: "TBD" },
                ].map((row, index) => (
                  <tr key={index} className="border-t-2 border-gray-300">
                    <td className="border-r-2 border-gray-300 bg-white px-8 py-4 text-base font-semibold text-black">
                      {row.headcount}
                    </td>
                    <td className="border-r-2 border-gray-300 bg-gray-500 px-8 py-4 text-base font-semibold text-white">
                      {row.foodCost}
                    </td>
                    <td className="bg-white px-8 py-4 text-base font-semibold text-black">
                      {row.delivery}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Rate Banner */}
            <div className="bg-black px-8 py-4 text-center">
              <p className="text-lg font-bold text-white">
                Rate within 10 miles
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Gray Section with Terms */}
      <section className="bg-[#3d3d3d] px-8 py-12 text-white">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Headcount vs Food Cost */}
          <div>
            <h2 className="mb-3 text-xl font-bold text-white">
              Headcount vs Food Cost
            </h2>
            <ul className="ml-6 list-disc space-y-2 text-white">
              <li>
                Delivery Cost is based on the lesser, please make sure to update
                your Order Sheet weekly by end of day Friday
              </li>
            </ul>
          </div>

          {/* Mileage Rate */}
          <div>
            <h2 className="mb-3 text-xl font-bold text-white">Mileage Rate</h2>
            <ul className="ml-6 list-disc space-y-2 text-white">
              <li>$3.00 per mile after 10 miles</li>
            </ul>
          </div>

          {/* Daily Drive Discount */}
          <div>
            <h2 className="mb-3 text-xl font-bold text-white">
              Daily Drive Discount - Separate from the Discounted Promo
            </h2>
            <ul className="ml-6 list-disc space-y-2 text-white">
              <li>2 Drives/Day-$5/drive</li>
              <li>3 Drives/Day-$10/drive</li>
              <li>4 Drives/Day-$15/drive</li>
            </ul>
          </div>

          {/* Numbered Terms */}
          <div>
            <ol className="ml-6 list-decimal space-y-3 text-white">
              <li>
                If the drive is batched together with the same driver, we only
                charge tolls/mileage once for total trip.
              </li>
              <li>
                Hosting events requires advanced noticed and is based on
                availability.
              </li>
              <li>
                Default terms are to be paid on a NET 7, this can vary based on
                volume.
              </li>
              <li>
                Late payments are the greater amount of an interest rate of 2.5%
                of the invoice or $25 per month after 30 days.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Contact Footer */}
      <footer className="bg-[#2d2d2d] px-8 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6">
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD700]">
              <svg
                className="h-5 w-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <a
              href="mailto:info@readysetllc.com"
              className="text-sm font-semibold text-white hover:text-[#FFD700]"
            >
              Contact Us: info@readysetllc.com
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD700]">
              <svg
                className="h-5 w-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <a
              href="tel:+14152266872"
              className="text-sm font-semibold text-white hover:text-[#FFD700]"
            >
              Call Us: (415) 226-6872
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD700]">
              <svg
                className="h-5 w-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <a
              href="https://readysetllc.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white hover:text-[#FFD700]"
            >
              Website: Readysetllc.com
            </a>
          </div>
        </div>
      </footer>

      {/* Catering Hosting Pricing Section */}
      <section className="relative bg-black px-8 py-16">
        {/* Decorative Yellow Circles in Corners */}
        <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFD700] opacity-90"></div>
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#FFD700] opacity-90"></div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#FFD700] opacity-90"></div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/2 translate-y-1/2 rounded-full bg-[#FFD700] opacity-90"></div>

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-44 w-44 items-center justify-center rounded-full border-4 border-[#FFD700] bg-white shadow-2xl">
              <Image
                src="/images/logo/logo.png"
                alt="Ready Set Logo"
                width={180}
                height={180}
                className="object-contain p-5"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-12 text-center text-5xl font-black text-[#FFD700]">
            Catering Hosting Pricing
          </h1>

          {/* Pricing Options */}
          <div className="space-y-8">
            {/* Option A */}
            <div className="overflow-hidden rounded-lg shadow-2xl">
              <div className="bg-[#FFD700] px-6 py-4">
                <h2 className="text-center text-2xl font-black text-black">
                  Option A - Starting at $90 + Delivery Fee
                </h2>
              </div>
              <div className="bg-white p-8">
                <h3 className="mb-4 text-center text-xl font-bold text-black">
                  50 Headcount Max (Recommended &lt;35 if serving)
                </h3>
                <div className="space-y-3">
                  <p className="font-bold text-black">
                    - 1 Contractor Delivery + Hosting
                  </p>
                  <ul className="ml-8 space-y-2 text-black">
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Delivery Fee = $45/hr</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Hosting 2 hours minimum</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Full Set Up, Refill, & Clean Up</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Serving +$10/hr</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Option B */}
            <div className="overflow-hidden rounded-lg shadow-2xl">
              <div className="bg-[#FFD700] px-6 py-4">
                <h2 className="text-center text-2xl font-black text-black">
                  Option B - Starting at $190 + Delivery Fee
                </h2>
              </div>
              <div className="bg-white p-8">
                <h3 className="mb-6 text-center text-xl font-bold text-black">
                  100 Headcount Max (Optional 3rd Contractor &gt;80 Headcount)
                </h3>
                <div className="space-y-4">
                  {/* Contractor 1 */}
                  <div>
                    <p className="font-bold text-black">- Contractor 1</p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Pick Up & Set Up</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Refill trays</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Delivery Fee = $45/hr</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contractor 2 */}
                  <div>
                    <p className="font-bold text-black">- Contractor 2</p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>
                          Arrive 15-30 min before to clean and prep area
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Serve proteins</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Clean up duties</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum @$50/hr</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contractor 3 */}
                  <div>
                    <p className="font-bold text-black">
                      - Contractor 3 (Optional)
                    </p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>150 Headcount Max</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>
                          Arrive 15-30 min before to clean and prep area
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Additional Severer</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Clean up duties</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum @$50/hr</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Option C */}
            <div className="overflow-hidden rounded-lg shadow-2xl">
              <div className="bg-[#FFD700] px-6 py-4">
                <h2 className="text-center text-2xl font-black text-black">
                  Option C - Starting at $90 + Delivery Fees (2)
                </h2>
              </div>
              <div className="bg-white p-8">
                <h3 className="mb-6 text-center text-xl font-bold text-black">
                  100 Headcount Max (Optional 3rd Contractor &gt;80 Headcount)
                </h3>
                <div className="space-y-4">
                  {/* Contractor 1 */}
                  <div>
                    <p className="font-bold text-black">- Contractor 1</p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Vendor 1 Pick Up & Set Up</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Serve proteins</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Delivery Fee = $45/hr</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Clean up duties</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contractor 2 */}
                  <div>
                    <p className="font-bold text-black">- Contractor 2</p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Vendor 2 Pick Up & Set Up</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Refill trays</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Clean up duties</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Delivery Fee = $45/hr</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum (optional)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Serving +$10/hr (optional)</span>
                      </li>
                    </ul>
                  </div>

                  {/* Contractor 3 */}
                  <div>
                    <p className="font-bold text-black">
                      - Contractor 3 (Optional)
                    </p>
                    <ul className="ml-8 mt-2 space-y-2 text-black">
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>150 Headcount Max</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Vendor 3 Pick Up & Set Up ( or )</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>
                          Arrive 15-30 min before to clean and prep area
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Refill trays</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Clean up duties</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Delivery Fee = $45/hr</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Hosting 2 hours minimum</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-3 font-bold">•</span>
                        <span>Serving +$10/hr (optional)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Option D */}
            <div className="overflow-hidden rounded-lg shadow-2xl">
              <div className="bg-[#FFD700] px-6 py-4">
                <h2 className="text-center text-2xl font-black text-black">
                  Option D - Hosting Only Starting at $110
                </h2>
              </div>
              <div className="bg-white p-8">
                <h3 className="mb-6 text-center text-xl font-bold text-black">
                  50 Headcount Maximum / Contractor
                </h3>
                <div className="space-y-3">
                  <p className="font-bold text-black">- Contractor 1-3</p>
                  <ul className="ml-8 space-y-2 text-black">
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>
                        Arrive 15-30 min before to clean and prep area
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Serving Food</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Clean up duties</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>Hosting 3 hours minimum @$55/hr</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-3 font-bold">•</span>
                      <span>
                        3+ Contractors is a $5/hr discount per contractor
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 border-t-2 border-gray-200 pt-6">
                  <p className="text-center text-sm italic text-black">
                    *Bar Tenders, Brand Ambassadors, and Event Coordinators are
                    also available per request, Rates vary depending on event.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingLandingPage;
