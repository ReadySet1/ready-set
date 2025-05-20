"use client";

import { Button } from "@/components/ui/button";
import React, { useState } from "react"; // Import useState
import { useForm, useFieldArray } from "react-hook-form";

type Order = {
  orderNumber: string;
  pickupTime: string;
  restaurant?: string;
  restaurantAddress?: string;
  dropOffTimeStart?: string;
  dropOffTimeEnd?: string;
  company?: string;
  companyAddress?: string;
  totalPay?: number;
  headcounts?: number;
};

type Inputs = {
  driverName: string;
  helpdeskAgent: string;
  date: string;
  orders: Order[];
};

const FormSameDay = () => {
  const [persistentDate, setPersistentDate] = useState("");
  const [persistentHelpdeskAgent, setPersistentHelpdeskAgent] = useState("");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<Inputs>({
    defaultValues: {
      date: persistentDate,          // Set default from persistent state
      helpdeskAgent: persistentHelpdeskAgent, // Set default from persistent state
      orders: [{}] as Order[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "orders",
  });

  const onSubmit = (data: Inputs) => {
    if (!data.date) {
      console.error('Date is required');
      return;
    }

    const dateParts = data.date.split("-").map(part => parseInt(part, 10));
    if (dateParts.length !== 3 || dateParts.some(isNaN)) {
      console.error('Invalid date format');
      return;
    }

    const year = dateParts[0] || 0;
    const month = dateParts[1] || 1;
    const day = dateParts[2] || 1;
    
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date');
      return;
    }
    
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });

    let message = `Hi ${data.driverName}! This is ${data.helpdeskAgent}. Here are your food drive for today, ${formattedDate}. Please check the details and confirm. Thank you!\n`;

    message += `Route/Order  Pick Up\n`;

    data.orders.forEach((order) => {
      message += `${order.orderNumber}  ${order.pickupTime}\n`;
    });

    message += `\nPlease confirm your readiness for today's food drive by replying. If unavailable, inform us ASAP to arrange a replacement to avoid penalties.\n\n`;
    message += `✅ Ensure restaurant sign-off via Coolfire app with location updates activated.\n`;
    message += `✅ Check Coolfire app for drive details. Notify promptly of app issues.\n\n`;
    message += `Arrive 15 mins early at the resto. Thanks, and drive safely!`;

    alert(message);

    navigator.clipboard
      .writeText(message)
      .then(() => console.log("Message copied to clipboard"))
      .catch((err) => console.error("Failed to copy message: ", err));
      reset({
        // Reset only the 'orders' field array
        orders: [{}] as Order[],
      });
  };

  return (
    <div className="overflow-hidden py-8">
      <div className="container">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4">
            <div
              className="wow fadeInUp dark:bg-gray-dark mb-12 rounded-sm px-8 py-11 shadow-three sm:p-[55px] lg:mb-5 lg:px-8 xl:p-[55px]"
              data-wow-delay=".15s"
            >
              <h2 className="mb-3 text-2xl font-bold text-black dark:text-white sm:text-3xl lg:text-2xl xl:text-3xl">
                Same day confirmation
              </h2>
              <p className="mb-12 text-base font-medium text-body-color">
                Fill the required data to get the sms template.
              </p>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="-mx-4 flex flex-wrap">
                  <div className="w-full px-4 md:w-1/2">
                    <div className="mb-8">
                      <label
                        htmlFor="date"
                        className="mb-3 block text-sm font-medium text-dark dark:text-white"
                      >
                        Date
                      </label>
                      <input
                        id="date"
                        type="date"
                        {...register("date", {
                          required: "Date is required",
                        })}
                        className="dark:text-body-color-dark w-full rounded-sm border border-stroke bg-[#f8f8f8] px-6 py-3 text-base text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:shadow-two dark:focus:border-primary dark:focus:shadow-none"
                      />
                      {errors.date && <span>{errors.date.message}</span>}
                    </div>
                  </div>

                  <div className="w-full px-4 md:w-1/2">
                    <div className="mb-8">
                      <label
                        htmlFor="driverName"
                        className="mb-3 block text-sm font-medium text-dark dark:text-white"
                      >
                        Driver Name
                      </label>
                      <input
                        id="driverName"
                        {...register("driverName", {
                          required: "Driver name is required",
                        })}
                        className="dark:text-body-color-dark w-full rounded-sm border border-stroke bg-[#f8f8f8] px-6 py-3 text-base text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:shadow-two dark:focus:border-primary dark:focus:shadow-none"
                      />
                      {errors.driverName && (
                        <span>{errors.driverName.message}</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full px-4 md:w-1/2">
                    <div className="mb-8">
                      <label
                        htmlFor="helpdeskAgent"
                        className="mb-3 block text-sm font-medium text-dark dark:text-white"
                      >
                        Helpdesk Agent
                      </label>
                      <input
                        id="helpdeskAgent"
                        {...register("helpdeskAgent", {
                          required: "Helpdesk agent is required",
                        })}
                        className="dark:text-body-color-dark w-full rounded-sm border border-stroke bg-[#f8f8f8] px-6 py-3 text-base text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:shadow-two dark:focus:border-primary dark:focus:shadow-none"
                      />
                      {errors.helpdeskAgent && (
                        <span>{errors.helpdeskAgent.message}</span>
                      )}
                    </div>
                  </div>

                  <div className="container">
                    {fields.map((field, index) => (
                      <div key={field.id}>
                        <div className="text-md mb-3 block font-medium text-dark dark:text-white">
                          <h3 className="py-4">Drive {index + 1}</h3>
                        </div>
                        <div className="-mx-4 flex flex-wrap">
                          <div className="w-full px-4 md:w-1/2">
                            <div className="mb-8">
                              <label htmlFor={`orders.${index}.orderNumber`}>
                                Order Number
                              </label>
                              <input
                                {...register(
                                  `orders.${index}.orderNumber` as const,
                                  {
                                    required: "Order number is required",
                                  },
                                )}
                                className="dark:text-body-color-dark w-full rounded-sm border border-stroke bg-[#f8f8f8] px-6 py-3 text-base text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:shadow-two dark:focus:border-primary dark:focus:shadow-none"
                              />
                              {errors.orders?.[index]?.orderNumber && (
                                <span>
                                  {errors.orders?.[index]?.orderNumber?.message}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-full px-4 md:w-1/2">
                            <div className="mb-8">
                              <label htmlFor={`orders.${index}.pickupTime`}>
                                Pickup Time
                              </label>
                              <input
                                type="text"
                                {...register(
                                  `orders.${index}.pickupTime` as const,
                                  {
                                    required: "Pickup time is required",
                                  },
                                )}
                                className="dark:text-body-color-dark w-full rounded-sm border border-stroke bg-[#f8f8f8] px-6 py-3 text-base text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:shadow-two dark:focus:border-primary dark:focus:shadow-none"
                              />
                              {errors.orders?.[index]?.pickupTime && (
                                <span>
                                  {errors.orders?.[index]?.pickupTime?.message}
                                </span>
                              )}
                            </div>
                          </div>
                          {index > 0 && (
                            <div className="py-4">
                              <Button
                                variant="destructive"
                                type="button"
                                onClick={() => remove(index)}
                              >
                                Remove Order
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-4">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => append({} as Order)}
                      className="px-4 py-2"
                    >
                      Add Another Order
                    </Button>

                    <Button type="submit" className="px-4 py-2">
                      Submit
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSameDay;
