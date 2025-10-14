import React from "react";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyAddressStateProps {
  onAddAddress: () => void;
  filterType?: "all" | "shared" | "private";
}

const EmptyAddressState: React.FC<EmptyAddressStateProps> = ({
  onAddAddress,
  filterType = "all",
}) => {
  const getEmptyMessage = () => {
    switch (filterType) {
      case "shared":
        return {
          title: "No Shared Addresses Yet",
          description:
            "You don't have any shared addresses. Create a shared address to make it available to all users.",
        };
      case "private":
        return {
          title: "No Private Addresses Yet",
          description:
            "You don't have any private addresses. Add your first private address to get started.",
        };
      default:
        return {
          title: "No Addresses Found",
          description:
            "Get started by adding your first address. You can add delivery locations, pickup points, or any location you frequently use.",
        };
    }
  };

  const message = getEmptyMessage();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
        <MapPin className="h-8 w-8 text-gray-500 dark:text-gray-400" />
      </div>

      <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {message.title}
      </h3>

      <p className="mt-2 max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
        {message.description}
      </p>

      <Button
        onClick={onAddAddress}
        className="mt-6 transition-all duration-200 hover:scale-105"
        size="lg"
      >
        <Plus className="mr-2 h-5 w-5" />
        Add Your First Address
      </Button>
    </div>
  );
};

export default EmptyAddressState;
