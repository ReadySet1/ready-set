# CaterValley API Integration - Official Contract Specification

**Status:** ✅ Production Ready
**Last Updated:** 2025-11-10
**Version:** 1.0

> **IMPORTANT:** This document describes the ACTUAL production API contract. Any other reference documentation showing different field names is outdated or incorrect.

---

## Overview

The CaterValley integration provides three REST API endpoints for receiving catering orders from CaterValley's platform. Orders flow through three stages: Draft → Update → Confirm.

**Base URL:** `https://readysetllc.com/api/cater-valley`

---

## Authentication

All requests must include these headers:

```typescript
{
  "Content-Type": "application/json",
  "partner": "catervalley",
  "x-api-key": "ready-set"
}
```

**Authentication Failure Response:**
```json
{
  "status": "ERROR",
  "message": "Invalid authentication credentials"
}
```

---

## Endpoint 1: Draft Order

**Purpose:** Create initial order and receive pricing quote

**URL:** `POST /orders/draft`

### Request Schema

```typescript
{
  // Required: Order identification
  orderCode: string;              // CaterValley order code (e.g., "ABC1234")

  // Required: Scheduling
  deliveryDate: string;           // Format: "YYYY-MM-DD" (e.g., "2025-10-30")
  deliveryTime: string;           // Format: "HH:MM" (e.g., "11:00")

  // Required: Order details
  totalItem: number;              // Headcount (number of people)
  priceTotal: number;             // Total food cost in USD

  // Required: Pickup location
  pickupLocation: {
    name: string;                 // Restaurant/vendor name
    address: string;              // Street address
    city: string;                 // City name
    state: string;                // Two-letter state code (e.g., "CA")
    zip?: string;                 // Optional: ZIP code
    phone?: string;               // Optional: Phone number
  };

  // Required: Delivery location (NOT "deliveryAddress")
  dropOffLocation: {
    name: string;                 // Location name
    address: string;              // Street address
    city: string;                 // City name
    state: string;                // Two-letter state code
    zip?: string;                 // Optional: ZIP code
    instructions?: string;        // Optional: Delivery instructions
    recipient: {
      name: string;               // Recipient contact name
      phone: string;              // Recipient phone (min 10 digits)
    };
  };

  // Optional: Additional metadata
  metadata?: Record<string, unknown>;
}
```

### Important Field Notes

1. **`dropOffLocation` vs `deliveryAddress`**: We use `dropOffLocation` (NOT `deliveryAddress`)
2. **`totalItem` vs `headCount`**: We use `totalItem` for headcount (REQUIRED, not optional)
3. **No `items[]` array**: We don't track individual items, only `totalItem` and `priceTotal`
4. **`deliveryDate` is REQUIRED**: Not optional

### Response Schema

```typescript
{
  status: "SUCCESS" | "ERROR";
  message?: string;               // Present if ERROR

  // Pricing information (only if SUCCESS)
  orderId?: string;               // UUID for this order
  deliveryFee?: number;           // Calculated delivery fee (minimum $42.50)
  deliveryCost?: number;          // Base delivery cost before adjustments
  totalMileagePay?: number;       // Additional mileage charges
  totalFee?: number;              // Total: deliveryFee + priceTotal

  // Note: Bridge toll ($8) is NOT charged to CaterValley - it's driver compensation paid by Ready Set

  // Metadata
  distance?: number;              // Distance in miles
  numberOfBridges?: number;       // 0 or 1
  usedFallbackDistance?: boolean; // True if Google Maps API failed
}
```

### Example Request

```json
{
  "orderCode": "TEST-001",
  "deliveryDate": "2025-10-30",
  "deliveryTime": "11:00",
  "totalItem": 31,
  "priceTotal": 1500.00,
  "pickupLocation": {
    "name": "Great Indian Cuisine",
    "address": "3026 Agnew Rd",
    "city": "Santa Clara",
    "state": "CA",
    "zip": "95054",
    "phone": "408-555-0100"
  },
  "dropOffLocation": {
    "name": "Tech Office",
    "address": "2835 Augustine Drive",
    "city": "Santa Clara",
    "state": "CA",
    "zip": "95054",
    "instructions": "Leave at front desk",
    "recipient": {
      "name": "John Doe",
      "phone": "408-555-0200"
    }
  }
}
```

### Example Response (Success)

```json
{
  "status": "SUCCESS",
  "orderId": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "deliveryFee": 62.50,
  "deliveryCost": 62.50,
  "totalMileagePay": 0,
  "totalFee": 1562.50,
  "distance": 8.2,
  "numberOfBridges": 0,
  "usedFallbackDistance": false
}
```

### Example Response (Error)

```json
{
  "status": "ERROR",
  "message": "Invalid request payload: deliveryDate must match format YYYY-MM-DD"
}
```

---

## Endpoint 2: Update Order

**Purpose:** Modify an existing draft order and receive updated pricing

**URL:** `POST /orders/update`

### Request Schema

```typescript
{
  // Required: Identification
  id: string;                     // UUID returned from draft endpoint

  // Optional: All fields from draft endpoint
  // Only include fields that are changing
  orderCode?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  totalItem?: number;
  priceTotal?: number;
  pickupLocation?: { /* same structure */ };
  dropOffLocation?: { /* same structure */ };
  metadata?: Record<string, unknown>;
}
```

### Response Schema

Same as draft endpoint response.

### Example Request

```json
{
  "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "totalItem": 50,
  "priceTotal": 2000.00
}
```

---

## Endpoint 3: Confirm Order

**Purpose:** Finalize the order for dispatch

**URL:** `POST /orders/confirm`

### Request Schema

```typescript
{
  id: string;                     // UUID from draft/update responses
  isAccepted: boolean;            // True to confirm, false to reject
  reason?: string;                // Required if isAccepted is false
  metadata?: Record<string, unknown>;
}
```

### Response Schema

```typescript
{
  status: "SUCCESS" | "ERROR";
  message: string;

  // Present if SUCCESS
  orderNumber?: string;           // ReadySet order number (e.g., "CV-ABC1234")
  orderId?: string;               // UUID of the order
}
```

### Example Request (Confirm)

```json
{
  "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "isAccepted": true
}
```

### Example Request (Reject)

```json
{
  "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "isAccepted": false,
  "reason": "Customer requested cancellation"
}
```

### Example Response (Success)

```json
{
  "status": "SUCCESS",
  "message": "Order confirmed successfully",
  "orderNumber": "CV-ABC1234",
  "orderId": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b"
}
```

---

## Pricing Logic

### Minimum Delivery Fee

**CRITICAL:** All orders enforce a minimum delivery fee of **$42.50**

Even if calculated delivery cost is lower, the final `deliveryFee` will be at least $42.50.

### Pricing Tiers

Pricing is determined by the **LESSER** of headcount tier or food cost tier:

| Tier | Headcount Range | Food Cost Range | Within 10 Miles | Beyond 10 Miles |
|------|----------------|-----------------|-----------------|-----------------|
| 1 | 0-25 | $0-$300 | $42.50 | $85 + $3.00/mile |
| 2 | 26-49 | $300.01-$599.99 | $52.50 | $90 + $3.00/mile |
| 3 | 50-74 | $600-$899.99 | $62.50 | $110 + $3.00/mile |
| 4 | 75-99 | $900-$1,199.99 | $72.50 | $120 + $3.00/mile |
| 5 | 100+ | $1,200+ | 10% of food cost | 10% of food cost + $3.00/mile |

### Additional Charges

**Mileage:** $3.00 per mile beyond the tier's distance threshold (10 miles) - per official CaterValley Terms & Pricing Chart

**Note on Bridge Tolls:** Bridge crossings (e.g., San Francisco Bay) are auto-detected for internal tracking. The $8.00 bridge toll is driver compensation paid by Ready Set and is **NOT charged** to CaterValley customers.

### Pricing Examples

**Example 1: Small order**
- Headcount: 15 (Tier 1)
- Food Cost: $150 (Tier 1)
- Distance: 8 miles
- **Delivery Fee:** $42.50 (Tier 1 within 10 miles)

**Example 2: Low food cost, but exceeds minimum**
- Headcount: 5 (Tier 1)
- Food Cost: $20 (Tier 1)
- Distance: 5 miles
- Calculated: $35 → **Delivery Fee: $42.50** (minimum enforced)

**Example 3: Large order**
- Headcount: 50 (Tier 3)
- Food Cost: $750 (Tier 3)
- Distance: 8 miles
- **Delivery Fee:** $62.50 (Tier 3 within 10 miles)

**Example 4: Long distance**
- Headcount: 30 (Tier 2)
- Food Cost: $400 (Tier 2)
- Distance: 15 miles
- Base: $90 + (5 miles × $3.00) = $90 + $15.00 = **$105.00**

**Example 5: Bridge crossing** (SF → Oakland)
- Headcount: 20 (Tier 1)
- Food Cost: $200 (Tier 1)
- Distance: 9 miles
- **Delivery Fee:** $42.50 (Tier 1 within 10 miles)
- Note: Bridge toll ($8) detected but NOT charged to CaterValley

---

## Error Codes

| Status Code | Message | Meaning |
|------------|---------|---------|
| 401 | Invalid authentication credentials | Missing or incorrect headers |
| 400 | Invalid request payload | Validation error (check message for details) |
| 404 | Order not found | Invalid order ID in update/confirm |
| 422 | Pricing calculation error | Failed to calculate delivery fee |
| 500 | Internal server error | Unexpected error (contact support) |

---

## Validation Rules

### Required Fields
- `orderCode`: Non-empty string
- `deliveryDate`: Must match `YYYY-MM-DD` format
- `deliveryTime`: Must match `HH:MM` format
- `totalItem`: Must be positive integer (≥ 1)
- `priceTotal`: Must be non-negative number (≥ 0)
- All location fields: `name`, `address`, `city`, `state` are required
- `dropOffLocation.recipient.name` and `phone` are required
- `dropOffLocation.recipient.phone`: Minimum 10 characters

### Optional Fields
- `pickupLocation.zip`, `pickupLocation.phone`
- `dropOffLocation.zip`, `dropOffLocation.instructions`
- `metadata`

### Field Constraints
- `state`: Must be 2-letter state code (e.g., "CA", "NY")
- `deliveryDate`: Cannot be in the past
- `totalItem`: Maximum value not enforced, but extremely high values may be flagged
- `priceTotal`: Maximum value not enforced

---

## Time Handling

### Input Times
- **Timezone:** Pacific Time (PT)
- **Format:** Local time without timezone suffix
- **Example:** `"11:00"` means 11:00 AM Pacific Time

### Output Times
- **Timezone:** UTC
- **Format:** ISO 8601 with Z suffix
- **Example:** `"2025-10-30T19:00:00.000Z"` (11:00 AM PT during DST)

### Daylight Saving Time
The API automatically handles DST conversions:
- During PST (winter): UTC offset is -08:00
- During PDT (summer): UTC offset is -07:00

---

## Database Mapping

Orders are stored in the `catering_requests` table:

| API Field | Database Column | Notes |
|-----------|----------------|-------|
| `orderId` | `id` | UUID primary key |
| `orderCode` | Part of `orderNumber` | Formatted as `CV-{orderCode}` |
| `totalItem` | `headcount` | Integer |
| `priceTotal` | `orderTotal` | Decimal |
| `deliveryFee` | Calculated, not stored directly | |
| `pickupLocation` | `pickupAddressId` | Foreign key to `addresses` |
| `dropOffLocation` | `deliveryAddressId` | Foreign key to `addresses` |
| `dropOffLocation.recipient.name` | `clientAttention` | String |
| `dropOffLocation.instructions` | `specialNotes` | Text |
| `deliveryDate` + `deliveryTime` | `arrivalDateTime` | Timestamp with timezone |
| Partner identifier | `brokerage` | Set to "CaterValley" |

---

## Integration Flow

```
1. CaterValley → POST /orders/draft
   ↓ Returns orderId + pricing

2. CaterValley → POST /orders/update (optional, if changes needed)
   ↓ Returns updated pricing

3. CaterValley → POST /orders/confirm
   ↓ Returns orderNumber

4. ReadySet assigns driver

5. ReadySet → CaterValley Webhook (status updates)
   - ASSIGNED
   - PICKED_UP
   - ON_THE_WAY
   - ARRIVED
   - DELIVERED
```

---

## Testing

### Test Scenarios

1. **Minimum Fee Enforcement**
   - Send order with `totalItem: 5`, `priceTotal: 20`
   - Verify response `deliveryFee >= 42.50`

2. **Tier Boundary**
   - Send order with `totalItem: 26`, `priceTotal: 350`
   - Verify Tier 2 pricing ($52.50 base)

3. **Large Order**
   - Send order with `totalItem: 150`, `priceTotal: 2500`
   - Verify Tier 5 percentage pricing (10% = $250)

4. **Update Flow**
   - Create draft order
   - Update with different `priceTotal`
   - Verify pricing recalculates correctly

5. **Confirm Flow**
   - Create draft order
   - Confirm with `isAccepted: true`
   - Verify `orderNumber` starts with "CV-"

### Test Credentials

Use the same authentication headers as production:
```
partner: catervalley
x-api-key: ready-set
```

---

## Production Status

**Deployment:** ✅ Live in production
**Orders Processed:** 20+ orders since Oct 27, 2025
**Latest Fix:** Nov 10, 2025 - Tier boundary overlap resolved
**Minimum Fee:** ✅ $42.50 enforcement active

---

## Support

**Technical Issues:**
- Emmanuel Alanis: ealanis@readysetllc.com

**CaterValley Team:**
- Halil Han Badem (CTO): halil@catervalley.com
- Ugras Bassullu: ugras@catervalley.com

---

## Changelog

### v1.0 (2025-11-10)
- Initial canonical documentation
- Documented actual production API contract
- Clarified field name differences from outdated reference docs
- Added pricing examples and validation rules
