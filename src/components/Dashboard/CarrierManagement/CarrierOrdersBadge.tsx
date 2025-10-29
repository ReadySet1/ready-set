"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck, Building2, ExternalLink } from 'lucide-react';
import { CarrierServiceClient as CarrierService } from '@/lib/services/carrier-service-client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CarrierOrdersBadgeProps {
  orderNumber: string;
  brokerage?: string | null;
  className?: string;
  showTooltip?: boolean;
}

export const CarrierOrdersBadge: React.FC<CarrierOrdersBadgeProps> = ({
  orderNumber,
  brokerage,
  className = '',
  showTooltip = true,
}) => {
  // Detect carrier from order number
  const carrier = CarrierService.detectCarrier(orderNumber);
  
  // If no carrier detected but brokerage is set, show brokerage
  if (!carrier && brokerage) {
    const badgeContent = (
      <Badge variant="outline" className={`gap-1 ${className}`}>
        <Building2 className="h-3 w-3" />
        {brokerage}
      </Badge>
    );

    if (!showTooltip) return badgeContent;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>Brokerage: {brokerage}</p>
            <p className="text-xs text-gray-500">No carrier integration</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // If carrier is detected, show carrier badge
  if (carrier) {
    const badgeVariant = carrier.enabled ? 'default' : 'secondary';
    const badgeColor = carrier.enabled 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-gray-100 text-gray-600 border-gray-200';

    const badgeContent = (
      <Badge variant={badgeVariant} className={`gap-1 ${badgeColor} ${className}`}>
        <Truck className="h-3 w-3" />
        {carrier.name}
        {carrier.enabled && <ExternalLink className="h-2.5 w-2.5" />}
      </Badge>
    );

    if (!showTooltip) return badgeContent;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{carrier.name} Integration</p>
              <p className="text-xs">Order prefix: {carrier.orderPrefix}</p>
              <p className="text-xs">
                Status: {carrier.enabled ? 'Active' : 'Disabled'}
              </p>
              {carrier.enabled && (
                <p className="text-xs text-green-600">
                  Webhooks enabled
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Direct order (no carrier, no brokerage)
  return (
    <Badge variant="outline" className={`gap-1 bg-green-50 text-green-700 border-green-200 ${className}`}>
      <Building2 className="h-3 w-3" />
      Direct
    </Badge>
  );
}; 