import React from "react";
import {
  AddressTimezoneSource,
  resolveAddressTimezone,
  timezoneAbbreviation,
} from "@/lib/utils/address-timezone";
import { cn } from "@/lib/utils";

interface OrderTimezoneHintProps {
  /** The form's current pickup address; empty or missing falls back to the app default zone. */
  pickupAddress?: AddressTimezoneSource | null;
  className?: string;
}

/**
 * "Times in CT" next to the create-order time pickers. Resolves the zone the
 * same way orderTimesInPickupZone does at submit, so what the admin sees is
 * what gets saved.
 */
export function OrderTimezoneHint({ pickupAddress, className }: OrderTimezoneHintProps) {
  const zone = resolveAddressTimezone(pickupAddress);
  return (
    <p className={cn("text-xs text-muted-foreground", className)} title={zone}>
      {`Times in ${timezoneAbbreviation(zone)}`}
    </p>
  );
}
