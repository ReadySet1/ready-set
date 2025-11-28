"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { FormManager } from "@/components/Logistics/QuoteRequest/Quotes/FormManager";
import sendEmail from "@/app/actions/email";
import { loadRecaptchaScript, executeRecaptcha } from "@/lib/recaptcha";

interface Testimonial {
  name: string;
  quote: string;
  companyLogo: string;
  companyAlt: string;
}

interface MessageState {
  type: "success" | "error";
  text: string;
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
  const [message, setMessage] = useState<MessageState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaLoadError, setRecaptchaLoadError] = useState<boolean>(false);
  const [recaptchaLoadAttempts, setRecaptchaLoadAttempts] = useState<number>(0);

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

  // Load reCAPTCHA script on component mount with retry logic
  useEffect(() => {
    const loadWithRetry = async (attempt: number = 1) => {
      try {
        await loadRecaptchaScript();
        setRecaptchaLoadError(false);
      } catch (error) {
        setRecaptchaLoadAttempts(attempt);

        // Retry up to 3 times with exponential backoff
        if (attempt < 3) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 5s

          setTimeout(() => {
            loadWithRetry(attempt + 1);
          }, retryDelay);
        } else {
          // All retries failed
          setRecaptchaLoadError(true);
        }
      }
    };

    loadWithRetry();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.name ||
      !formData.email ||
      !formData.phone ||
      !formData.company ||
      !formData.message
    ) {
      setMessage({
        type: "error",
        text: "Please fill in all required fields.",
      });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Execute reCAPTCHA before submitting (if configured)
      const recaptchaToken = await executeRecaptcha(
        "catering_contact_form_submit",
      );

      // Combine company into message if provided
      const fullMessage = formData.company
        ? `Company: ${formData.company}\n\nMessage:\n${formData.message}`
        : formData.message;

      // Prepare form data for email action
      const emailData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: fullMessage,
        recaptchaToken: recaptchaToken || undefined,
      };

      await sendEmail(emailData);

      setMessage({
        type: "success",
        text: "Thank you! Your message has been sent successfully. We'll get back to you soon.",
      });

      // Reset form after successful submission
      setTimeout(() => {
        setMessage(null);
        setFormData({
          name: "",
          email: "",
          phone: "",
          company: "",
          message: "",
        });
      }, 5000); // Increased timeout to give user more time to see success message
    } catch (error: unknown) {
      let errorMessage =
        "We're sorry, there was an error sending your message.";

      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }

      setMessage({
        type: "error",
        text: errorMessage,
      });

      setTimeout(() => {
        setMessage(null);
      }, 8000); // Increased timeout to give user more time to read error
    } finally {
      setIsLoading(false);
    }
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

            {/* reCAPTCHA loading warning */}
            {recaptchaLoadError && (
              <div
                className="mb-6 rounded-md border border-yellow-400 bg-yellow-50 p-4"
                role="alert"
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-600"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Enhanced spam protection unavailable
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Our advanced spam protection could not be loaded. Your
                        message will still be sent, but may experience slightly
                        longer processing time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

              <motion.div
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-yellow-400 px-8 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="mr-2 h-5 w-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </button>
              </motion.div>

              {/* Success/Error Message - appears right below Submit button */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-4 rounded-lg border-2 p-5 shadow-lg ${
                    message.type === "success"
                      ? "border-green-300 bg-green-50 text-green-800"
                      : "border-red-300 bg-red-50 text-red-800"
                  }`}
                  role="alert"
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {message.type === "success" ? (
                        <svg
                          className="h-6 w-6 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-6 w-6 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <h3
                        className={`text-base font-semibold ${
                          message.type === "success"
                            ? "text-green-800"
                            : "text-red-800"
                        }`}
                      >
                        {message.type === "success"
                          ? "Message Sent Successfully!"
                          : "Error Sending Message"}
                      </h3>
                      <p
                        className={`mt-1 text-sm ${
                          message.type === "success"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {message.text}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <p className="text-xs text-gray-500">
                Your name won&apos;t be shared. Never submit passwords.
              </p>
            </form>
          </motion.div>

          {/* Right Section - Centered Partnership CTA */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Testimonial Cards - Commented out as requested */}
            {/* <div className="mb-8 space-y-6">
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
            </div> */}

            {/* Partnership CTA - Centered on right side */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {/* Ready Set Logo */}
              <div className="mb-8 flex justify-center">
                <div className="relative h-32 w-64">
                  <Image
                    src="/images/logo/logo.png"
                    alt="Ready Set"
                    fill
                    className="object-contain"
                    sizes="256px"
                    onError={(e) => {
                      // Hide image if it fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                </div>
              </div>

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
