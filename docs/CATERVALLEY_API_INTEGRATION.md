# CaterValley API Integration

This document describes the API integration between Ready Set LLC and CaterValley for catering delivery services.

## Overview

Ready Set LLC provides delivery services for CaterValley's catering platform. This integration includes:

1. **Incoming API Endpoints**: CaterValley sends order data to Ready Set
2. **Outgoing Webhooks**: Ready Set sends status updates back to CaterValley
3. **Pricing Calculation**: Dynamic delivery pricing based on order parameters
4. **Status Management**: Real-time order status tracking with driver assignments

## API Endpoints

### 1. Create Draft Order

**Endpoint**: `POST /api/cater-valley/orders/draft`

Creates a new order draft with pricing calculation.

**Headers**:
```
Content-Type: application/json
partner: catervalley
x-api-key: your-api-key
```

**Request Body**:
```json
{
  "orderCode": "CV123456",
  "deliveryDate": "2024-01-15",
  "deliveryTime": "12:30",
  "totalItem": 25,
  "priceTotal": 450.00,
  "pickupLocation": {
    "name": "The Best Restaurant",
    "address": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701",
    "phone": "(512) 555-0123"
  },
  "dropOffLocation": {
    "name": "Corporate Office",
    "address": "456 Business Blvd",
    "city": "Austin", 
    "state": "TX",
    "zip": "78702",
    "instructions": "Call reception when arriving",
    "recipient": {
      "name": "John Smith",
      "phone": "(512) 555-0456"
    }
  }
}
```

**Response**:
```json
{
  "id": "uuid-order-id",
  "deliveryPrice": 50.00,
  "totalPrice": 500.00,
  "estimatedPickupTime": "2024-01-15T12:00:00.000Z",
  "status": "SUCCESS",
  "breakdown": {
    "basePrice": 42.5,
    "itemCountMultiplier": 1.0,
    "orderTotalMultiplier": 1.18,
    "peakTimeMultiplier": 1.15
  }
}
```

### 2. Update Draft Order

**Endpoint**: `POST /api/cater-valley/orders/update`

Updates an existing draft order and recalculates pricing.

**Request Body**:
```json
{
  "id": "uuid-order-id",
  "orderCode": "CV123456",
  "deliveryDate": "2024-01-15",
  "deliveryTime": "13:00",
  "totalItem": 30,
  "priceTotal": 550.00,
  "pickupLocation": { /* same structure as draft */ },
  "dropOffLocation": { /* same structure as draft */ }
}
```

### 3. Confirm Order

**Endpoint**: `POST /api/cater-valley/orders/confirm`

Confirms or cancels an order.

**Request Body**:
```json
{
  "id": "uuid-order-id",
  "isAccepted": true,
  "reason": "Optional cancellation reason if isAccepted is false"
}
```

**Response (Confirmed)**:
```json
{
  "id": "uuid-order-id",
  "orderNumber": "CV-CV123456",
  "status": "CONFIRMED",
  "message": "Order has been confirmed and is ready for dispatch",
  "estimatedDeliveryTime": "2024-01-15T13:15:00.000Z",
  "driverAssignment": {
    "expectedAssignmentTime": "2024-01-15T12:15:00.000Z",
    "trackingAvailable": true
  }
}
```

## Webhook System

Ready Set sends status updates to CaterValley via webhooks when driver status changes.

### Webhook Endpoint
CaterValley receives updates at: `https://api-courier.catervalley.com/api/order/update-order-status`

### Status Mapping

| Ready Set Driver Status | CaterValley Status | Description |
|------------------------|-------------------|-------------|
| `ASSIGNED` | `CONFIRM` | Driver assigned to order |
| `ARRIVED_AT_VENDOR` | `READY` | Driver arrived at pickup location |
| `EN_ROUTE_TO_CLIENT` | `ON_THE_WAY` | Driver heading to delivery |
| `ARRIVED_TO_CLIENT` | `ON_THE_WAY` | Driver at delivery location |
| `COMPLETED` | `COMPLETED` | Order delivered |

### Webhook Payload

```json
{
  "orderNumber": "CV123456",
  "status": "READY"
}
```

## Internal Status Management

### Update Order Status

**Endpoint**: `PATCH /api/catering-requests/{orderId}/status`

Internal endpoint for updating order status and triggering webhooks.

**Request Body**:
```json
{
  "driverStatus": "ARRIVED_AT_VENDOR",
  "driverId": "uuid-driver-id",
  "notes": "Driver checked in at restaurant",
  "location": {
    "latitude": 30.2672,
    "longitude": -97.7431
  }
}
```

**Response**:
```json
{
  "success": true,
  "order": {
    "id": "uuid-order-id",
    "orderNumber": "CV-CV123456",
    "status": "CONFIRMED",
    "driverStatus": "ARRIVED_AT_VENDOR",
    "updatedAt": "2024-01-15T12:05:00.000Z"
  },
  "webhookResults": {
    "caterValley": {
      "success": true,
      "attempts": 1
    }
  },
  "message": "Order status successfully updated to ARRIVED_AT_VENDOR"
}
```

## Pricing Structure

### Base Pricing
- **Base Price**: $42.50
- **25+ Items**: $50.00
- **$300+ Order Total**: $55.00

### Additional Charges
- **Distance**: $2.50 per mile over 15 miles
- **Peak Hours**: 15% surcharge (11:30 AM - 1:30 PM, 5:30 PM - 7:30 PM)
- **Weekends**: 10% surcharge

### Example Calculation

For an order with 30 items, $400 total, delivered on a weekday at 12:00 PM:
- Base: $55.00 (over $300 order total)
- Peak time: $55.00 × 1.15 = $63.25
- **Final Price**: $63.25

## Environment Configuration

Add these variables to your `.env` file:

```bash
# CaterValley Integration
CATERVALLEY_WEBHOOK_URL=https://api-courier.catervalley.com/api/order/update-order-status
CATERVALLEY_API_KEY=your-secure-api-key-here
```

## Database Schema Updates

The integration uses existing Prisma models with these considerations:

### CateringRequest
- `orderNumber`: Prefixed with "CV-" for CaterValley orders
- `brokerage`: Set to "CaterValley"
- `userId`: Links to system user (system@catervalley.com)

### Profile (System User)
A system user is automatically created for CaterValley orders:
```json
{
  "email": "system@catervalley.com",
  "name": "CaterValley System",
  "type": "CLIENT",
  "companyName": "CaterValley"
}
```

## Error Handling

### Common Error Responses

**400 Bad Request - Validation Error**:
```json
{
  "status": "ERROR",
  "message": "Validation failed",
  "details": {
    "deliveryTime": {
      "_errors": ["Invalid time format (HH:MM)"]
    }
  }
}
```

**401 Unauthorized**:
```json
{
  "status": "ERROR",
  "message": "Unauthorized - Invalid API key or partner header"
}
```

**409 Conflict - Duplicate Order**:
```json
{
  "status": "ERROR",
  "message": "Order with code CV123456 already exists"
}
```

**422 Unprocessable Entity - Business Logic Error**:
```json
{
  "status": "ERROR",
  "message": "Delivery time is not available - must be at least 2 hours in advance and within business hours (7 AM - 10 PM)"
}
```

## Testing

### Test Webhook Connectivity

```typescript
import { CaterValleyWebhookService } from '@/lib/services/caterValleyWebhookService';

const result = await CaterValleyWebhookService.testConnection();
console.log('Webhook connectivity:', result);
```

### Example API Calls

**Create Test Order**:
```bash
curl -X POST http://localhost:3000/api/cater-valley/orders/draft \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: your-api-key" \
  -d '{
    "orderCode": "TEST123",
    "deliveryDate": "2024-01-20",
    "deliveryTime": "14:00",
    "totalItem": 15,
    "priceTotal": 250.00,
    "pickupLocation": {
      "name": "Test Restaurant",
      "address": "123 Test St",
      "city": "Austin",
      "state": "TX"
    },
    "dropOffLocation": {
      "name": "Test Office",
      "address": "456 Test Ave",
      "city": "Austin",
      "state": "TX",
      "recipient": {
        "name": "Test User",
        "phone": "5125550123"
      }
    }
  }'
```

## Integration Flow

1. **CaterValley** creates draft order → **Ready Set** returns pricing
2. **CaterValley** may update order details → **Ready Set** recalculates pricing  
3. **CaterValley** confirms order → **Ready Set** queues for dispatch
4. **Ready Set** assigns driver → Webhook sent to **CaterValley** (`CONFIRM`)
5. Driver arrives at restaurant → Webhook sent (`READY`)
6. Driver en route to client → Webhook sent (`ON_THE_WAY`)
7. Driver completes delivery → Webhook sent (`COMPLETED`)

## Support

For integration support, contact Ready Set LLC technical team or refer to this documentation for implementation details. 