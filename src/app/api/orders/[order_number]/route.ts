// src/app/api/orders/[order_number]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from "@prisma/client";
import { sendDispatchStatusNotification } from "@/services/notifications/delivery-status";
import { DriverStatus } from "@/types/user";

import { CateringRequestGetPayload, OnDemandGetPayload } from '@/types/prisma';
import {
  cateringUpdateSchema,
  onDemandUpdateSchema,
  addressUpdateSchema,
  isTerminalStatus,
  detectSignificantChanges,
  hasSignificantChanges,
  type AddressUpdate,
  type FieldChange,
} from './schemas';

// Map DriverStatus to dispatch notification status
const DRIVER_STATUS_TO_DISPATCH_STATUS: Record<string, string> = {
  [DriverStatus.ARRIVED_AT_VENDOR]: 'ARRIVED_AT_PICKUP',
  [DriverStatus.PICKED_UP]: 'PICKUP_COMPLETE', // Legacy - kept for backwards compatibility
  [DriverStatus.EN_ROUTE_TO_CLIENT]: 'EN_ROUTE_TO_DELIVERY',
  [DriverStatus.ARRIVED_TO_CLIENT]: 'ARRIVED_AT_DELIVERY',
  [DriverStatus.COMPLETED]: 'DELIVERY_COMPLETE',
};

// Map DriverStatus transitions to order status updates
// When driver starts working on delivery, order status should sync
const DRIVER_STATUS_TO_ORDER_STATUS: Record<string, string> = {
  [DriverStatus.ARRIVED_AT_VENDOR]: 'IN_PROGRESS',
  [DriverStatus.PICKED_UP]: 'IN_PROGRESS',
  [DriverStatus.EN_ROUTE_TO_CLIENT]: 'IN_PROGRESS',
  [DriverStatus.ARRIVED_TO_CLIENT]: 'IN_PROGRESS',
  [DriverStatus.COMPLETED]: 'DELIVERED',
};

// Statuses that should trigger customer notifications
const CUSTOMER_NOTIFICATION_STATUSES = [
  DriverStatus.ARRIVED_AT_VENDOR,
  DriverStatus.EN_ROUTE_TO_CLIENT,
  DriverStatus.ARRIVED_TO_CLIENT,
  DriverStatus.COMPLETED,
];

// Statuses that should trigger admin notifications
const ADMIN_NOTIFICATION_STATUSES = [
  DriverStatus.COMPLETED,
];

// Roles that can edit orders
const ORDER_EDIT_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'];

type CateringRequest = CateringRequestGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
    dispatches: {
      include: {
        driver: {
          select: {
            id: true;
            name: true;
            email: true;
            contactNumber: true;
          };
        };
      };
    };
    fileUploads: true;
  };
}>;

type OnDemandOrder = OnDemandGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
    dispatches: {
      include: {
        driver: {
          select: {
            id: true;
            name: true;
            email: true;
            contactNumber: true;
          };
        };
      };
    };
    fileUploads: true;
  };
}>;

type Order = 
  | (CateringRequest & { order_type: "catering" })
  | (OnDemandOrder & { order_type: "on_demand" });

function serializeOrder(data: any): any {
  // Helper function to convert dates to ISO strings (preserves timezone info)
  const toISOString = (date: string | Date | null) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  // Create a copy of the data with ISO date strings
  // ISO strings are correctly parsed by clients in any timezone
  const formattedData = {
    ...data,
    pickupDateTime: toISOString(data.pickupDateTime),
    arrivalDateTime: toISOString(data.arrivalDateTime),
    completeDateTime: toISOString(data.completeDateTime),
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt)
  };

  // Convert any BigInt values to strings
  return JSON.parse(JSON.stringify(formattedData, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  ));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  try {
    // Await params before accessing its properties
    const resolvedParams = await params;
        
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user || !user.id) {
      console.error("Unauthorized access attempt to order API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

        
    // Extract order_number from params and decode it properly
    const { order_number: encodedOrderNumber } = resolvedParams;
    const order_number = decodeURIComponent(encodedOrderNumber);

    let order: Order | null = null;

    // Try to find catering request using case-insensitive search and check soft delete
    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: { 
        orderNumber: {
          equals: order_number,
          mode: 'insensitive'
        },
        deletedAt: null // Add soft delete check
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
        dispatches: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
        fileUploads: true,
      },
    });

    if (cateringRequest) {
      order = { ...cateringRequest, order_type: "catering" };
    } else {
      // If not found, try to find on-demand order using case-insensitive search and check soft delete
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: { 
          orderNumber: {
            equals: order_number,
            mode: 'insensitive'
          },
          // Assuming onDemand table also has a deletedAt field for soft deletes
          // If not, this line might need adjustment based on your schema
          deletedAt: null // Add soft delete check 
        },
        include: {
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                },
              },
            },
          },
          fileUploads: true,
        },
      });

      if (onDemandOrder) {
        order = { ...onDemandOrder, order_type: "on_demand" };
      }
    }

    if (order) {
      const serializedOrder = serializeOrder(order);
      return NextResponse.json(serializedOrder);
    }

    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { message: "Error fetching order", error: (error as Error).message },
      { status: 500 },
    );
  }
}

// Helper function to create or update an address
async function upsertAddress(
  addressData: AddressUpdate,
  existingAddressId?: string
): Promise<string> {
  const { id, ...addressFields } = addressData;

  // If we have an existing address ID, update it
  if (existingAddressId) {
    await prisma.address.update({
      where: { id: existingAddressId },
      data: addressFields,
    });
    return existingAddressId;
  }

  // Otherwise, create a new address
  const newAddress = await prisma.address.create({
    data: addressFields,
  });
  return newAddress.id;
}

// Helper function to check if this is just a status update (legacy behavior)
function isStatusOnlyUpdate(body: Record<string, unknown>): boolean {
  const statusFields = ['status', 'driverStatus'];
  const providedFields = Object.keys(body).filter(key => body[key] !== undefined);
  return providedFields.every(field => statusFields.includes(field));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  try {
    // Await params before accessing its properties
    const resolvedParams = await params;

    // Initialize Supabase client
    const supabase = await createClient();

    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user || !user.id) {
      console.error("Unauthorized access attempt to order PATCH API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract order_number from params and decode it properly
    const { order_number: encodedOrderNumber } = resolvedParams;
    const order_number = decodeURIComponent(encodedOrderNumber);

    const body = await request.json();
    const { status, driverStatus, ...updateFields } = body;

    // Check if any update data is provided
    const hasStatusUpdate = status || driverStatus;
    const hasFieldUpdates = Object.keys(updateFields).length > 0;

    if (!hasStatusUpdate && !hasFieldUpdates) {
      return NextResponse.json(
        { message: "No update data provided" },
        { status: 400 },
      );
    }

    // Find the order first to determine its type and check status
    let existingOrder: Order | null = null;
    let orderType: 'catering' | 'on_demand' = 'catering';

    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: order_number, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
        dispatches: {
          include: {
            driver: {
              select: { id: true, name: true, email: true, contactNumber: true },
            },
          },
        },
        fileUploads: true,
      },
    });

    if (cateringRequest) {
      existingOrder = { ...cateringRequest, order_type: "catering" };
      orderType = 'catering';
    } else {
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: order_number, mode: 'insensitive' },
          deletedAt: null,
        },
        include: {
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: { id: true, name: true, email: true, contactNumber: true },
              },
            },
          },
          fileUploads: true,
        },
      });

      if (onDemandOrder) {
        existingOrder = { ...onDemandOrder, order_type: "on_demand" };
        orderType = 'on_demand';
      }
    }

    if (!existingOrder) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // For full field updates (not just status), check permissions and terminal status
    if (hasFieldUpdates) {
      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('type')
        .eq('id', user.id)
        .single();

      if (!profile?.type || !ORDER_EDIT_ROLES.includes(profile.type)) {
        return NextResponse.json(
          { message: "Insufficient permissions to edit orders" },
          { status: 403 }
        );
      }

      // Check if order is in a terminal status
      if (isTerminalStatus(existingOrder.status)) {
        return NextResponse.json(
          { message: `Cannot edit order with status: ${existingOrder.status}. Orders that are completed, delivered, or cancelled cannot be modified.` },
          { status: 400 }
        );
      }
    }

    // Validate update fields based on order type
    let validatedFields: Record<string, unknown> = {};
    if (hasFieldUpdates) {
      const schema = orderType === 'catering' ? cateringUpdateSchema : onDemandUpdateSchema;
      const result = schema.safeParse(updateFields);

      if (!result.success) {
        return NextResponse.json(
          { message: "Validation error", errors: result.error.flatten() },
          { status: 400 }
        );
      }
      validatedFields = result.data as Record<string, unknown>;
    }

    // Build the update data
    const updateData: Record<string, unknown> = {};

    // Add status updates if provided
    if (status) updateData.status = status;
    if (driverStatus) {
      updateData.driverStatus = driverStatus;

      // Automatically sync order status based on driver status transitions
      // This ensures the order status reflects the delivery progress
      const mappedOrderStatus = DRIVER_STATUS_TO_ORDER_STATUS[driverStatus];
      if (mappedOrderStatus && !status) {
        // Only auto-update order status if not explicitly provided
        updateData.status = mappedOrderStatus;
      }
    }

    // Handle field updates
    if (hasFieldUpdates) {
      // Handle address updates separately
      const { pickupAddress, deliveryAddress, pickupAddressId, deliveryAddressId, ...otherFields } = validatedFields;

      // Add other fields to update data
      for (const [key, value] of Object.entries(otherFields)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      // Handle pickup address update
      if (pickupAddress) {
        const existingPickupId = (existingOrder as any).pickupAddressId;
        const newPickupId = await upsertAddress(pickupAddress as AddressUpdate, existingPickupId);
        if (newPickupId !== existingPickupId) {
          updateData.pickupAddressId = newPickupId;
        }
      } else if (pickupAddressId) {
        updateData.pickupAddressId = pickupAddressId;
      }

      // Handle delivery address update
      if (deliveryAddress) {
        const existingDeliveryId = (existingOrder as any).deliveryAddressId;
        const newDeliveryId = await upsertAddress(deliveryAddress as AddressUpdate, existingDeliveryId);
        if (newDeliveryId !== existingDeliveryId) {
          updateData.deliveryAddressId = newDeliveryId;
        }
      } else if (deliveryAddressId) {
        updateData.deliveryAddressId = deliveryAddressId;
      }
    }

    // Detect significant changes for notification
    let changes: FieldChange[] = [];
    if (hasFieldUpdates) {
      changes = detectSignificantChanges(existingOrder as unknown as Record<string, unknown>, validatedFields);
    }

    // Perform the update
    let updatedOrder: Order | null = null;

    if (orderType === 'catering') {
      const updated = await prisma.cateringRequest.update({
        where: { orderNumber: order_number },
        data: updateData as any,
        include: {
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: { id: true, name: true, email: true, contactNumber: true },
              },
            },
          },
          fileUploads: true,
        },
      });
      updatedOrder = { ...updated, order_type: "catering" };
    } else {
      const updated = await prisma.onDemand.update({
        where: { orderNumber: order_number },
        data: updateData as any,
        include: {
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: { id: true, name: true, email: true, contactNumber: true },
              },
            },
          },
          fileUploads: true,
        },
      });
      updatedOrder = { ...updated, order_type: "on_demand" };
    }

    if (updatedOrder) {
      // Send notifications for driver status updates (non-blocking)
      if (driverStatus) {
        const dispatchStatus = DRIVER_STATUS_TO_DISPATCH_STATUS[driverStatus];
        const dispatch = (updatedOrder as any).dispatches?.[0];

        if (dispatchStatus && dispatch) {
          const orderId = (updatedOrder as any).id;
          const dispatchId = dispatch.id;

          // Send customer notification for relevant statuses
          if (CUSTOMER_NOTIFICATION_STATUSES.includes(driverStatus as DriverStatus)) {
            sendDispatchStatusNotification({
              status: dispatchStatus,
              dispatchId,
              orderId,
              recipientType: 'CUSTOMER',
            }).catch((err) => {
              console.error('Failed to send customer notification:', err);
            });
          }

          // Send admin notification for relevant statuses
          if (ADMIN_NOTIFICATION_STATUSES.includes(driverStatus as DriverStatus)) {
            sendDispatchStatusNotification({
              status: dispatchStatus,
              dispatchId,
              orderId,
              recipientType: 'ADMIN',
            }).catch((err) => {
              console.error('Failed to send admin notification:', err);
            });
          }
        }
      }

      // Send customer notification for significant field changes (non-blocking)
      if (hasFieldUpdates && hasSignificantChanges(changes)) {
        const customerEmail = (updatedOrder as any).user?.email;
        const customerName = (updatedOrder as any).user?.name || 'Customer';

        if (customerEmail) {
          // Import dynamically to avoid circular dependencies
          import('@/services/notifications/order-update').then(({ sendOrderUpdateNotification }) => {
            sendOrderUpdateNotification({
              order: updatedOrder as any,
              changes,
              customerEmail,
              customerName,
            }).catch((err) => {
              console.error('Failed to send order update notification:', err);
            });
          }).catch((err) => {
            console.error('Failed to import order update notification service:', err);
          });
        }
      }

      const serializedOrder = serializeOrder(updatedOrder);
      return NextResponse.json(serializedOrder);
    }

    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { message: "Error updating order", error: (error as Error).message },
      { status: 500 },
    );
  }
}