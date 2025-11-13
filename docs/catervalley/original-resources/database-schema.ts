// prisma/schema-catervalley.prisma
// Add this to your existing Prisma schema

model CaterValleyOrder {
  id                      String   @id @default(uuid())
  orderCode               String   @unique // CaterValley's order code
  orderNumber             String?  @unique // ReadySet's order number (e.g., CV-ABC1234)
  
  // Order Status
  status                  CaterValleyOrderStatus @default(DRAFT)
  
  // Addresses
  deliveryAddress         Json // { name, address, city, state, zipCode }
  pickupLocation          Json // { name, address, city, state, zipCode }
  
  // Timing
  deliveryTime            DateTime
  estimatedPickupTime     DateTime
  estimatedDeliveryTime   DateTime?
  confirmedAt             DateTime?
  
  // Pricing
  priceTotal              Float // Food cost from CaterValley
  deliveryPrice           Float // Calculated delivery fee (min $42.50)
  totalPrice              Float // priceTotal + deliveryPrice
  breakdown               Json // PricingBreakdown object
  
  // Order Details
  items                   Json // OrderItem[]
  headCount               Int?
  specialInstructions     String?
  customerNotes           String?
  
  // Driver Assignment
  driverAssigned          String?
  driverInfo              Json?
  
  // Status History
  statusHistory           CaterValleyStatusUpdate[]
  
  // Timestamps
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  @@index([orderCode])
  @@index([orderNumber])
  @@index([status])
  @@index([deliveryTime])
  @@map("cater_valley_orders")
}

model CaterValleyStatusUpdate {
  id                      String   @id @default(uuid())
  orderId                 String
  order                   CaterValleyOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  status                  CourierStatus
  timestamp               DateTime
  location                Json? // { latitude, longitude, accuracy }
  notes                   String?
  driverInfo              Json?
  
  createdAt               DateTime @default(now())
  
  @@index([orderId])
  @@index([status])
  @@map("cater_valley_status_updates")
}

model CaterValleyWebhookLog {
  id                      String   @id @default(uuid())
  orderId                 String
  orderNumber             String
  
  status                  CourierStatus
  webhookUrl              String
  payload                 Json
  
  response                Json?
  httpStatus              Int?
  
  attempt                 Int
  maxAttempts             Int
  success                 Boolean
  error                   String?
  
  deliveredAt             DateTime?
  createdAt               DateTime @default(now())
  
  @@index([orderId])
  @@index([orderNumber])
  @@index([success])
  @@index([createdAt])
  @@map("cater_valley_webhook_logs")
}

enum CaterValleyOrderStatus {
  DRAFT
  CONFIRMED
  ASSIGNED
  IN_PROGRESS
  DELIVERED
  CANCELLED
}

enum CourierStatus {
  ASSIGNED
  PICKED_UP
  ON_THE_WAY
  ARRIVED
  DELIVERED
  CANCELLED
  FAILED
}

// lib/catervalley/database.ts (Prisma implementation examples)
import { PrismaClient } from "@prisma/client";
import {
  CaterValleyOrder,
  PricingBreakdown,
  OrderItem,
  CourierStatus,
  WebhookDeliveryLog,
} from "@/types/catervalley";

const prisma = new PrismaClient();

/**
 * Create a draft order
 */
export async function createDraftOrder(data: {
  orderCode: string;
  deliveryAddress: any;
  pickupLocation: any;
  deliveryTime: Date;
  estimatedPickupTime: Date;
  priceTotal: number;
  deliveryPrice: number;
  totalPrice: number;
  items: OrderItem[];
  breakdown: PricingBreakdown;
  headCount?: number;
  specialInstructions?: string;
  status: "DRAFT";
}): Promise<CaterValleyOrder> {
  const order = await prisma.caterValleyOrder.create({
    data: {
      orderCode: data.orderCode,
      deliveryAddress: data.deliveryAddress,
      pickupLocation: data.pickupLocation,
      deliveryTime: data.deliveryTime,
      estimatedPickupTime: data.estimatedPickupTime,
      priceTotal: data.priceTotal,
      deliveryPrice: data.deliveryPrice,
      totalPrice: data.totalPrice,
      items: data.items,
      breakdown: data.breakdown,
      headCount: data.headCount,
      specialInstructions: data.specialInstructions,
      status: data.status,
    },
  });

  return order as unknown as CaterValleyOrder;
}

/**
 * Update a draft order
 */
export async function updateDraftOrder(
  orderId: string,
  data: Partial<CaterValleyOrder>
): Promise<CaterValleyOrder> {
  const order = await prisma.caterValleyOrder.update({
    where: { id: orderId },
    data: {
      ...(data.deliveryAddress && { deliveryAddress: data.deliveryAddress }),
      ...(data.deliveryTime && { deliveryTime: data.deliveryTime }),
      ...(data.priceTotal !== undefined && { priceTotal: data.priceTotal }),
      ...(data.deliveryPrice !== undefined && {
        deliveryPrice: data.deliveryPrice,
      }),
      ...(data.totalPrice !== undefined && { totalPrice: data.totalPrice }),
      ...(data.items && { items: data.items }),
      ...(data.breakdown && { breakdown: data.breakdown }),
      ...(data.headCount !== undefined && { headCount: data.headCount }),
      ...(data.specialInstructions && {
        specialInstructions: data.specialInstructions,
      }),
      ...(data.estimatedPickupTime && {
        estimatedPickupTime: data.estimatedPickupTime,
      }),
    },
  });

  return order as unknown as CaterValleyOrder;
}

/**
 * Confirm an order
 */
export async function confirmOrder(
  orderId: string,
  data: {
    orderNumber: string;
    status: "CONFIRMED";
    confirmedAt: Date;
    estimatedDeliveryTime: Date;
    customerNotes?: string;
  }
): Promise<CaterValleyOrder> {
  const order = await prisma.caterValleyOrder.update({
    where: { id: orderId },
    data: {
      orderNumber: data.orderNumber,
      status: data.status,
      confirmedAt: data.confirmedAt,
      estimatedDeliveryTime: data.estimatedDeliveryTime,
      customerNotes: data.customerNotes,
    },
  });

  return order as unknown as CaterValleyOrder;
}

/**
 * Get order by ID
 */
export async function getOrderById(
  orderId: string
): Promise<CaterValleyOrder | null> {
  const order = await prisma.caterValleyOrder.findUnique({
    where: { id: orderId },
    include: {
      statusHistory: {
        orderBy: { timestamp: "desc" },
      },
    },
  });

  return order as unknown as CaterValleyOrder | null;
}

/**
 * Get order by order number
 */
export async function getOrderByOrderNumber(
  orderNumber: string
): Promise<CaterValleyOrder | null> {
  const order = await prisma.caterValleyOrder.findUnique({
    where: { orderNumber },
    include: {
      statusHistory: {
        orderBy: { timestamp: "desc" },
      },
    },
  });

  return order as unknown as CaterValleyOrder | null;
}

/**
 * Add status update to order
 */
export async function addStatusUpdate(data: {
  orderId: string;
  status: CourierStatus;
  timestamp: Date;
  location?: any;
  notes?: string;
  driverInfo?: any;
}) {
  return await prisma.caterValleyStatusUpdate.create({
    data,
  });
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: CourierStatus,
  additionalData?: {
    driverAssigned?: string;
    driverInfo?: any;
  }
) {
  await prisma.caterValleyOrder.update({
    where: { id: orderId },
    data: {
      status: status as any, // Map CourierStatus to CaterValleyOrderStatus
      ...additionalData,
    },
  });
}

/**
 * Log webhook delivery attempt
 */
export async function logWebhookDelivery(
  data: Omit<WebhookDeliveryLog, "id" | "createdAt">
) {
  await prisma.caterValleyWebhookLog.create({
    data: {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      status: data.status,
      webhookUrl: data.webhookUrl,
      payload: data.payload,
      response: data.response,
      httpStatus: data.httpStatus,
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      success: data.success,
      error: data.error,
      deliveredAt: data.success ? new Date() : undefined,
    },
  });
}

/**
 * Check database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("[Database Connection Error]", error);
    return false;
  }
}
