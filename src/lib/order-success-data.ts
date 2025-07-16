import { OrderSuccessData } from "@/types/order-success";
import { generateDefaultNextSteps } from "@/lib/order-success-utils";

/**
 * Fetch detailed order information suitable for the vendor success page.
 * NOTE: This function relies on `/api/orders/[orderNumber]` API being available
 * and returns a structure compatible with OrderSuccessData.
 */
export async function fetchOrderSuccessData(
  orderNumber: string
): Promise<OrderSuccessData | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/orders/${encodeURIComponent(
        orderNumber
      )}`,
      {
        // Ensure we bypass any edge caching
        headers: {
          "Cache-Control": "no-store",
        },
        // Revalidate every 5 seconds when using next fetch cache option (Next.js >= 14)
        // @ts-ignore
        next: { revalidate: 5 },
      } as RequestInit & { next: { revalidate: number } }
    );

    if (!res.ok) {
      console.error("Failed to fetch order data", res.statusText);
      return null;
    }

    const apiData = await res.json();

    // Basic validation
    if (!apiData || !apiData.orderNumber) {
      console.warn("Invalid order data received", apiData);
      return null;
    }

    // Map API shape to OrderSuccessData
    const orderData: OrderSuccessData = {
      orderNumber: apiData.orderNumber,
      orderType: apiData.order_type === "on_demand" ? "ON_DEMAND" : "CATERING",
      clientName: apiData.user?.name ?? "Unknown Client",
      pickupDateTime: new Date(apiData.pickupDateTime),
      arrivalDateTime: new Date(apiData.arrivalDateTime),
      pickupAddress: {
        street1: apiData.pickupAddress?.street1 ?? "",
        street2: apiData.pickupAddress?.street2 ?? undefined,
        city: apiData.pickupAddress?.city ?? "",
        state: apiData.pickupAddress?.state ?? "",
        zip: apiData.pickupAddress?.zip ?? "",
      },
      deliveryAddress: {
        street1: apiData.deliveryAddress?.street1 ?? "",
        street2: apiData.deliveryAddress?.street2 ?? undefined,
        city: apiData.deliveryAddress?.city ?? "",
        state: apiData.deliveryAddress?.state ?? "",
        zip: apiData.deliveryAddress?.zip ?? "",
      },
      brokerage: apiData.brokerage ?? undefined,
      orderTotal: apiData.orderTotal ? Number(apiData.orderTotal) : undefined,
      headcount: apiData.headcount ? Number(apiData.headcount) : undefined,
      needHost: apiData.needHost ?? "NO",
      hoursNeeded: apiData.hoursNeeded ? Number(apiData.hoursNeeded) : undefined,
      numberOfHosts: apiData.numberOfHosts ? Number(apiData.numberOfHosts) : undefined,
      nextSteps: generateDefaultNextSteps({
        needHost: apiData.needHost,
        numberOfHosts: apiData.numberOfHosts,
        hoursNeeded: apiData.hoursNeeded,
        pickupDateTime: new Date(apiData.pickupDateTime),
        arrivalDateTime: new Date(apiData.arrivalDateTime),
        brokerage: apiData.brokerage,
      }),
      createdAt: apiData.createdAt ? new Date(apiData.createdAt) : new Date(),
    };

    return orderData;
  } catch (error) {
    console.error("Error fetching order success data", error);
    return null;
  }
} 