import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth-middleware";
import {
  customerOrderEditSchema,
  getCustomerEditBlockReason,
  CUSTOMER_EDIT_ROLES,
  CUSTOMER_EDITABLE_ORDER_STATUSES,
  leavesCateringPairEmpty,
  CATERING_PAIR_MESSAGE,
} from "@/lib/orders/customer-order-edit";
import { runAfterResponse } from "@/lib/api/after-response";
import {
  notifyOrderEditedByCustomer,
  type FieldChange,
} from "@/services/orders/notifyOrderEditedByCustomer";

type CateringRequest = any;
type OnDemandOrder = any;
type Order =
  | (CateringRequest & { order_type: "catering" })
  | (OnDemandOrder & { order_type: "on_demand" });

function serializeBigInt(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value === null ? null : value,
    ),
  );
}

// Normalize Prisma order shape to the client-facing snake_case structure
function normalizeOrderForClient(order: Order) {
  const isCatering = order.order_type === "catering";

  const driverStatus = (order as any).driverStatus
    ? String((order as any).driverStatus).toLowerCase()
    : null;

  const normalized = {
    id: order.id,
    order_number: (order as any).orderNumber,
    order_type: order.order_type,
    date: (order as any).pickupDateTime ?? (order as any).createdAt ?? null,
    status: String((order as any).status).toLowerCase(),
    driver_status: driverStatus,
    order_total: ((order as any).orderTotal ?? 0).toString(),
    special_notes: (order as any).specialNotes ?? null,
    address: order.pickupAddress
      ? {
          street1: order.pickupAddress.street1 ?? null,
          city: order.pickupAddress.city ?? null,
          state: order.pickupAddress.state ?? null,
          zip: (order.pickupAddress as any).zip ?? null,
        }
      : null,
    delivery_address: order.deliveryAddress
      ? {
          street1: order.deliveryAddress.street1 ?? null,
          city: order.deliveryAddress.city ?? null,
          state: order.deliveryAddress.state ?? null,
          zip: (order.deliveryAddress as any).zip ?? null,
        }
      : null,
    dispatch: Array.isArray((order as any).dispatches)
      ? (order as any).dispatches.map((d: any) => ({
          driver: d?.driver
            ? {
                id: d.driver.id,
                name: d.driver.name ?? null,
                email: d.driver.email ?? null,
                contact_number: d.driver.contactNumber ?? null,
              }
            : null,
        }))
      : [],
    user_id: (order as any).userId,
    pickup_time: (order as any).pickupDateTime ?? null,
    arrival_time: (order as any).arrivalDateTime ?? null,
    complete_time: (order as any).completeDateTime ?? null,
    updated_at: (order as any).updatedAt ?? null,
    ...(isCatering ? { headcount: (order as any).headcount ?? null } : {}),
  };

  return serializeBigInt(normalized);
}

export async function GET(req: NextRequest, props: { params: Promise<{ order_number: string }> }) {
  const params = await props.params;
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check authentication
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { order_number: encodedOrderNumber } = params;
    const order_number = decodeURIComponent(encodedOrderNumber);

    let order: Order | null = null;

    // Try to find catering request (case-insensitive + soft delete + ownership filter)
    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: order_number, mode: 'insensitive' },
        userId: user.id,
        deletedAt: null,
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
      },
    });

    if (cateringRequest) {
      order = {
        ...cateringRequest,
        order_type: "catering",
      };
    } else {
      // If not found, try to find on-demand order (case-insensitive + soft delete + ownership filter)
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: order_number, mode: 'insensitive' },
          userId: user.id,
          deletedAt: null,
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
        },
      });

      if (onDemandOrder) {
        order = { ...onDemandOrder, order_type: "on_demand" };
      }
    }

    if (order) {
      const normalized = normalizeOrderForClient(order);

      // Enrich with delivery stage timestamps from the Delivery tracking model.
      // Use the actual DB order number to ensure case-sensitive match.
      const dbOrderNumber = (order as any).orderNumber as string;
      try {
        const delivery = await prisma.delivery.findFirst({
          where: { orderNumber: { equals: dbOrderNumber, mode: 'insensitive' } },
          select: {
            assignedAt: true,
            enRouteToVendorAt: true,
            arrivedAtVendorAt: true,
            pickedUpAt: true,
            enRouteAt: true,
            arrivedAtClientAt: true,
            deliveredAt: true,
          },
        });

        if (delivery) {
          const toISO = (d: Date | null) => d?.toISOString() ?? null;
          normalized.deliveryTimestamps = {
            assignedAt: toISO(delivery.assignedAt),
            enRouteToVendorAt: toISO(delivery.enRouteToVendorAt),
            arrivedAtVendorAt: toISO(delivery.arrivedAtVendorAt),
            pickedUpAt: toISO(delivery.pickedUpAt),
            enRouteAt: toISO(delivery.enRouteAt),
            arrivedAtClientAt: toISO(delivery.arrivedAtClientAt),
            deliveredAt: toISO(delivery.deliveredAt),
          };
        }
      } catch (deliveryError) {
        console.warn('Failed to fetch delivery timestamps:', deliveryError);
      }

      return NextResponse.json(normalized);
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

// ---------------------------------------------------------------------------
// PATCH — customer edits headcount / orderTotal on their own catering order
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ order_number: string }> },
) {
  try {
    const params = await props.params;

    // 1. Auth + role check
    const auth = await withAuth(req, {
      allowedRoles: [...CUSTOMER_EDIT_ROLES],
      requireAuth: true,
    });
    if (!auth.success) return auth.response!;
    const { user } = auth.context;

    // 2. Parse & validate body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = customerOrderEditSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 3. Load the order (ownership enforced in the query)
    const orderNumber = decodeURIComponent(params.order_number);
    const existing = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: "insensitive" },
        userId: user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        driverStatus: true,
        headcount: true,
        orderTotal: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 },
      );
    }

    // 4. Editability check
    const blockReason = getCustomerEditBlockReason(
      {
        order_type: "catering",
        userId: existing.userId,
        status: String(existing.status),
        driverStatus: existing.driverStatus
          ? String(existing.driverStatus)
          : null,
      },
      user.id,
    );

    if (blockReason) {
      const message =
        blockReason === "DRIVER_ASSIGNED"
          ? "A driver is already assigned to this order. Please contact Ready Set for changes."
          : "This order can no longer be edited";
      return NextResponse.json(
        { code: "ORDER_NOT_EDITABLE", message },
        { status: 409 },
      );
    }

    // 5. Pair rule
    if (leavesCateringPairEmpty(existing, parsed.data)) {
      return NextResponse.json(
        { message: CATERING_PAIR_MESSAGE },
        { status: 400 },
      );
    }

    // 6. Build the data object — only changed fields
    const data: { headcount?: number | null; orderTotal?: number | null } = {};
    if (parsed.data.headcount !== undefined) {
      if (parsed.data.headcount !== existing.headcount) {
        data.headcount = parsed.data.headcount;
      }
    }
    if (parsed.data.orderTotal !== undefined) {
      const storedTotal =
        existing.orderTotal != null ? Number(existing.orderTotal) : null;
      if (parsed.data.orderTotal !== storedTotal) {
        data.orderTotal = parsed.data.orderTotal;
      }
    }

    // No actual changes — return current values without writing
    if (Object.keys(data).length === 0) {
      return NextResponse.json({
        orderNumber: existing.orderNumber,
        headcount: existing.headcount,
        orderTotal:
          existing.orderTotal != null
            ? String(existing.orderTotal)
            : null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 7. Build audit rows (one per changed field)
    const formatAuditValue = (
      field: string,
      value: number | null | undefined,
    ): string | null => {
      if (value == null) return null;
      return field === "orderTotal" ? value.toFixed(2) : String(value);
    };

    const auditRows: {
      cateringRequestId: string;
      editedBy: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    if (data.headcount !== undefined) {
      auditRows.push({
        cateringRequestId: existing.id,
        editedBy: user.id,
        field: "headcount",
        oldValue: formatAuditValue("headcount", existing.headcount),
        newValue: formatAuditValue("headcount", data.headcount),
      });
    }
    if (data.orderTotal !== undefined) {
      auditRows.push({
        cateringRequestId: existing.id,
        editedBy: user.id,
        field: "orderTotal",
        oldValue: formatAuditValue(
          "orderTotal",
          existing.orderTotal != null ? Number(existing.orderTotal) : null,
        ),
        newValue: formatAuditValue("orderTotal", data.orderTotal),
      });
    }

    // 8. Atomic write — interactive transaction so audit rows are committed
    //    with the update or not at all. Compare-and-swap: old values of
    //    changed fields are in the WHERE clause so a concurrent edit causes
    //    count=0 instead of logging a stale "old" value.
    const casWhere: Prisma.CateringRequestWhereInput = {
      id: existing.id,
      userId: user.id,
      deletedAt: null,
      status: { in: [...CUSTOMER_EDITABLE_ORDER_STATUSES] },
      driverStatus: null,
    };
    if (data.headcount !== undefined) {
      casWhere.headcount = existing.headcount;
    }
    if (data.orderTotal !== undefined) {
      casWhere.orderTotal = existing.orderTotal;
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { count } = await tx.cateringRequest.updateMany({
        where: casWhere,
        data,
      });
      if (count === 0) return { written: false as const };

      await tx.orderEditHistory.createMany({ data: auditRows });
      return { written: true as const };
    });

    if (!result.written) {
      return NextResponse.json(
        { code: "ORDER_NOT_EDITABLE", message: "This order can no longer be edited" },
        { status: 409 },
      );
    }

    // 9. Re-read the updated values
    const updated = await prisma.cateringRequest.findFirst({
      where: { id: existing.id },
      select: {
        orderNumber: true,
        headcount: true,
        orderTotal: true,
        updatedAt: true,
      },
    });

    // 10. Notify ops (after response, best-effort)
    const changes: FieldChange[] = [];
    if (data.headcount !== undefined) {
      changes.push({
        field: "headcount",
        label: "Headcount",
        oldValue: existing.headcount != null ? String(existing.headcount) : "—",
        newValue: data.headcount != null ? String(data.headcount) : "—",
      });
    }
    if (data.orderTotal !== undefined) {
      const oldTotal =
        existing.orderTotal != null ? `$${Number(existing.orderTotal).toFixed(2)}` : "—";
      const newTotal =
        data.orderTotal != null ? `$${Number(data.orderTotal).toFixed(2)}` : "—";
      changes.push({
        field: "orderTotal",
        label: "Order Total ($)",
        oldValue: oldTotal,
        newValue: newTotal,
      });
    }

    if (changes.length > 0) {
      runAfterResponse("customer-order-edit-notification", () =>
        notifyOrderEditedByCustomer({
          orderNumber: existing.orderNumber,
          editorName: existing.user?.name ?? "Unknown",
          editorEmail: existing.user?.email ?? user.email ?? "unknown",
          editorRole: user.type,
          changes,
        }),
      );
    }

    return NextResponse.json({
      orderNumber: updated?.orderNumber ?? existing.orderNumber,
      headcount: updated?.headcount ?? null,
      orderTotal:
        updated?.orderTotal != null ? String(updated.orderTotal) : null,
      updatedAt: updated?.updatedAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating order:", error);
    Sentry.captureException(error, {
      tags: { operation: "customer-order-edit" },
    });
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}