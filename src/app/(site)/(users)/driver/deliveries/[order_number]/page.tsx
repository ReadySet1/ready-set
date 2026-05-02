"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DriverCockpit } from "@/components/Driver/cockpit/DriverCockpit";
import { DriverCompletedOrder } from "@/components/Driver/cockpit/DriverCompletedOrder";
import { useDeliveryStatusRealtime } from "@/hooks/tracking/useDeliveryStatusRealtime";
import {
  getNextStatus,
  isDeliveryCompleted,
} from "@/lib/delivery-status-transitions";
import { useToast } from "@/components/ui/use-toast";
import { useDriverDelivery } from "@/hooks/useDriverDelivery";

const DriverOrderPage = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const orderNumber = (() => {
    if (!params?.order_number) return "";
    const raw = Array.isArray(params.order_number)
      ? params.order_number[0]
      : params.order_number;
    return raw ? decodeURIComponent(raw) : "";
  })();

  const { delivery, isLoading, error, refetch } = useDriverDelivery(orderNumber);

  // Realtime status sync for external changes
  useDeliveryStatusRealtime({
    orderId: delivery?.id,
    enabled: !!delivery && !isDeliveryCompleted(delivery.driverStatus),
    showNotifications: false,
    onStatusUpdate: () => {
      refetch();
    },
  });

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!delivery) return;

    const currentStatus = delivery.driverStatus || null;
    const nextStatus = getNextStatus(currentStatus);
    if (!nextStatus) return;

    setIsUpdating(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(delivery.orderNumber)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverStatus: nextStatus }),
        },
      );

      if (!res.ok) throw new Error("Failed to update status");

      // Refresh delivery data after status change
      await refetch();

      toast({
        title: "Status Updated",
        description: `Order #${delivery.orderNumber} updated successfully.`,
      });
    } catch (err) {
      console.error("Error updating delivery status:", err);
      toast({
        title: "Update Failed",
        description: "Could not update delivery status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBack = () => {
    router.push("/driver/deliveries");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-4">
        <p className="text-red-600 mb-3">{error || "Delivery not found"}</p>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm font-medium text-gray-700 underline"
        >
          Back to Queue
        </button>
      </div>
    );
  }

  if (isDeliveryCompleted(delivery.driverStatus)) {
    return <DriverCompletedOrder delivery={delivery} onBack={handleBack} />;
  }

  return (
    <DriverCockpit
      delivery={delivery}
      onStatusUpdate={handleStatusUpdate}
      onBack={handleBack}
      isUpdating={isUpdating}
    />
  );
};

export default DriverOrderPage;
