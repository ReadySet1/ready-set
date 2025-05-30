"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, CheckCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "react-hot-toast";

type Order = {
  orderNumber: string;
  pickupTime: string;
  restaurant: string;
  restaurantAddress: string;
  company: string;
  companyAddress: string;
  headcounts: string;
  totalPay: string;
  dropOffTimeStart: string;
  dropOffTimeEnd: string;
};

type Inputs = {
  driverName: string;
  helpdeskAgent: string;
  date: string;
  orders: Order[];
};

const FormNextDay = () => {
  const [persistentDate, setPersistentDate] = useState("");
  const [persistentHelpdeskAgent, setPersistentHelpdeskAgent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<Inputs>({
    defaultValues: {
      date: persistentDate,
      helpdeskAgent: persistentHelpdeskAgent,
      orders: [{}] as Order[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "orders",
  });

  const onSubmit = async (data: Inputs) => {
    setIsGenerating(true);
    
    try {
      if (!data.date) {
        toast.error('Date is required');
        return;
      }

      const dateParts = data.date.split("-").map(part => parseInt(part, 10));
      if (dateParts.length !== 3 || dateParts.some(isNaN)) {
        toast.error('Invalid date format');
        return;
      }

      const year = dateParts[0] || 0;
      const month = dateParts[1] || 1;
      const day = dateParts[2] || 1;
      
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) {
        toast.error('Invalid date');
        return;
      }
      
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });

      let message = `Hi ${data.driverName}! This is ${data.helpdeskAgent}. Here are your food drive for tomorrow, ${formattedDate}. Please check the details and confirm. Thank you!\n`;

      data.orders.forEach((order, index) => {
        if (data.orders.length > 1) {
          message += `\n---------${index + 1}${
            index + 1 === 1
              ? "ST"
              : index + 1 === 2
                ? "ND"
                : index + 1 === 3
                  ? "RD"
                  : "TH"
          } ORDER----------\n`;
        }
        message += `\nORDER# ${order.orderNumber}\n`;
        message += `PICK UP: ${order.pickupTime}\n${order.restaurant} - ${order.restaurantAddress}\n`;
        message += `\n`;
        message += `DROP OFF: ${order.dropOffTimeStart} - ${order.dropOffTimeEnd}\n${order.company} - ${order.companyAddress}\n`;
        message += `\n PAY: $${order.totalPay}\n`;
        message += `HEADCOUNT: ${order.headcounts}\n`;
      });

      await navigator.clipboard.writeText(message);
      toast.success("SMS template generated and copied to clipboard!");

      setPersistentDate(data.date);
      setPersistentHelpdeskAgent(data.helpdeskAgent);

      // Reset form with empty order
      reset({
        date: data.date,
        helpdeskAgent: data.helpdeskAgent,
        driverName: '',
        orders: [{
          orderNumber: '',
          pickupTime: '',
          restaurant: '',
          restaurantAddress: '',
          company: '',
          companyAddress: '',
          headcounts: '',
          totalPay: '',
          dropOffTimeStart: '',
          dropOffTimeEnd: ''
        }]
      });
    } catch (error) {
      toast.error("Failed to generate SMS template");
      console.error("Error generating SMS template:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    setValue('date', persistentDate);
    setValue('helpdeskAgent', persistentHelpdeskAgent);
  }, [persistentDate, persistentHelpdeskAgent, setValue]);

  const addOrder = () => {
    append({
      orderNumber: '',
      pickupTime: '',
      restaurant: '',
      restaurantAddress: '',
      company: '',
      companyAddress: '',
      headcounts: '',
      totalPay: '',
      dropOffTimeStart: '',
      dropOffTimeEnd: ''
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date", {
                    required: "Date is required",
                  })}
                  className="w-full"
                />
                {errors.date && (
                  <p className="text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverName">Driver Name *</Label>
                <Input
                  id="driverName"
                  placeholder="Enter driver name"
                  {...register("driverName", {
                    required: "Driver name is required",
                  })}
                />
                {errors.driverName && (
                  <p className="text-sm text-red-600">{errors.driverName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="helpdeskAgent">Helpdesk Agent *</Label>
                <Input
                  id="helpdeskAgent"
                  placeholder="Enter your name"
                  {...register("helpdeskAgent", {
                    required: "Helpdesk agent is required",
                  })}
                />
                {errors.helpdeskAgent && (
                  <p className="text-sm text-red-600">{errors.helpdeskAgent.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Orders</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOrder}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Order
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Order {index + 1}</Badge>
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.orderNumber`}>Order Number *</Label>
                    <Input
                      placeholder="Enter order number"
                      {...register(`orders.${index}.orderNumber` as const, {
                        required: "Order number is required",
                      })}
                    />
                    {errors.orders?.[index]?.orderNumber && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.orderNumber?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.pickupTime`}>Pickup Time *</Label>
                    <Input
                      placeholder="e.g., 11:30 AM"
                      {...register(`orders.${index}.pickupTime` as const, {
                        required: "Pickup time is required",
                      })}
                    />
                    {errors.orders?.[index]?.pickupTime && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.pickupTime?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.restaurant`}>Restaurant Name *</Label>
                    <Input
                      placeholder="Enter restaurant name"
                      {...register(`orders.${index}.restaurant` as const, {
                        required: "Restaurant is required",
                      })}
                    />
                    {errors.orders?.[index]?.restaurant && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.restaurant?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.restaurantAddress`}>Restaurant Address *</Label>
                    <Input
                      placeholder="Enter restaurant address"
                      {...register(`orders.${index}.restaurantAddress` as const, {
                        required: "Restaurant address is required",
                      })}
                    />
                    {errors.orders?.[index]?.restaurantAddress && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.restaurantAddress?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.dropOffTimeStart`}>Drop Off Start Time *</Label>
                    <Input
                      placeholder="e.g., 12:00 PM"
                      {...register(`orders.${index}.dropOffTimeStart` as const, {
                        required: "Drop off start time is required",
                      })}
                    />
                    {errors.orders?.[index]?.dropOffTimeStart && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.dropOffTimeStart?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.dropOffTimeEnd`}>Drop Off End Time *</Label>
                    <Input
                      placeholder="e.g., 12:30 PM"
                      {...register(`orders.${index}.dropOffTimeEnd` as const, {
                        required: "Drop off end time is required",
                      })}
                    />
                    {errors.orders?.[index]?.dropOffTimeEnd && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.dropOffTimeEnd?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.company`}>Client *</Label>
                    <Input
                      placeholder="Enter client/company name"
                      {...register(`orders.${index}.company` as const, {
                        required: "Company is required",
                      })}
                    />
                    {errors.orders?.[index]?.company && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.company?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.companyAddress`}>Client Address *</Label>
                    <Input
                      placeholder="Enter client address"
                      {...register(`orders.${index}.companyAddress` as const, {
                        required: "Company address is required",
                      })}
                    />
                    {errors.orders?.[index]?.companyAddress && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.companyAddress?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.totalPay`}>Total Pay *</Label>
                    <Input
                      placeholder="Enter amount (without $)"
                      {...register(`orders.${index}.totalPay` as const, {
                        required: "Total pay is required",
                      })}
                    />
                    {errors.orders?.[index]?.totalPay && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.totalPay?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`orders.${index}.headcounts`}>Headcount *</Label>
                    <Input
                      placeholder="Enter number of people"
                      {...register(`orders.${index}.headcounts` as const, {
                        required: "Headcount is required",
                      })}
                    />
                    {errors.orders?.[index]?.headcounts && (
                      <p className="text-sm text-red-600">
                        {errors.orders?.[index]?.headcounts?.message}
                      </p>
                    )}
                  </div>
                </div>

                {index < fields.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Generate SMS Template
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FormNextDay;