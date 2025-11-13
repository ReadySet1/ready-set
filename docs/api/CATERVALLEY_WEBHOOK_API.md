# CaterValley Webhook API Documentation

## Overview

The CaterValley webhook API handles order status updates from CaterValley's system.

## Endpoints

### POST `/api/cater-valley/orders/draft`

Create a draft order from CaterValley.

**Authentication**: Required (API key in headers)

**Headers**:
- `Content-Type`: `application/json`
- `partner`: `catervalley`
- `x-api-key`: `ready-set`

**Request**:
```json
{
  "orderId": "CV-12345",
  "headcount": 50,
  "pickupAddress": {...},
  "deliveryAddress": {...},
  "pickupTime": "2025-01-15T10:00:00-08:00",
  "foodCost": 500.00
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "CV-12345",
  "deliveryCost": 85.50,
  "deliveryDistance": 12.5
}
```

### POST `/api/cater-valley/orders/update`

Update an existing order.

**Authentication**: Required (API key in headers)

**Headers**: Same as draft endpoint

**Request**: Partial order data

**Response**: Updated order with recalculated pricing

## Pricing Rules

- **Minimum Delivery Fee**: $42.50 (enforced)
- **Mileage Rate**: $1.10 per mile after 10 miles
- **Tiered Pricing**: Based on headcount and food cost
- **Distance Calculation**: Uses Google Maps API

## Environment Variables

- `CATERVALLEY_WEBHOOK_URL`: Webhook URL for sending updates to CaterValley (optional, has default)
- `CATERVALLEY_API_KEY`: API key for authentication (optional)
- `GOOGLE_MAPS_API_KEY`: Required for distance calculations

## Related Issues

- CaterValley delivery fee fixes
- Delivery cost/distance transparency

