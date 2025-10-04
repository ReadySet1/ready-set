// src/components/AddressManager/EmptyAddressState.tsx

import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Plus } from "lucide-react";

interface EmptyAddressStateProps {
  onAddAddress: () => void;
  filterType?: "all" | "shared" | "private";
}

/**
 * Engaging empty state component with contextual messaging
 * Provides clear guidance and prominent CTA for adding addresses
 */
const EmptyAddressState: React.FC<EmptyAddressStateProps> = ({
  onAddAddress,
  filterType = "all",
}) => {
  // Contextual messaging based on filter type
  const getMessage = () => {
    switch (filterType) {
      case "shared":
        return {
          title: "No shared addresses found",
          description:
            "Shared addresses are visible to all users in your organization. Create one to get started!",
        };
      case "private":
        return {
          title: "No private addresses found",
          description:
            "Private addresses are only visible to you. Add your first private address now!",
        };
      default:
        return {
          title: "No addresses yet",
          description:
            "Get started by adding your first address. You can create both private and shared addresses.",
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
      {/* Icon */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MapPin className="h-8 w-8 text-primary" />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>

      {/* CTA Button */}
      <Button
        onClick={onAddAddress}
        size="lg"
        className="gap-2 shadow-sm transition-all hover:scale-105"
      >
        <Plus className="h-5 w-5" />
        Add Your First Address
      </Button>

      {/* Additional Hint */}
      <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
        Addresses are used for deliveries, pickups, and location management
      </p>
    </div>
  );
};

export default EmptyAddressState;
