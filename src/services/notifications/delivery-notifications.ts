/**
 * Order-confirmation email for a newly created order.
 *
 * Lives in a plain service module on purpose: it used to be exported from
 * src/app/actions/email.ts ("use server"), which made it a public POST
 * endpoint that would email a confirmation for any order id. It is only
 * called server-side from the orders route after authentication.
 */
import { sendOrderConfirmationToCustomer } from "@/services/email-notification";
import { prisma } from "@/utils/prismaDB";

interface DeliveryNotificationData {
  orderId: string;
  customerEmail: string | null;
  driverName?: string;
  estimatedDelivery?: Date;
}

/**
 * Send delivery/order notifications to customer
 * This function fetches the order details and sends a confirmation email
 */
export async function sendDeliveryNotifications(
  data: DeliveryNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch order details from database
    // Try catering first
    const cateringOrder = await prisma.cateringRequest.findUnique({
      where: { id: data.orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (cateringOrder && cateringOrder.user) {
      // Send catering order confirmation
      const emailSuccess = await sendOrderConfirmationToCustomer({
        orderNumber: cateringOrder.orderNumber,
        orderType: 'catering',
        customerName: cateringOrder.user.name || 'Valued Customer',
        customerEmail: data.customerEmail || cateringOrder.user.email || '',
        pickupTime: cateringOrder.pickupDateTime,
        arrivalTime: cateringOrder.arrivalDateTime,
        orderTotal: cateringOrder.orderTotal?.toString() || '0',
        pickupAddress: cateringOrder.pickupAddress,
        deliveryAddress: cateringOrder.deliveryAddress,
      });

      if (!emailSuccess) {
        return {
          success: false,
          error: 'Failed to send confirmation email'
        };
      }

      return { success: true };
    }

    // If not found in catering, try on-demand
    const onDemandOrder = await prisma.onDemand.findUnique({
      where: { id: data.orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (onDemandOrder && onDemandOrder.user) {
      // Send on-demand order confirmation
      const emailSuccess = await sendOrderConfirmationToCustomer({
        orderNumber: onDemandOrder.orderNumber,
        orderType: 'on_demand',
        customerName: onDemandOrder.user.name || 'Valued Customer',
        customerEmail: data.customerEmail || onDemandOrder.user.email || '',
        pickupTime: onDemandOrder.pickupDateTime,
        arrivalTime: onDemandOrder.arrivalDateTime,
        orderTotal: onDemandOrder.orderTotal?.toString() || '0',
        pickupAddress: onDemandOrder.pickupAddress,
        deliveryAddress: onDemandOrder.deliveryAddress,
      });

      if (!emailSuccess) {
        return {
          success: false,
          error: 'Failed to send confirmation email'
        };
      }

      return { success: true };
    }

    // Order not found in either table
    console.error('Order not found for ID:', data.orderId);
    return { success: false, error: 'Order not found' };
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
