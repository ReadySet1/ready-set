"use client";

import sendEmail from "@/app/actions/email";
import { useForm, SubmitHandler } from "react-hook-form";
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { loadRecaptchaScript, executeRecaptcha } from "@/lib/recaptcha";

interface FormInputs {
  name: string;
  email: string;
  phone: string;
  message: string;
  honeypot?: string; // Hidden field for bot detection
  recaptchaToken?: string; // reCAPTCHA token
}

interface MessageState {
  type: "success" | "error";
  text: string;
}

const Contact = () => {
  const [message, setMessage] = useState<MessageState | null>(null);
  const [recaptchaLoadError, setRecaptchaLoadError] = useState<boolean>(false);
  const [recaptchaLoadAttempts, setRecaptchaLoadAttempts] = useState<number>(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormInputs>();

  // Load reCAPTCHA script on component mount with retry logic
  useEffect(() => {
    const loadWithRetry = async (attempt: number = 1) => {
      try {
        await loadRecaptchaScript();
        setRecaptchaLoadError(false);
        console.log("[Contact Form] reCAPTCHA loaded successfully");
      } catch (error) {
        console.error(
          `[Contact Form] Failed to load reCAPTCHA (attempt ${attempt}):`,
          error,
        );
        setRecaptchaLoadAttempts(attempt);

        // Retry up to 3 times with exponential backoff
        if (attempt < 3) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 5s
          console.log(
            `[Contact Form] Retrying reCAPTCHA load in ${retryDelay}ms...`,
          );

          setTimeout(() => {
            loadWithRetry(attempt + 1);
          }, retryDelay);
        } else {
          // All retries failed
          setRecaptchaLoadError(true);
          console.warn(
            "[Contact Form] reCAPTCHA failed to load after 3 attempts. Form will still work with reduced spam protection.",
          );
        }
      }
    };

    loadWithRetry();
  }, []);

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      // Execute reCAPTCHA before submitting (if configured)
      const recaptchaToken = await executeRecaptcha("contact_form_submit");

      // Add reCAPTCHA token to form data
      const formDataWithToken = {
        ...data,
        recaptchaToken: recaptchaToken || undefined,
      };

      const result = await sendEmail(formDataWithToken);
      setMessage({ type: "success", text: result });

      setTimeout(() => {
        setMessage(null);
        reset();
      }, 3000);
    } catch (error: unknown) {
      let errorMessage =
        "We're sorry, there was an error sending your message.";

      if (error instanceof Error) {
        errorMessage += " " + error.message;
      }

      setMessage({
        type: "error",
        text: errorMessage,
      });

      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  return (
    <section id="contact" className="relative py-20 md:py-[120px]">
      {/* Hidden SEO content */}
      <div
        className="sr-only"
        role="complementary"
        aria-label="Contact Methods"
      >
        <h2>Get in Touch with Ready Set</h2>
        <p>
          Ready Set Group LLC welcomes inquiries about our premium business
          solutions. Whether you need catering delivery services or virtual
          assistant support, our team is here to help.
        </p>

        <div role="contentinfo" aria-label="Contact Methods">
          <h3>Ways to Connect</h3>
          <ul>
            <li>
              Email: info@ready-set.co - For general inquiries and quote
              requests
            </li>
            <li>
              Phone Support: Available during business hours for immediate
              assistance
            </li>
            <li>
              Online Form: Submit your request through our secure contact form
            </li>
            <li>
              Service Areas: Covering the entire Bay Area and Austin
              metropolitan region
            </li>
          </ul>
        </div>

        <div role="contentinfo" aria-label="Service Inquiries">
          <h3>Information We Need</h3>
          <ul>
            <li>Contact details for prompt response</li>
            <li>Service type needed (Logistics or Virtual Assistant)</li>
            <li>Preferred service area</li>
            <li>Timeline and scheduling requirements</li>
            <li>Specific service requirements or special instructions</li>
          </ul>
        </div>
      </div>

      <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
      <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-amber-50 dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
      <div className="container px-4">
        <div className="-mx-4 flex flex-wrap items-center">
          <div className="w-full px-4 lg:w-7/12 xl:w-8/12">
            <div className="ud-contact-content-wrapper">
              <div className="ud-contact-title mb-12 lg:mb-[150px]">
                <span className="mb-6 block text-base font-medium text-dark dark:text-white">
                  CONTACT US
                </span>
                <h2 className="max-w-[260px] text-[35px] font-semibold leading-[1.14] text-dark dark:text-white">
                  Let&#39;s talk about your needs.
                </h2>
              </div>
              <div className="mb-12 flex flex-wrap justify-between p-8 pt-16 lg:mb-0">
                <div className="mb-8 flex w-[330px] max-w-full">
                  <div className="mr-6 text-[32px] text-yellow-600">
                    <svg
                      width="29"
                      height="35"
                      viewBox="0 0 29 35"
                      className="fill-current"
                    >
                      <path d="M14.5 0.710938C6.89844 0.710938 0.664062 6.72656 0.664062 14.0547C0.664062 19.9062 9.03125 29.5859 12.6406 33.5234C13.1328 34.0703 13.7891 34.3437 14.5 34.3437C15.2109 34.3437 15.8672 34.0703 16.3594 33.5234C19.9688 29.6406 28.3359 19.9062 28.3359 14.0547C28.3359 6.67188 22.1016 0.710938 14.5 0.710938ZM14.9375 32.2109C14.6641 32.4844 14.2812 32.4844 14.0625 32.2109C11.3828 29.3125 2.57812 19.3594 2.57812 14.0547C2.57812 7.71094 7.9375 2.625 14.5 2.625C21.0625 2.625 26.4219 7.76562 26.4219 14.0547C26.4219 19.3594 17.6172 29.2578 14.9375 32.2109Z" />
                      <path d="M14.5 8.58594C11.2734 8.58594 8.59375 11.2109 8.59375 14.4922C8.59375 17.7188 11.2187 20.3984 14.5 20.3984C17.7812 20.3984 20.4062 17.7734 20.4062 14.4922C20.4062 11.2109 17.7266 8.58594 14.5 8.58594ZM14.5 18.4297C12.3125 18.4297 10.5078 16.625 10.5078 14.4375C10.5078 12.25 12.3125 10.4453 14.5 10.4453C16.6875 10.4453 18.4922 12.25 18.4922 14.4375C18.4922 16.625 16.6875 18.4297 14.5 18.4297Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-[18px] text-lg font-semibold text-dark dark:text-white">
                      Our Service Area
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">
                          California
                        </h4>
                        <p className="text-base text-body-color dark:text-dark-6">
                          Palo Alto, CA · San Mateo, CA · Mountain View, CA ·
                          San Jose, CA · Oakland, CA · Sunnyvale, CA · Richmond,
                          CA · Hayward, CA · Concord, CA · San Francisco, CA
                        </p>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">
                          Texas
                        </h4>
                        <p className="text-base text-body-color dark:text-dark-6">
                          Austin, TX · Dallas, TX
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mb-8 flex w-[330px] max-w-full">
                  <div className="mr-6 text-[32px] text-yellow-600">
                    <svg
                      width="34"
                      height="25"
                      viewBox="0 0 34 25"
                      className="fill-current"
                    >
                      <path d="M30.5156 0.960938H3.17188C1.42188 0.960938 0 2.38281 0 4.13281V20.9219C0 22.6719 1.42188 24.0938 3.17188 24.0938H30.5156C32.2656 24.0938 33.6875 22.6719 33.6875 20.9219V4.13281C33.6875 2.38281 32.2656 0.960938 30.5156 0.960938ZM30.5156 2.875C30.7891 2.875 31.0078 2.92969 31.2266 3.09375L17.6094 11.3516C17.1172 11.625 16.5703 11.625 16.0781 11.3516L2.46094 3.09375C2.67969 2.98438 2.89844 2.875 3.17188 2.875H30.5156ZM30.5156 22.125H3.17188C2.51562 22.125 1.91406 21.5781 1.91406 20.8672V5.00781L15.0391 12.9922C15.5859 13.3203 16.1875 13.4844 16.7891 13.4844C17.3906 13.4844 17.9922 13.3203 18.5391 12.9922L31.6641 5.00781V20.8672C31.7734 21.5781 31.1719 22.125 30.5156 22.125Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-[18px] text-lg font-semibold text-dark dark:text-white">
                      How Can We Help?
                    </h3>
                    <p className="text-base text-body-color dark:text-dark-6">
                      <a
                        href="mailto:info@ready-set.co"
                        className="hover:underline"
                      >
                        info@ready-set.co
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full px-4 lg:w-5/12 xl:w-4/12">
            <div
              className="wow fadeInUp rounded-lg bg-white px-8 py-10 shadow-testimonial dark:bg-dark-2 dark:shadow-none sm:px-10 sm:py-12 md:p-[60px] lg:p-10 lg:px-10 lg:py-12 2xl:p-[60px]"
              data-wow-delay=".2s"
            >
              <h3 className="mb-8 text-2xl font-semibold text-dark dark:text-white md:text-[28px] md:leading-[1.42]">
                Send us a Message
              </h3>
              {/* reCAPTCHA loading warning */}
              {recaptchaLoadError && (
                <div
                  className="mb-6 rounded-md border border-yellow-400 bg-yellow-50 p-4 dark:border-yellow-600 dark:bg-yellow-900/20"
                  role="alert"
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
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
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                        Enhanced spam protection unavailable
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                        <p>
                          Our advanced spam protection could not be loaded. Your
                          message will still be sent, but may experience
                          slightly longer processing time. If this is urgent,
                          please email us directly at{" "}
                          <a
                            href="mailto:info@ready-set.co"
                            className="font-medium underline hover:text-yellow-600"
                          >
                            info@ready-set.co
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Loading state indicator (optional) */}
              {!recaptchaLoadError &&
                recaptchaLoadAttempts > 0 &&
                recaptchaLoadAttempts < 3 && (
                  <div className="mb-4 text-sm text-body-color dark:text-dark-6">
                    <span className="inline-flex items-center">
                      <svg
                        className="mr-2 h-4 w-4 animate-spin text-yellow-600"
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
                      Loading spam protection...
                    </span>
                  </div>
                )}
              <form
                onSubmit={handleSubmit((data) => {
                  onSubmit(data);
                })}
              >
                {/* Honeypot field - hidden from users, bots will fill it */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website">Website (leave blank)</label>
                  <input
                    {...register("honeypot")}
                    type="text"
                    name="honeypot"
                    id="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="mb-[22px]">
                  <label
                    htmlFor="name"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Full Name*
                  </label>
                  <input
                    {...register("name", { required: true })}
                    type="text"
                    name="name"
                    placeholder="Adam Gelius"
                    className="w-full border-0 border-b border-[#f1f1f1] bg-transparent pb-3 text-dark placeholder:text-body-color/60 focus:border-yellow-600 focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                  {errors.name && (
                    <span className="mt-1 text-sm text-red-500">
                      This field is required
                    </span>
                  )}
                </div>
                <div className="mb-[22px]">
                  <label
                    htmlFor="email"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Email*
                  </label>
                  <input
                    {...register("email", { required: true })}
                    type="email"
                    name="email"
                    placeholder="example@yourmail.com"
                    className="w-full border-0 border-b border-[#f1f1f1] bg-transparent pb-3 text-dark placeholder:text-body-color/60 focus:border-yellow-600 focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                  {errors.email && (
                    <span className="mt-1 text-sm text-red-500">
                      This field is required
                    </span>
                  )}
                </div>
                <div className="mb-[22px]">
                  <label
                    htmlFor="phone"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Phone*
                  </label>
                  <input
                    {...register("phone", { required: true })}
                    type="text"
                    name="phone"
                    placeholder="415-123-2222"
                    className="w-full border-0 border-b border-[#f1f1f1] bg-transparent pb-3 text-dark placeholder:text-body-color/60 focus:border-yellow-600 focus:outline-none dark:border-dark-3 dark:text-white"
                  />
                  {errors.phone && (
                    <span className="mt-1 text-sm text-red-500">
                      This field is required
                    </span>
                  )}
                </div>
                <div className="mb-[30px]">
                  <label
                    htmlFor="message"
                    className="mb-4 block text-sm text-body-color dark:text-dark-6"
                  >
                    Message*
                  </label>
                  <textarea
                    {...register("message", {
                      required: true,
                      maxLength: 500,
                    })}
                    name="message"
                    rows={1}
                    placeholder="type your message here"
                    className="w-full resize-none border-0 border-b border-[#f1f1f1] bg-transparent pb-3 text-dark placeholder:text-body-color/60 focus:border-yellow-600 focus:outline-none dark:border-dark-3 dark:text-white"
                  ></textarea>
                  {errors.email && (
                    <span className="mt-1 text-sm text-red-500">
                      This field is required
                    </span>
                  )}
                </div>
                <div className="mb-0">
                  <Button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-yellow-500 px-10 py-3 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-yellow-600"
                  >
                    Send
                  </Button>
                </div>
              </form>
              {message && (
                <div
                  className={`mt-4 rounded p-3 ${
                    message.type === "success"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
