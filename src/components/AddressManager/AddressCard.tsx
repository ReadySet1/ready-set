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
import { Pencil, Trash2, Phone, Info } from "lucide-react";

interface AddressCardProps {
  address: Address;
  isOwner: boolean;
  onEdit: (address: Address) => void;
  onDelete: (address: Address) => void;
}

const AddressCard: React.FC<AddressCardProps> = React.memo(
  ({ address, isOwner, onEdit, onDelete }) => {
    // Determine left border color based on address type
    const getBorderColor = () => {
      if (address.isShared) return "border-l-blue-500";
      if (isOwner) return "border-l-green-500";
      return "border-l-gray-300";
    };

    return (
      <Card
        className={`border-l-3 ${getBorderColor()} transition-all duration-200 ease-in-out hover:shadow-lg`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {address.name || "Unnamed Location"}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
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
                    Restaurant
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(address)}
                      disabled={!isOwner}
                      className="h-8 w-8 transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isOwner ? "Edit address" : "Only owners can edit"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(address)}
                      disabled={!isOwner || address.isShared}
                      className="h-8 w-8 transition-colors duration-150 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {!isOwner
                        ? "Only owners can delete"
                        : address.isShared
                          ? "Cannot delete shared addresses"
                          : "Delete address"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Address Information */}
          <div className="leading-relaxed text-gray-700 dark:text-gray-300">
            <p className="font-medium">{address.street1}</p>
            {address.street2 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {address.street2}
              </p>
            )}
            <p>
              {address.city}, {address.state} {address.zip}
            </p>
          </div>

          {/* Additional Information */}
          <div className="space-y-2 border-t pt-3 text-sm">
            {address.county && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4" />
                <span>
                  <span className="font-medium">County:</span> {address.county}
                </span>
              </div>
            )}

            {address.locationNumber && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="h-4 w-4" />
                <span>
                  <span className="font-medium">Phone:</span>{" "}
                  {address.locationNumber}
                </span>
              </div>
            )}

            {address.parkingLoading && (
              <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                <Info className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="font-medium">Parking:</span>{" "}
                  {address.parkingLoading}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
);

AddressCard.displayName = "AddressCard";

export default AddressCard;
