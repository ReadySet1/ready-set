"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
} from "lucide-react";
import { regionalPricing, type RegionKey } from "@/constants/pricing";

const FlowerPricingLandingPage = () => {
  const [activeTab, setActiveTab] = useState<RegionKey>("peninsula-south");

  // Keyboard navigation for tabs (Arrow keys, Home, End)
  const handleKeyDown = (event: React.KeyboardEvent, currentRegion: RegionKey) => {
    const regions = Object.keys(regionalPricing) as RegionKey[];
    const currentIndex = regions.indexOf(currentRegion);

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : regions.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentIndex < regions.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = regions.length - 1;
        break;
      default:
        return;
    }

    const newRegion = regions[newIndex];
    if (newRegion) {
      setActiveTab(newRegion);

      // Focus the newly selected tab
      const tabButton = document.querySelector(`[data-region="${newRegion}"]`) as HTMLButtonElement;
      tabButton?.focus();
    }
  };

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
              Package Delivery Terms & Pricing Chart
            </h1>
            <p className="mx-auto max-w-2xl px-2 text-base text-white/90 sm:text-lg md:text-xl">
              Transparent pricing for flower package delivery services across Bay Area regions
            </p>
          </motion.div>

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex justify-center sm:mt-8 md:mt-12"
          >
            <div
              className="grid w-full max-w-4xl grid-cols-2 gap-1 rounded-lg bg-white p-1 shadow-lg md:grid-cols-4"
              role="tablist"
              aria-label="Select region for pricing information"
            >
              {(Object.keys(regionalPricing) as RegionKey[]).map((region) => (
                <button
                  key={region}
                  role="tab"
                  id={`tab-${region}`}
                  data-region={region}
                  aria-selected={activeTab === region}
                  aria-controls={`tabpanel-${region}`}
                  aria-label={`View ${regionalPricing[region].name} pricing`}
                  tabIndex={activeTab === region ? 0 : -1}
                  onClick={() => setActiveTab(region)}
                  onKeyDown={(e) => handleKeyDown(e, region)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-all sm:px-4 sm:py-2.5 sm:text-base md:px-6 md:py-3 ${
                    activeTab === region
                      ? "bg-black text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {regionalPricing[region].name}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Regional Pricing Table */}
      <section className="px-4 py-8 sm:px-6 sm:py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-center sm:mb-8"
          >
            <h2 className="mb-2 text-2xl font-bold text-gray-900 sm:mb-3 sm:text-3xl md:mb-4 md:text-4xl">
              {regionalPricing[activeTab].name} Pricing
            </h2>
            <p className="px-2 text-sm text-gray-600 sm:text-base md:text-lg">
              Package delivery rates by destination zone
            </p>
          </motion.div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="overflow-hidden rounded-xl bg-white shadow-2xl sm:rounded-2xl"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            aria-label={`Pricing table for ${regionalPricing[activeTab].name}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full" aria-label={`${regionalPricing[activeTab].name} delivery pricing by zone`}>
                <thead>
                  <tr className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white">
                    <th className="border-r border-white/20 px-3 py-3 text-left text-sm font-bold sm:px-4 sm:py-4 md:px-6 md:py-5 md:text-base lg:text-lg">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Area</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-bold sm:px-4 sm:py-4 md:px-6 md:py-5 md:text-base lg:text-lg">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span>Delivery Cost</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regionalPricing[activeTab].data.map((row, index) => (
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
                        {row.area} - {row.zone}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-yellow-600 sm:px-4 sm:py-3 sm:text-sm md:px-6 md:py-4 md:text-base">
                        {row.cost}
                        {row.hasToll && (
                          <span className="ml-2 text-xs font-normal text-amber-600 sm:text-sm">
                            - plus toll
                          </span>
                        )}
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
            <div>
              <ol className="ml-4 list-decimal space-y-2 sm:ml-5 sm:space-y-3 md:ml-6 md:space-y-4">
                <li className="text-sm text-white/90 sm:text-base">
                  Pricing is based on minimum order of 10 packages per route.
                </li>
                <li className="text-sm text-white/90 sm:text-base">
                  If order is less than 10 packages, additional fee will apply based on originating pick-up zone.
                </li>
                <li className="text-sm text-white/90 sm:text-base">
                  Fees are based on delivery zone, packages may have multiple zones in a route.
                </li>
                <li className="text-sm text-white/90 sm:text-base">
                  Toll will be charge regardless of direction of the bridges crossed, only 1 toll charged per route.
                </li>
                <li className="text-sm text-white/90 sm:text-base">
                  Default terms are to be paid on a NET 7, this may vary based on volume and mutual agreement.
                </li>
                <li className="text-sm text-white/90 sm:text-base">
                  Late payments are the greater amount of 2.5% of invoice or $25 per month after 30 days.
                </li>
              </ol>
            </div>
          </motion.div>
        </div>
      </section>

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
              Ready to start delivering? Contact us today!
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

export default FlowerPricingLandingPage;
