"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";

interface Testimonial {
  name: string;
  quote: string;
  companyLogo: string;
  companyAlt: string;
}

const CateringContact: React.FC = () => {
  const { openForm, DialogForm } = FormManager();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const testimonials: Testimonial[] = [
    {
      name: "Kaleb Bautista",
      quote:
        "I wanted my first project as a model to be with someone I trusted, so I contacted Delora for a portfolio-building shoot. She guided me through everything while respecting my own preferences. I would not trade that experience for anything.",
      companyLogo: "/images/food/partners/catervalley.png",
      companyAlt: "CaterValley",
    },
    {
      name: "Mai Yap",
      quote:
        "We love working with Delora because she captures the brand so well. She shows the voice we want to project through her photos. She's a joy to work with, especially on set.",
      companyLogo: "/images/food/partners/hungry.png",
      companyAlt: "HUNGRY",
    },
    {
      name: "April Ducao",
      quote:
        "Delora helps us bring element in our clothes customers the fluidity the racks. We always a we need a photograph",
      companyLogo: "/images/food/partners/kasa.png",
      companyAlt: "KASA INDIAN EATERY",
    },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log("Form submitted:", formData);
    // You can add API call or form handling logic here
  };

  const handlePartnerClick = () => {
    openForm("food");
  };

  return (
    <div className="w-full bg-white py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Section - Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-6 font-[Montserrat] text-3xl font-black text-gray-800 md:text-4xl">
              Send us a message
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block font-[Montserrat] text-sm font-semibold text-gray-700"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-[Montserrat] text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block font-[Montserrat] text-sm font-semibold text-gray-700"
                >
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-[Montserrat] text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block font-[Montserrat] text-sm font-semibold text-gray-700"
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-[Montserrat] text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="company"
                  className="mb-2 block font-[Montserrat] text-sm font-semibold text-gray-700"
                >
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-[Montserrat] text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-2 block font-[Montserrat] text-sm font-semibold text-gray-700"
                >
                  Leave a message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-[Montserrat] text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  required
                />
              </div>

              <motion.button
                type="submit"
                className="w-full rounded-lg bg-yellow-400 px-8 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Submit
              </motion.button>

              <p className="text-xs text-gray-500">
                Your name won&apos;t be shared. Never submit passwords.
              </p>
            </form>
          </motion.div>

          {/* Right Section - Testimonials */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Testimonial Cards */}
            <div className="mb-8 space-y-6">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  className="rounded-2xl border-4 border-yellow-400 bg-white p-6 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <h3 className="mb-3 font-[Montserrat] text-lg font-black text-gray-800">
                    {testimonial.name}
                  </h3>
                  <p className="mb-4 font-[Montserrat] text-sm leading-relaxed text-gray-700">
                    &quot;{testimonial.quote}&quot;
                  </p>
                  <div className="flex items-center">
                    <div className="relative h-8 w-24">
                      <Image
                        src={testimonial.companyLogo}
                        alt={testimonial.companyAlt}
                        fill
                        className="object-contain"
                        sizes="96px"
                        onError={(e) => {
                          // Hide image if it fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Partnership CTA */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <p className="mb-6 font-[Montserrat] text-base font-medium text-gray-800 md:text-lg">
                Here at Ready Set, we treat your business like an extension of
                our own.
              </p>
              <motion.button
                onClick={handlePartnerClick}
                className="rounded-lg bg-yellow-400 px-8 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Partner With Us
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>
      {/* Render the dialog form */}
      {DialogForm}
    </div>
  );
};

export default CateringContact;

