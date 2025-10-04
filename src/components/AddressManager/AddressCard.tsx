// src/components/AddressManager/AddressCard.tsx

import React from "react";
import { Address } from "@/types/address";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MapPin, Phone, Car, Building2, Pencil, Trash2 } from "lucide-react";

interface AddressCardProps {
  address: Address;
  isOwner: boolean;
  onEdit: (address: Address) => void;
  onDelete: (address: Address) => void;
  isDeleting?: boolean;
}

/**
 * Modern address card component with improved visual hierarchy and UX
 * Features:
 * - Status indicator via left border color
 * - Clear badge system for address types
 * - Icon-based actions with tooltips
 * - Responsive layout with proper spacing
 * - Hover effects and transitions
 */
const AddressCard: React.FC<AddressCardProps> = React.memo(
  ({ address, isOwner, onEdit, onDelete, isDeleting = false }) => {
    // Determine border color based on address type
    const getBorderColor = () => {
      if (address.isShared) return "border-l-blue-500";
      if (isOwner) return "border-l-green-500";
      return "border-l-gray-300";
    };

    // Check if address can be deleted (must be owner and not shared)
    const canDelete = isOwner && !address.isShared;

    return (
      <Card
        className={`relative overflow-hidden border-l-4 transition-all duration-200 ease-in-out hover:shadow-lg ${getBorderColor()} group`}
      >
        {/* Header Section with Name and Badges */}
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {address.name || "Unnamed Location"}
              </h3>
            </div>

            {/* Action Buttons - Icon buttons with tooltips */}
            <TooltipProvider>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                      onClick={() => onEdit(address)}
                      disabled={!isOwner}
                      aria-label="Edit address"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isOwner ? "Edit address" : "Only owner can edit"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
                      onClick={() => onDelete(address)}
                      disabled={!canDelete || isDeleting}
                      aria-label="Delete address"
                    >
                      {isDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!isOwner
                        ? "Only owner can delete"
                        : address.isShared
                          ? "Shared addresses cannot be deleted"
                          : "Delete address"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100">
                Owner
              </Badge>
            )}
            {address.isShared && (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-100">
                Shared
              </Badge>
            )}
            {address.isRestaurant && (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-100">
                <Building2 className="mr-1 h-3 w-3" />
                Restaurant
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* Content Section with Address Details */}
        <CardContent className="space-y-4 text-sm leading-relaxed">
          {/* Street Address */}
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div className="min-w-0 flex-1">
              <div className="text-gray-900 dark:text-gray-100">
                {address.street1}
              </div>
              {address.street2 && (
                <div className="text-gray-700 dark:text-gray-300">
                  {address.street2}
                </div>
              )}
              <div className="text-gray-700 dark:text-gray-300">
                {address.city}, {address.state} {address.zip}
              </div>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="flex flex-wrap gap-4 border-t border-gray-200 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
            <div>
              <span className="font-medium">County:</span>{" "}
              <span>{address.county || "N/A"}</span>
            </div>
          </div>

          {/* Phone Number */}
          {address.locationNumber && (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Phone className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span>{address.locationNumber}</span>
            </div>
          )}

          {/* Parking/Loading Information */}
          {address.parkingLoading && (
            <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
              <Car className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span className="text-xs">{address.parkingLoading}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

AddressCard.displayName = "AddressCard";

export default AddressCard;
