// src/components/Dashboard/UserView/Tabs/ProfileTab.tsx

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserFormValues } from "../types";
import { Control, FieldErrors } from "react-hook-form";

// Phone validation helper
const validatePhoneNumber = (phone: string | null | undefined): string | null => {
  if (!phone) return null; // Optional field
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    return 'Phone number must be exactly 10 digits';
  }
  return null;
};

interface ProfileTabProps {
  control: Control<UserFormValues>;
  watchedValues: UserFormValues;
  errors?: FieldErrors<UserFormValues>;
}

export default function ProfileTab({ control, watchedValues }: ProfileTabProps) {
  const { formState: { errors } } = useFormContext<UserFormValues>();
  // Get phone validation error
  const phoneError = validatePhoneNumber(watchedValues.contact_number);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name</Label>
          <Controller
            name="company_name"
            control={control}
            render={({ field }) => (
              <Input
                id="company_name"
                placeholder="Enter company name"
                {...field}
                value={field.value || ""}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">
            {watchedValues.type === "vendor" ||
            watchedValues.type === "client"
              ? "Contact Name"
              : "Full Name"}
          </Label>
          <Controller
            name="displayName"
            control={control}
            render={({ field }) => (
              <Input
                id="displayName"
                placeholder="Enter name"
                {...field}
                value={field.value || ""}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_number">Phone Number</Label>
          <Controller
            name="contact_number"
            control={control}
            render={({ field }) => (
              <Input
                id="contact_number"
                placeholder="Enter 10-digit phone number"
                className={phoneError ? "border-red-500 focus-visible:ring-red-500" : ""}
                {...field}
                value={field.value || ""}
              />
            )}
          />
          {phoneError && (
            <p className="text-sm text-red-500">{phoneError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                {...field}
                value={field.value || ""}
              />
            )}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Controller
            name="website"
            control={control}
            render={({ field }) => (
              <Input
                id="website"
                placeholder="Enter website URL"
                {...field}
                value={field.value || ""}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}