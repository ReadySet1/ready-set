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
      <section className="relative overflow-hidden bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 px-6 pb-20 pt-32 md:px-12">
        {/* Decorative Circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/20 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/20 blur-3xl"></div>

        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12 flex justify-center"
          >
            <div className="group relative flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-105 md:h-40 md:w-40">
              <Image
                src="/images/logo/logo.png"
                alt="Ready Set Logo"
                width={150}
                height={150}
                className="object-contain p-4"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center"
          >
            <h1 className="mb-4 text-5xl font-black text-white md:text-6xl lg:text-7xl">
              Pricing That Works For You
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/90 md:text-xl">
              Transparent, competitive pricing for premium catering delivery and
              hosting services
            </p>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 flex justify-center"
          >
            <div className="inline-flex rounded-lg bg-white p-1 shadow-lg">
              <button
                onClick={() => setActiveTab("delivery")}
                className={`rounded-md px-6 py-3 font-semibold transition-all ${
                  activeTab === "delivery"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Delivery Pricing
              </button>
              <button
                onClick={() => setActiveTab("hosting")}
                className={`rounded-md px-6 py-3 font-semibold transition-all ${
                  activeTab === "hosting"
                    ? "bg-black text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Hosting Services
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Delivery Pricing Table */}
      {activeTab === "delivery" && (
        <section className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Delivery Rate Chart
              </h2>
              <p className="text-lg text-gray-600">
                Rate within 10 miles | $3.00 per mile after 10 miles
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white">
                      <th className="border-r border-white/20 px-6 py-5 text-left text-lg font-bold">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Headcount
                        </div>
                      </th>
                      <th className="border-r border-white/20 px-6 py-5 text-left text-lg font-bold">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Food Cost
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-lg font-bold">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Delivery Cost
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
                        <td className="border-r border-gray-200 px-6 py-4 font-semibold text-gray-900">
                          {row.headcount}
                        </td>
                        <td className="border-r border-gray-200 px-6 py-4 font-semibold text-gray-700">
                          {row.foodCost}
                        </td>
                        <td className="px-6 py-4 font-bold text-yellow-600">
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
              className="mt-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-8 text-white shadow-2xl md:p-12"
            >
              {/* Headcount vs Food Cost */}
              <div className="mb-8 border-b border-white/20 pb-8">
                <h3 className="mb-4 text-2xl font-bold text-white">
                  Headcount vs Food Cost
                </h3>
                <ul className="ml-6 list-disc space-y-2">
                  <li className="text-white/90">
                    Delivery Cost is based on the lesser, please make sure to
                    update your Order Sheet weekly by end of day Friday
                  </li>
                </ul>
              </div>

              {/* Mileage Rate */}
              <div className="mb-8 border-b border-white/20 pb-8">
                <h3 className="mb-4 text-2xl font-bold text-white">
                  Mileage Rate
                </h3>
                <ul className="ml-6 list-disc space-y-2">
                  <li className="text-white/90">
                    $3.00 per mile after 10 miles
                  </li>
                </ul>
              </div>

              {/* Daily Drive Discount */}
              <div className="mb-8 border-b border-white/20 pb-8">
                <h3 className="mb-4 text-2xl font-bold text-white">
                  Daily Drive Discount - Separate from the Discounted Promo
                </h3>
                <ul className="ml-6 list-disc space-y-2">
                  <li className="text-white/90">2 Drives/Day-$5/drive</li>
                  <li className="text-white/90">3 Drives/Day-$10/drive</li>
                  <li className="text-white/90">4 Drives/Day-$15/drive</li>
                </ul>
              </div>

              {/* Numbered Terms */}
              <div>
                <ol className="ml-6 list-decimal space-y-4">
                  <li className="text-white/90">
                    If the drive is batched together with the same driver, we
                    only charge tolls/mileage once for total trip.
                  </li>
                  <li className="text-white/90">
                    Hosting events requires advanced noticed and is based on
                    availability.
                  </li>
                  <li className="text-white/90">
                    Default terms are to be paid on a NET 7, this can vary based
                    on volume.
                  </li>
                  <li className="text-white/90">
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
        <section className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Catering Hosting Services
              </h2>
              <p className="text-lg text-gray-600">
                Professional hosting services with experienced contractors
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {hostingOptions.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`relative overflow-hidden rounded-2xl bg-white shadow-xl transition-transform hover:scale-105 ${
                    option.popular ? "ring-4 ring-yellow-400" : ""
                  }`}
                >
                  {option.popular && (
                    <div className="absolute left-0 right-0 top-0 bg-gradient-to-r from-yellow-400 to-amber-500 py-2 text-center text-sm font-bold text-white">
                      MOST POPULAR
                    </div>
                  )}
                  <div
                    className={`p-6 ${option.popular ? "pt-14" : ""} bg-gradient-to-br from-gray-50 to-white`}
                  >
                    <h3 className="mb-2 text-2xl font-black text-gray-900">
                      {option.title}
                    </h3>
                    <p className="mb-4 text-sm font-medium text-gray-600">
                      {option.subtitle}
                    </p>
                    <div className="mb-4 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-yellow-600">
                        {option.price}
                      </span>
                      <span className="text-sm text-gray-500">
                        + Delivery Fee
                      </span>
                    </div>
                    <div className="mb-6 rounded-lg bg-yellow-50 px-3 py-2 text-center">
                      <p className="text-sm font-semibold text-gray-700">
                        {option.maxHeadcount}
                      </p>
                    </div>
                    <ul className="space-y-3">
                      {option.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
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
              className="mt-12 rounded-xl bg-white p-8 text-center shadow-lg"
            >
              <Info className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
              <h3 className="mb-3 text-xl font-bold text-black">
                Additional Services Available
              </h3>
              <p className="text-black">
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
      <footer className="bg-gradient-to-br from-gray-900 via-black to-gray-900 px-6 py-16 text-white md:px-12">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold">Get In Touch</h2>
            <p className="text-lg text-gray-300">
              Ready to elevate your next event? Contact us today!
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            <motion.a
              href="mailto:info@readysetllc.com"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group flex items-center gap-4 rounded-xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110">
                <Mail className="h-7 w-7 text-black" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Email Us</p>
                <p className="font-semibold">info@readysetllc.com</p>
              </div>
            </motion.a>

            <motion.a
              href="tel:+14152266872"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="group flex items-center gap-4 rounded-xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110">
                <Phone className="h-7 w-7 text-black" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Call Us</p>
                <p className="font-semibold">(415) 226-6872</p>
              </div>
            </motion.a>

            <motion.a
              href="https://readysetllc.com"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="group flex items-center gap-4 rounded-xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/20 hover:shadow-xl"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 transition-transform group-hover:scale-110">
                <Globe className="h-7 w-7 text-black" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Visit Website
                </p>
                <p className="font-semibold">readysetllc.com</p>
              </div>
            </motion.a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModernPricingLandingPage;
