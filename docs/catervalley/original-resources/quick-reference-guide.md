# CaterValley Integration - Quick Reference Guide

## Common Operations

### 1. Testing API Endpoints with cURL

#### Draft Order
```bash
curl -X POST https://readysetllc.com/api/cater-valley/orders/draft \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: ready-set" \
  -d '{
    "orderCode": "ABC1234",
    "deliveryAddress": {
      "name": "John Doe",
      "address": "2835 Augustine Drive",
      "city": "Santa Clara",
      "state": "CA"
    },
    "pickupLocation": {
      "name": "Great Indian Cuisine",
      "address": "3026 Agnew Rd",
      "city": "Santa Clara",
      "state": "CA"
    },
    "deliveryTime": "11:00",
    "priceTotal": 173.87,
    "items": [
      {
        "name": "Rice Bowl VT202",
        "quantity": 1,
        "price": 173.87
      }
    ]
  }'
```

#### Update Order
```bash
curl -X POST https://readysetllc.com/api/cater-valley/orders/update \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: ready-set" \
  -d '{
    "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
    "orderCode": "ABC1234",
    "priceTotal": 238.74
  }'
```

#### Confirm Order
```bash
curl -X POST https://readysetllc.com/api/cater-valley/orders/confirm \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: ready-set" \
  -d '{
    "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
    "orderCode": "ABC1234"
  }'
```

#### Status Check
```bash
curl https://readysetllc.com/api/cater-valley/status
```

### 2. Sending Status Updates (Webhook)

```typescript
// Send webhook when driver picks up order
import { updateOrderStatus } from "@/lib/catervalley/webhook";

const result = await updateOrderStatus(
  "CV-ABC1234", // CaterValley order number
  orderId, // ReadySet internal order ID
  "PICKED_UP",
  {
    driverInfo: {
      name: "John Driver",
      phone: "+1-555-123-4567",
    },
    location: {
      latitude: 37.3541,
      longitude: -121.9552,
    },
    notes: "Order picked up from restaurant",
  }
);

if (!result.success) {
  console.error("Failed to send webhook:", result.error);
}
```

### 3. Database Queries

#### Get Order by ID
```typescript
import { getOrderById } from "@/lib/catervalley/database";

const order = await getOrderById(orderId);
if (!order) {
  throw new Error("Order not found");
}

console.log(order.orderNumber, order.status, order.deliveryPrice);
```

#### Get Order by Order Number
```typescript
import { getOrderByOrderNumber } from "@/lib/catervalley/database";

const order = await getOrderByOrderNumber("CV-ABC1234");
```

#### Add Status Update
```typescript
import { addStatusUpdate } from "@/lib/catervalley/database";

await addStatusUpdate({
  orderId: order.id,
  status: "ON_THE_WAY",
  timestamp: new Date(),
  location: { latitude: 37.3541, longitude: -121.9552 },
  notes: "Driver is en route to delivery location",
});
```

### 4. Time Conversion

```typescript
import { convertLocalToUTC, convertUTCToLocal } from "@/lib/catervalley/time";

// Convert local time to UTC
const deliveryTimeUTC = convertLocalToUTC("11:00"); // Pacific Time
console.log(deliveryTimeUTC.toISOString()); // "2025-06-11T18:00:00.000Z" (or 19:00 during DST)

// Convert UTC back to local
const localTime = convertUTCToLocal(deliveryTimeUTC);
console.log(localTime); // "11:00"
```

### 5. Pricing Calculation

```typescript
import { calculatePricing, validatePricing } from "@/lib/catervalley/pricing";

// Calculate pricing
const result = await calculatePricing({
  priceTotal: 350.0,
  deliveryTime: "12:00", // Peak time
  headCount: 35,
  pickupLocation: {
    address: "123 Restaurant St",
    city: "San Jose",
    state: "CA",
  },
  deliveryAddress: {
    address: "456 Customer Ave",
    city: "San Jose",
    state: "CA",
  },
});

if (result.success) {
  // ALWAYS enforce minimum fee
  const finalPrice = Math.max(42.5, result.deliveryPrice);
  console.log("Delivery Price:", finalPrice);
  console.log("Breakdown:", result.breakdown);
}
```

### 6. Authentication Validation

```typescript
import { validateCaterValleyAuth } from "@/lib/catervalley/auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const authResult = validateCaterValleyAuth(request.headers);
  
  if (!authResult.valid) {
    return NextResponse.json(
      {
        error: true,
        message: "Invalid authentication",
        code: "INVALID_AUTHENTICATION",
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }
  
  // Continue with request processing
}
```

### 7. Logging Best Practices

```typescript
// Always include context in logs
console.log("[CaterValley Draft]", {
  orderCode: "ABC1234",
  id: orderId,
  deliveryPrice: 48.87,
  peakTime: true,
});

// Error logging
console.error("[CaterValley Error]", {
  operation: "draft_order",
  orderCode: "ABC1234",
  error: error.message,
  stack: error.stack,
});

// Webhook logging
console.log("[Webhook Delivery]", {
  orderNumber: "CV-ABC1234",
  status: "PICKED_UP",
  attempt: 1,
  success: true,
});
```

### 8. Testing Minimum Fee Enforcement

```typescript
// Test case: Order with low food cost
const testOrder = {
  priceTotal: 22.0, // Low cost
  deliveryTime: "14:00", // Non-peak
  // ... other fields
};

const result = await calculatePricing(testOrder);

// Should calculate something lower, but API enforces minimum
const calculatedPrice = result.deliveryPrice; // e.g., 35.0
const enforcedPrice = Math.max(42.5, calculatedPrice); // 42.5

console.assert(enforcedPrice >= 42.5, "Minimum fee not enforced!");
```

### 9. Error Handling Patterns

```typescript
try {
  const order = await createDraftOrder(data);
  return NextResponse.json({ success: true, order });
} catch (error) {
  console.error("[Order Creation Error]", error);
  
  // Return structured error
  return NextResponse.json(
    {
      error: true,
      message: "Failed to create order",
      code: "DATABASE_ERROR",
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === "development" 
        ? { error: String(error) }
        : undefined,
    },
    { status: 500 }
  );
}
```

### 10. Webhook Retry Logic

```typescript
// Automatic retry with exponential backoff
import { sendStatusUpdateWebhook } from "@/lib/catervalley/webhook";

const payload = {
  orderNumber: "CV-ABC1234",
  status: "DELIVERED" as const,
  timestamp: new Date().toISOString(),
};

const result = await sendStatusUpdateWebhook(payload, orderId);

if (!result.success) {
  // Log failure, but don't throw - retries handled internally
  console.error("Webhook failed after all retries:", result.error);
  
  // Could add to retry queue here for later processing
  // await addToRetryQueue(payload, orderId);
}
```

## Debugging Tips

### Check Order Status
```sql
-- In database
SELECT 
  id,
  "orderNumber",
  status,
  "deliveryPrice",
  "totalPrice",
  "createdAt",
  "confirmedAt"
FROM cater_valley_orders
WHERE "orderCode" = 'ABC1234'
ORDER BY "createdAt" DESC;
```

### Check Webhook Logs
```sql
SELECT 
  "orderNumber",
  status,
  success,
  attempt,
  "httpStatus",
  error,
  "createdAt"
FROM cater_valley_webhook_logs
WHERE "orderNumber" = 'CV-ABC1234'
ORDER BY "createdAt" DESC;
```

### Check Status History
```sql
SELECT 
  o."orderNumber",
  s.status,
  s.timestamp,
  s.notes
FROM cater_valley_status_updates s
JOIN cater_valley_orders o ON s."orderId" = o.id
WHERE o."orderNumber" = 'CV-ABC1234'
ORDER BY s.timestamp DESC;
```

### Verify Minimum Fee Enforcement
```sql
-- Find any orders below minimum fee (should be NONE)
SELECT 
  "orderNumber",
  "orderCode",
  "deliveryPrice",
  "priceTotal",
  "totalPrice",
  "createdAt"
FROM cater_valley_orders
WHERE "deliveryPrice" < 42.50
ORDER BY "createdAt" DESC;
```

### Check Peak Time Orders
```sql
-- Orders during peak hours
SELECT 
  "orderNumber",
  "deliveryTime",
  "deliveryPrice",
  breakdown->>'peakTimeMultiplier' as peak_multiplier
FROM cater_valley_orders
WHERE breakdown->>'peakTimeMultiplier' IS NOT NULL
ORDER BY "createdAt" DESC;
```

## Common Issues & Solutions

### Issue: Order shows $35 instead of $42.50
**Cause**: Minimum fee not enforced  
**Solution**: Check that this line exists:
```typescript
const finalDeliveryPrice = Math.max(42.5, pricingResult.deliveryPrice);
```

### Issue: Times showing in local format instead of UTC
**Cause**: Missing Z suffix in ISO string  
**Solution**: Use `.toISOString()` which includes Z:
```typescript
estimatedPickupTime: pickupTime.toISOString() // "2025-06-11T17:15:00.000Z"
```

### Issue: Webhook not delivering
**Cause**: Network issues or wrong URL  
**Solution**: Check webhook logs and verify URL:
```typescript
console.log("Webhook URL:", process.env.CATERVALLEY_WEBHOOK_URL);
// Should be: https://api.catervalley.com/api/operation/order/update-order-status
```

### Issue: Authentication failing
**Cause**: Missing or incorrect headers  
**Solution**: Verify all three headers:
```typescript
headers: {
  "Content-Type": "application/json",
  "partner": "catervalley",
  "x-api-key": "ready-set"
}
```

## Monitoring Queries

### Daily Order Volume
```sql
SELECT 
  DATE("createdAt") as order_date,
  COUNT(*) as total_orders,
  SUM("totalPrice") as total_revenue
FROM cater_valley_orders
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE("createdAt")
ORDER BY order_date DESC;
```

### Webhook Success Rate
```sql
SELECT 
  DATE("createdAt") as log_date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM cater_valley_webhook_logs
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("createdAt")
ORDER BY log_date DESC;
```

### Average Delivery Price
```sql
SELECT 
  AVG("deliveryPrice") as avg_delivery_price,
  MIN("deliveryPrice") as min_delivery_price,
  MAX("deliveryPrice") as max_delivery_price,
  COUNT(*) as order_count
FROM cater_valley_orders
WHERE "createdAt" >= NOW() - INTERVAL '30 days';
```

## Quick Troubleshooting Steps

1. **Check API is accessible**: `curl https://readysetllc.com/api/cater-valley/status`
2. **Check database connection**: Run status endpoint and verify `services.database: "connected"`
3. **Check webhook URL**: Verify environment variable is correct
4. **Check logs**: Look for error messages in application logs
5. **Check database**: Query orders table for the order in question
6. **Test authentication**: Try API call with correct/incorrect headers
7. **Contact CaterValley**: If webhook issues, verify their endpoint is up

## Support Escalation

1. **Level 1**: Check application logs and database
2. **Level 2**: Review webhook delivery logs
3. **Level 3**: Contact Emmanuel (ealanis@readysetllc.com)
4. **Level 4**: Coordinate with CaterValley team (halil@catervalley.com)
