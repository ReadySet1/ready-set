"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  id: string;
  question: string;
  answer: string | React.ReactNode;
}

interface FAQSectionProps {
  className?: string;
}

const FAQSection: React.FC<FAQSectionProps> = ({ className = "" }) => {
  const [openModal, setOpenModal] = useState<
    null | "flowerMap" | "flowerService" | "driversRequirements"
  >(null);

  // Use Set for better performance with expandable items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const mileagePricing: FAQItem[] = [
    {
      id: "miles-included",
      question: "How many miles are included in the standard delivery fee?",
      answer: "Each delivery includes up to 10 miles at no additional cost.",
    },
    {
      id: "exceeds-miles",
      question: "What happens if the delivery exceeds 10 miles?",
      answer:
        "For any distance beyond 10 miles, a charge of $3.00 per additional mile will apply.",
    },
    {
      id: "max-mileage",
      question: "What is the maximum mileage covered under the base rate?",
      answer:
        "You're allowed 10 miles per arrangement, which is aggregated across orders. For example, 10 orders allow for a combined total of 100 miles. After that, the $3.00 per extra mile fee kicks in.",
    },
  ];

  const orderDeliveryDetails: FAQItem[] = [
    {
      id: "pickup-times",
      question: "What are the available pickup times for deliveries?",
      answer:
        "Our standard pickup windows are 8:00-9:00 AM for morning pickups and 2:00-3:00 PM for afternoon pickups. However, we're happy to accommodate custom pickup times upon request.",
    },
    {
      id: "transport-safety",
      question: "How are the orders transported to ensure safety and quality?",
      answer:
        "Orders are transported in secure containers that hold 4-6 arrangements, keeping them stable and well-organized during delivery.",
    },
    {
      id: "delivery-speed",
      question: "How fast is the delivery process?",
      answer:
        "Our drivers begin deliveries immediately after pickup and typically deliver 6-10 orders per hour, depending on route density and traffic.",
    },
  ];

  const orderCapacityPricing: FAQItem[] = [
    {
      id: "order-limit",
      question: "Is there a limit to how many orders can be delivered at once?",
      answer:
        "There's no maximum order limit, but generally up to 30 orders can fit in one van.",
    },
    {
      id: "pricing-changes",
      question: "Will the pricing change for larger orders?",
      answer: (
        <>
          Each delivery location is charged a flat rate, but larger or more
          complex orders may incur additional fees.
          <div className="mt-2">
            <ul className="list-disc pl-5">
              <li>
                Sprays and wreaths are charged at twice the standard delivery
                fee due to their size and handling requirements.
              </li>
            </ul>
          </div>
        </>
      ),
    },
  ];

  const deliveryErrors: FAQItem[] = [
    {
      id: "wrong-address",
      question: "What happens if a driver delivers to the wrong address?",
      answer:
        "If the mistake is on our end, we'll correct it at no extra cost. If the delivery needs to be changed due to late updates or redirection, a new delivery fee will apply.",
    },
  ];

  const billingSubscription: FAQItem[] = [
    {
      id: "subscription-fee",
      question: "Is there a subscription or membership fee?",
      answer:
        "No, we don't offer memberships or subscriptions. We invoice weekly or on the 1st and 15th of each month, depending on delivery volume. Clients with over $1,000/week in volume are invoiced bi-monthly (1st and 15th).",
    },
  ];

  // Combine all FAQ items into a single array
  const allFaqItems = [
    ...mileagePricing,
    ...orderDeliveryDetails,
    ...orderCapacityPricing,
    ...deliveryErrors,
    ...billingSubscription,
  ];

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.2,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    },
  };

  const answerVariants: Variants = {
    hidden: {
      opacity: 0,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    visible: {
      opacity: 1,
      height: "auto",
      paddingTop: 24,
      paddingBottom: 24,
      transition: {
        height: {
          duration: 0.4,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
        opacity: {
          duration: 0.3,
          delay: 0.1,
        },
        paddingTop: {
          duration: 0.4,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
        paddingBottom: {
          duration: 0.4,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
      },
    },
    exit: {
      opacity: 0,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      transition: {
        height: {
          duration: 0.3,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
        opacity: {
          duration: 0.2,
        },
        paddingTop: {
          duration: 0.3,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
        paddingBottom: {
          duration: 0.3,
          ease: [0.04, 0.62, 0.23, 0.98],
        },
      },
    },
  };

  const iconVariants: Variants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180 },
  };

  return (
    <div className={`bg-gray-50 py-16 ${className}`}>
      <div className="mx-auto max-w-4xl px-4">
        <motion.h1
          className="mb-12 text-center text-4xl font-bold text-black"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          FAQ: Frequently Asked Questions
          <motion.div
            className="mx-auto mt-4 h-1 w-24 bg-black"
            initial={{ width: 0 }}
            animate={{ width: 96 }}
            transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          />
        </motion.h1>

        <motion.div
          className="mx-auto max-w-3xl space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {allFaqItems.map((item) => {
            const isExpanded = expandedItems.has(item.id);

            return (
              <motion.div
                key={item.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                variants={itemVariants}
                whileHover={{
                  shadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  transition: { duration: 0.2 },
                }}
              >
                <motion.button
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center justify-between bg-white px-6 py-6 text-left transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
                  whileTap={{ scale: 0.99 }}
                  aria-expanded={isExpanded}
                  aria-controls={`answer-${item.id}`}
                  type="button"
                >
                  <motion.p
                    className="pr-4 text-lg font-medium leading-relaxed text-black"
                    initial={{ opacity: 0.95 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {item.question}
                  </motion.p>
                  <motion.div
                    variants={iconVariants}
                    animate={isExpanded ? "expanded" : "collapsed"}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-shrink-0"
                    aria-hidden="true"
                  >
                    <ChevronDown className="h-5 w-5 text-black" />
                  </motion.div>
                </motion.button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={answerVariants}
                      className="overflow-hidden border-t border-gray-200 bg-gray-50"
                      id={`answer-${item.id}`}
                      role="region"
                      aria-labelledby={`question-${item.id}`}
                    >
                      <motion.div
                        className="px-6"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            delay: 0.15,
                            duration: 0.3,
                            ease: "easeOut",
                          },
                        }}
                      >
                        <div className="text-base leading-relaxed text-gray-700">
                          {item.answer}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default FAQSection;
