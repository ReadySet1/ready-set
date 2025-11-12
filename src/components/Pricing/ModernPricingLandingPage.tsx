"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Check,
  Info,
  Phone,
  Mail,
  Globe,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";

interface PricingTier {
  headcount: string;
  foodCost: string;
  delivery: string;
}

interface HostingOption {
  title: string;
  subtitle: string;
  price: string;
  features: string[];
  maxHeadcount: string;
  popular?: boolean;
  includesDelivery?: boolean;
}

const ModernPricingLandingPage = () => {
  const [activeTab, setActiveTab] = useState<"delivery" | "hosting">(
    "delivery",
  );

  const pricingTiers: PricingTier[] = [
    { headcount: "0-24", foodCost: "<$300", delivery: "$60" },
    { headcount: "25-49", foodCost: "$300-$599", delivery: "$70" },
    { headcount: "50-74", foodCost: "$600-$899", delivery: "$90" },
    { headcount: "75-99", foodCost: "$900-$1199", delivery: "$100" },
    { headcount: "100-124", foodCost: "$1200-$1499", delivery: "$120" },
    { headcount: "125-149", foodCost: "$1500-$1699", delivery: "$150" },
    { headcount: "150-174", foodCost: "$1700-$1899", delivery: "$180" },
    { headcount: "175-199", foodCost: "$1900-$2099", delivery: "$210" },
    { headcount: "200-249", foodCost: "$2100-$2299", delivery: "$280" },
    { headcount: "250-299", foodCost: "$2300-$2499", delivery: "$310" },
    { headcount: "300+", foodCost: "TBD", delivery: "TBD" },
  ];

  const hostingOptions: HostingOption[] = [
    {
      title: "Option A",
      subtitle: "Delivery + Basic Hosting",
      price: "$90",
      maxHeadcount: "50 Max (Rec. <35 if serving)",
      includesDelivery: true,
      features: [
        "1 Contractor Delivery + Hosting",
        "Delivery Fee = $45/hr",
        "2 hours minimum hosting",
        "Full Set Up, Refill, & Clean Up",
        "Serving +$10/hr (optional)",
      ],
    },
    {
      title: "Option B",
      subtitle: "Premium Full Service",
      price: "$190",
      maxHeadcount: "100 Max",
      popular: true,
      includesDelivery: true,
      features: [
        "2 Contractors (3rd optional >80 headcount)",
        "Pick Up & Professional Set Up",
        "Protein Serving & Refills",
        "Complete Clean Up Service",
        "2 hours minimum per contractor",
        "Contractor 1: $45/hr | Contractor 2: $50/hr",
      ],
    },
    {
      title: "Option C",
      subtitle: "Multi-Vendor Service",
      price: "$90",
      maxHeadcount: "100 Max",
      includesDelivery: true,
      features: [
        "2 Contractors + 2 Delivery Fees",
        "Multiple Vendor Pick Up & Set Up",
        "Protein Serving & Tray Refills",
        "Clean Up Duties",
        "Hosting 2 hours minimum",
        "3rd Contractor optional (150 max headcount)",
      ],
    },
    {
      title: "Option D",
      subtitle: "Hosting Only",
      price: "$110",
      maxHeadcount: "50 Max per Contractor",
      includesDelivery: false,
      features: [
        "1-3 Contractors Available",
        "Arrive 15-30 min early for prep",
        "Professional Food Serving",
        "Complete Clean Up Duties",
        "3 hours minimum @$55/hr",
        "3+ Contractors: $5/hr discount each",
      ],
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-yellow-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24 md:px-12 md:pb-20 md:pt-32">
        {/* Decorative Circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/20 blur-3xl"></div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex justify-center sm:mb-8 md:mb-12"
          >
            <div className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-105 sm:h-32 sm:w-32 md:h-40 md:w-40">
              <Image
                src="/images/logo/logo.png"
                alt="Ready Set Logo"
                width={150}
                height={150}
                className="object-contain p-3 sm:p-4"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center"
          >
            <h1 className="mb-3 text-3xl font-black text-white sm:mb-4 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
              Pricing That Works For You
            </h1>
            <p className="mx-auto max-w-2xl px-2 text-base text-white/90 sm:text-lg md:text-xl">
              Transparent, competitive pricing for premium catering delivery and
              hosting services
            </p>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex justify-center sm:mt-8 md:mt-12"
          >
            <div className="inline-flex w-full max-w-md rounded-lg bg-white p-1 shadow-lg sm:w-auto">
              <button
                onClick={() => setActiveTab("delivery")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-4 sm:py-2.5 sm:text-base md:px-6 md:py-3 ${
                  activeTab === "delivery"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="hidden sm:inline">Delivery Pricing</span>
                <span className="sm:hidden">Delivery</span>
              </button>
              <button
                onClick={() => setActiveTab("hosting")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-all sm:flex-none sm:px-4 sm:py-2.5 sm:text-base md:px-6 md:py-3 ${
                  activeTab === "hosting"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="hidden sm:inline">Hosting Services</span>
                <span className="sm:hidden">Hosting</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Delivery Pricing Table */}
      {activeTab === "delivery" && (
        <section className="px-4 py-8 sm:px-6 sm:py-12 md:px-12 md:py-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 text-center sm:mb-8"
            >
              <h2 className="mb-2 text-2xl font-bold text-gray-900 sm:mb-3 sm:text-3xl md:mb-4 md:text-4xl">
                Delivery Rate Chart
              </h2>
              <p className="px-2 text-sm text-gray-600 sm:text-base md:text-lg">
                Rate within 10 miles | $3.00 per mile after 10 miles
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="overflow-hidden rounded-xl bg-white shadow-2xl sm:rounded-2xl"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white">
                      <th className="border-r border-white/20 px-3 py-3 text-left text-sm font-bold sm:px-4 sm:py-4 md:px-6 md:py-5 md:text-base lg:text-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="hidden sm:inline">Headcount</span>
                          <span className="sm:hidden">Head</span>
                        </div>
                      </th>
                      <th className="border-r border-white/20 px-3 py-3 text-left text-sm font-bold sm:px-4 sm:py-4 md:px-6 md:py-5 md:text-base lg:text-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="hidden sm:inline">Food Cost</span>
                          <span className="sm:hidden">Food</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-bold sm:px-4 sm:py-4 md:px-6 md:py-5 md:text-base lg:text-lg">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="hidden sm:inline">
                            Delivery Cost
                          </span>
                          <span className="sm:hidden">Delivery</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingTiers.map((row, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        className={`border-t transition-colors hover:bg-yellow-50 ${
                          index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <td className="border-r border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-900 sm:px-4 sm:py-3 sm:text-sm md:px-6 md:py-4 md:text-base">
                          {row.headcount}
                        </td>
                        <td className="border-r border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-700 sm:px-4 sm:py-3 sm:text-sm md:px-6 md:py-4 md:text-base">
                          {row.foodCost}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold text-yellow-600 sm:px-4 sm:py-3 sm:text-sm md:px-6 md:py-4 md:text-base">
                          {row.delivery}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Terms and Conditions Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 p-4 text-white shadow-2xl sm:mt-8 sm:rounded-2xl sm:p-6 md:mt-12 md:p-8 lg:p-12"
            >
              {/* Headcount vs Food Cost */}
              <div className="mb-4 border-b border-white/20 pb-4 sm:mb-6 sm:pb-6 md:mb-8 md:pb-8">
                <h3 className="mb-2 text-lg font-bold text-white sm:mb-3 sm:text-xl md:mb-4 md:text-2xl">
                  Headcount vs Food Cost
                </h3>
                <ul className="ml-4 list-disc space-y-1 sm:ml-5 sm:space-y-1.5 md:ml-6 md:space-y-2">
                  <li className="text-sm text-white/90 sm:text-base">
                    Delivery Cost is based on the lesser, please make sure to
                    update your Order Sheet weekly by end of day Friday
                  </li>
                </ul>
              </div>

              {/* Mileage Rate */}
              <div className="mb-4 border-b border-white/20 pb-4 sm:mb-6 sm:pb-6 md:mb-8 md:pb-8">
                <h3 className="mb-2 text-lg font-bold text-white sm:mb-3 sm:text-xl md:mb-4 md:text-2xl">
                  Mileage Rate
                </h3>
                <ul className="ml-4 list-disc space-y-1 sm:ml-5 sm:space-y-1.5 md:ml-6 md:space-y-2">
                  <li className="text-sm text-white/90 sm:text-base">
                    $3.00 per mile after 10 miles
                  </li>
                </ul>
              </div>

              {/* Daily Drive Discount */}
              <div className="mb-4 border-b border-white/20 pb-4 sm:mb-6 sm:pb-6 md:mb-8 md:pb-8">
                <h3 className="mb-2 text-lg font-bold text-white sm:mb-3 sm:text-xl md:mb-4 md:text-2xl">
                  Daily Drive Discount - Separate from the Discounted Promo
                </h3>
                <ul className="ml-4 list-disc space-y-1 sm:ml-5 sm:space-y-1.5 md:ml-6 md:space-y-2">
                  <li className="text-sm text-white/90 sm:text-base">
                    2 Drives/Day-$5/drive
                  </li>
                  <li className="text-sm text-white/90 sm:text-base">
                    3 Drives/Day-$10/drive
                  </li>
                  <li className="text-sm text-white/90 sm:text-base">
                    4 Drives/Day-$15/drive
                  </li>
                </ul>
              </div>

              {/* Numbered Terms */}
              <div>
                <ol className="ml-4 list-decimal space-y-2 sm:ml-5 sm:space-y-3 md:ml-6 md:space-y-4">
                  <li className="text-sm text-white/90 sm:text-base">
                    If the drive is batched together with the same driver, we
                    only charge tolls/mileage once for total trip.
                  </li>
                  <li className="text-sm text-white/90 sm:text-base">
                    Hosting events requires advanced noticed and is based on
                    availability.
                  </li>
                  <li className="text-sm text-white/90 sm:text-base">
                    Default terms are to be paid on a NET 7, this can vary based
                    on volume.
                  </li>
                  <li className="text-sm text-white/90 sm:text-base">
                    Late payments are the greater amount of an interest rate of
                    2.5% of invoice or $25 per month after 30 days.
                  </li>
                </ol>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Hosting Services */}
      {activeTab === "hosting" && (
        <section className="px-4 py-8 sm:px-6 sm:py-12 md:px-12 md:py-16">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 text-center sm:mb-8 md:mb-12"
            >
              <h2 className="mb-2 text-2xl font-bold text-gray-900 sm:mb-3 sm:text-3xl md:mb-4 md:text-4xl">
                Catering Hosting Services
              </h2>
              <p className="text-sm text-gray-600 sm:text-base md:text-lg">
                Professional hosting services with experienced contractors
              </p>
            </motion.div>

            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
              {hostingOptions.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`relative overflow-hidden rounded-xl bg-white shadow-xl transition-transform hover:scale-105 sm:rounded-2xl ${
                    option.popular ? "ring-2 ring-yellow-400 sm:ring-4" : ""
                  }`}
                >
                  {option.popular && (
                    <div className="absolute left-0 right-0 top-0 bg-gradient-to-r from-yellow-400 to-amber-500 py-1.5 text-center text-xs font-bold text-white sm:py-2 sm:text-sm">
                      MOST POPULAR
                    </div>
                  )}
                  <div
                    className={`p-4 sm:p-5 md:p-6 ${option.popular ? "pt-10 sm:pt-12 md:pt-14" : ""} bg-gradient-to-br from-gray-50 to-white`}
                  >
                    <h3 className="mb-1.5 text-xl font-black text-gray-900 sm:mb-2 sm:text-2xl">
                      {option.title}
                    </h3>
                    <p className="mb-3 text-xs font-medium text-gray-600 sm:mb-4 sm:text-sm">
                      {option.subtitle}
                    </p>
                    <div className="mb-3 flex items-baseline gap-1 sm:mb-4">
                      <span className="text-3xl font-black text-yellow-600 sm:text-4xl">
                        {option.price}
                      </span>
                      {/* Only show delivery fee for options that include delivery service */}
                      {option.includesDelivery && (
                        <span className="text-xs text-gray-500 sm:text-sm">
                          + Delivery Fee
                        </span>
                      )}
                    </div>
                    <div className="mb-4 rounded-lg bg-yellow-50 px-2.5 py-1.5 text-center sm:mb-5 sm:px-3 sm:py-2 md:mb-6">
                      <p className="text-xs font-semibold text-gray-700 sm:text-sm">
                        {option.maxHeadcount}
                      </p>
                    </div>
                    <ul className="space-y-2 sm:space-y-2.5 md:space-y-3">
                      {option.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-start gap-1.5 text-xs sm:gap-2 sm:text-sm"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 sm:h-5 sm:w-5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Additional Services Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-6 rounded-xl bg-white p-4 text-center shadow-lg sm:mt-8 sm:p-6 md:mt-12 md:p-8"
            >
              <Info className="mx-auto mb-2 h-8 w-8 text-yellow-500 sm:mb-3 sm:h-10 sm:w-10 md:mb-4 md:h-12 md:w-12" />
              <h3 className="mb-2 text-base font-bold text-black sm:mb-2.5 sm:text-lg md:mb-3 md:text-xl">
                Additional Services Available
              </h3>
              <p className="text-xs text-black sm:text-sm md:text-base">
                <strong>
                  Bartenders, Brand Ambassadors, and Event Coordinators
                </strong>{" "}
                are available upon request. Rates vary depending on the event
                requirements. Contact us for a custom quote.
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Contact Footer */}
      <footer className="bg-gradient-to-br from-gray-900 via-black to-gray-900 px-4 py-8 text-white sm:px-6 sm:py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-center sm:mb-8 md:mb-12"
          >
            <h2 className="mb-2 text-xl font-bold sm:mb-3 sm:text-2xl md:mb-4 md:text-3xl">
              Get In Touch
            </h2>
            <p className="text-sm text-gray-300 sm:text-base md:text-lg">
              Ready to elevate your next event? Contact us today!
            </p>
          </motion.div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
            <motion.a
              href="mailto:info@readysetllc.com"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl sm:gap-4 sm:p-5 md:p-6"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
                <Mail className="h-5 w-5 text-black sm:h-6 sm:w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300 sm:text-sm">
                  Email Us
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  info@readysetllc.com
                </p>
              </div>
            </motion.a>

            <motion.a
              href="tel:+14152266872"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="group flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl sm:gap-4 sm:p-5 md:p-6"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
                <Phone className="h-5 w-5 text-black sm:h-6 sm:w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300 sm:text-sm">
                  Call Us
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  (415) 226-6872
                </p>
              </div>
            </motion.a>

            <motion.a
              href="https://readysetllc.com"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="group flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl sm:gap-4 sm:p-5 md:p-6"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110 sm:h-14 sm:w-14">
                <Globe className="h-5 w-5 text-black sm:h-6 sm:w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300 sm:text-sm">
                  Visit Website
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  readysetllc.com
                </p>
              </div>
            </motion.a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModernPricingLandingPage;
