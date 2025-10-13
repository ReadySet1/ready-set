import { DriverStatus } from "../types/order";
import { sendOrderNotificationToAdmin } from "@/services/email-notification";

type PrismaAddress = {
  id: string;
  name: string | null;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  locationNumber: string | null;
  parkingLoading: string | null;
  isRestaurant: boolean;
  isShared: boolean;
  createdBy: string | null;
};

type OrderUser = {
  name: string | null;
  email: string | null;
};

interface BaseOrder {
  user: OrderUser;
  address: PrismaAddress;
  delivery_address: PrismaAddress;
  order_number: string;
  brokerage?: string | null;
  date: Date | null;
  pickup_time: Date | null;
  arrival_time: Date | null;
  complete_time?: Date | null;
  order_total: number | string | null;
  client_attention: string | null;
  pickup_notes?: string | null;
  special_notes?: string | null;
  status?: string | null;
  driver_status?: DriverStatus | null;
}

interface CateringOrder extends BaseOrder {
  order_type: "catering";
  headcount?: string | null;
  need_host?: string | null;
  hours_needed?: string | null;
  number_of_host?: string | null;
}

interface OnDemandOrder extends BaseOrder {
  order_type: "on_demand";
  item_delivered: string | null;
  vehicle_type: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  weight: string | null;
}

export type { CateringOrder, OnDemandOrder };

/**
 * Send order notification email using the unified notification service
 * This function maintains backward compatibility with existing code
 */
export async function sendOrderEmail(order: CateringOrder | OnDemandOrder) {
  // Use the unified notification service
  try {
    const success = await sendOrderNotificationToAdmin({
      orderNumber: order.order_number,
      orderType: order.order_type === "catering" ? "catering" : "on_demand",
      customerName: order.user.name || "Unknown",
      customerEmail: order.user.email || "unknown@example.com",
      brokerage: order.brokerage,
      date: order.date,
      pickupTime: order.pickup_time,
      arrivalTime: order.arrival_time,
      completeTime: order.complete_time,
      orderTotal: order.order_total || "0",
      clientAttention: order.client_attention,
      status: order.status,
      driverStatus: order.driver_status,
      pickupAddress: order.address,
      deliveryAddress: order.delivery_address,
      pickupNotes: order.pickup_notes,
      specialNotes: order.special_notes,
      // Catering specific fields
      ...(order.order_type === "catering" && {
        headcount: (order as CateringOrder).headcount,
        needHost: (order as CateringOrder).need_host,
        hoursNeeded: (order as CateringOrder).hours_needed,
        numberOfHosts: (order as CateringOrder).number_of_host,
      }),
      // On-demand specific fields
      ...(order.order_type === "on_demand" && {
        itemDelivered: (order as OnDemandOrder).item_delivered,
        vehicleType: (order as OnDemandOrder).vehicle_type,
        dimensions: {
          length: (order as OnDemandOrder).length,
          width: (order as OnDemandOrder).width,
          height: (order as OnDemandOrder).height,
        },
        weight: (order as OnDemandOrder).weight,
      }),
    });

    if (!success) {
      throw new Error("Failed to send order notification email");
    }

    console.log("Order notification email sent successfully");
  } catch (error) {
    console.error("Error sending order notification email:", error);
    throw error;
  }
}