"use client";

import React from "react";
import Image from "next/image";

const PricingLandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-black py-6 text-center">
        <div className="mx-auto max-w-7xl px-4">
          <Image
            src="/images/logo/logo.svg"
            alt="Ready Set Logo"
            width={180}
            height={60}
            className="mx-auto"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-black md:text-5xl">
            Package Delivery Terms & Pricing
          </h1>
          <p className="text-xl text-gray-700">
            Professional catering delivery services for your business
          </p>
        </div>

        {/* Terms & Pricing Section */}
        <div className="mb-16 rounded-xl bg-gray-50 p-8 shadow-lg">
          <h2 className="mb-8 border-b-4 border-[#FFD700] pb-3 text-3xl font-bold text-black">
            Terms & Pricing Chart
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-xl font-bold text-black">
                  Headcount vs Food Cost
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-gray-700">
                  <li>
                    Delivery cost is based on the lesser, please make sure to
                    update your order sheet weekly by end of day Friday.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-xl font-bold text-black">
                  Mileage Rate
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-gray-700">
                  <li>$3.00 per mile after 10 miles</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-xl font-bold text-black">
                  Daily Drive Discount
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-gray-700">
                  <li>2 Drives/Day - $5/drive</li>
                  <li>3 Drives/Day - $10/drive</li>
                  <li>4+ Drives/Day - $15/drive</li>
                </ul>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <h3 className="mb-3 text-xl font-bold text-black">
                Additional Terms
              </h3>
              <ol className="list-decimal space-y-3 pl-5 text-gray-700">
                <li>
                  If the drive is batched together with the same driver, we only
                  charge tolls/mileage once for the total trip.
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

          {/* Pricing Table */}
          <div className="mt-10">
            <h3 className="mb-6 text-2xl font-bold text-black">
              Headcount Pricing Tiers
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg bg-white shadow-md">
                <thead>
                  <tr className="bg-[#FFD700]">
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-black">
                      Headcount Range
                    </th>
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-black">
                      Food Cost Range
                    </th>
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-black">
                      Price with Tip
                    </th>
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-black">
                      Price without Tip
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-6 py-3">
                      1-24 people
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $0 - $299.99
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $35.00
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $42.50
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-6 py-3">
                      25-49 people
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $300 - $599.99
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $45.00
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $52.50
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-6 py-3">
                      50-74 people
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $600 - $899.99
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $55.00
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $62.50
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-6 py-3">
                      75-99 people
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $900 - $1,199.99
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $65.00
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $72.50
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-6 py-3">
                      100+ people
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      $1,200+
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      9% of food cost
                    </td>
                    <td className="border border-gray-300 px-6 py-3">
                      10% of food cost
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Catering Hosting Options */}
        <div className="mb-16 rounded-xl bg-gray-50 p-8 shadow-lg">
          <h2 className="mb-8 border-b-4 border-[#FFD700] pb-3 text-3xl font-bold text-black">
            Catering Hosting Options
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Option A */}
            <div className="rounded-lg border-2 border-[#FFD700] bg-white p-6 shadow-md">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD700] text-2xl font-bold text-black">
                  A
                </div>
                <h3 className="text-xl font-bold text-black">
                  Basic Delivery
                </h3>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Arrive 5 minutes early</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Confirm item list with restaurant</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Deliver within timeframe</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Send confirmations</span>
                </li>
              </ul>
            </div>

            {/* Option B */}
            <div className="rounded-lg border-2 border-[#FFD700] bg-white p-6 shadow-md">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD700] text-2xl font-bold text-black">
                  B
                </div>
                <h3 className="text-xl font-bold text-black">
                  Setup Service
                </h3>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Everything in Option A</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Sanitize setup area</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Wash hands & wear gloves</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Professional food setup</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Photo/video for caterer</span>
                </li>
              </ul>
            </div>

            {/* Option C */}
            <div className="rounded-lg border-2 border-[#FFD700] bg-white p-6 shadow-md">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD700] text-2xl font-bold text-black">
                  C
                </div>
                <h3 className="text-xl font-bold text-black">
                  Hosting Service
                </h3>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Everything in Option B</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Refill trays during event</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Monitor food presentation</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Maintain cleanliness</span>
                </li>
              </ul>
            </div>

            {/* Option D */}
            <div className="rounded-lg border-2 border-[#FFD700] bg-white p-6 shadow-md">
              <div className="mb-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD700] text-2xl font-bold text-black">
                  D
                </div>
                <h3 className="text-xl font-bold text-black">
                  Full Service
                </h3>
              </div>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Everything in Option C</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Complete cleanup duties</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Remove all materials</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#FFD700]">•</span>
                  <span>Final area sanitization</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Food Safety Note */}
          <div className="mt-8 rounded-lg bg-white p-6 shadow-md">
            <p className="text-center text-gray-700">
              <span className="font-semibold">Food Safety Certified:</span> All
              Ready Set drivers hold California Food Handler Certificates and
              adhere to strict food safety protocols. We treat your business
              like an extension of our own, with professional dress code,
              disposable gloves, and proper food handling equipment.
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="rounded-xl bg-black p-8 text-center text-white shadow-lg">
          <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mb-6 text-lg">
            Contact us today to discuss your catering delivery needs
          </p>
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <a
              href="mailto:info@readysetllc.com"
              className="rounded-lg bg-[#FFD700] px-8 py-3 font-bold text-black transition-all duration-200 hover:bg-yellow-400"
            >
              Email Us
            </a>
            <a
              href="tel:+1234567890"
              className="rounded-lg border-2 border-[#FFD700] bg-transparent px-8 py-3 font-bold text-[#FFD700] transition-all duration-200 hover:bg-[#FFD700] hover:text-black"
            >
              Call Us
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 py-6 text-center text-gray-600">
        <p className="text-sm">
          © {new Date().getFullYear()} Ready Set LLC. All rights reserved.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          This page is unlisted and intended for authorized viewers only.
        </p>
      </footer>
    </div>
  );
};

export default PricingLandingPage;
