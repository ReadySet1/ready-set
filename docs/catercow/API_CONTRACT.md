# Ready Set — Partner Order API

**Audience:** CaterCow Engineering
**Status:** Draft for partner review
**Last Updated:** 2026-05-01
**Version:** 0.1 (proposed)

> This document is a proposal for the API contract between CaterCow and Ready Set. Field names, headers, and pricing values are subject to confirmation before implementation. Once both parties approve, Ready Set will formalize this as v1.0 and stand up the endpoints described below.

---

## Overview

Ready Set exposes a REST API for partner platforms to submit catering delivery orders. Orders flow through three stages — **Draft → Update → Confirm** — followed by webhook callbacks from Ready Set as the order progresses through fulfillment.

Ready Set provides **two separate environments** for the integration:

| Environment | Base URL | Purpose |
|-------------|----------|---------|
| **Development / QA** | `https://development.readysetllc.com/api/partners` | Test environment for CaterCow's dev team. Orders submitted here are **not dispatched** to real drivers and incur no real-world cost. Safe for end-to-end testing of the full Draft → Update → Confirm → webhook lifecycle. |
| **Production** | `https://readysetllc.com/api/partners` | Live environment. Orders here are dispatched to real drivers. |

Each environment has its own API key — the staging key cannot be used against production and vice versa. We strongly recommend completing full integration testing against staging before cutting over to production.

All endpoints accept and return `application/json`.

---

## Authentication

All requests must include the following headers:

```
Content-Type: application/json
partner: catercow
x-api-key: <issued-by-ready-set>
```

Ready Set will issue CaterCow a unique `x-api-key` for production and a separate key for staging. Keys are scoped to the partner identifier and can be rotated on request.

**Authentication failure response (401):**
```json
{
  "status": "ERROR",
  "message": "Invalid authentication credentials"
}
```

---

## Endpoint 1 — Draft Order

**Purpose:** Submit a candidate order and receive a delivery fee quote. No commitment to fulfill yet.

**`POST /orders/draft`**

### Request

```ts
{
  // Order identification
  orderCode: string;              // CaterCow's order code/identifier (e.g. "CC-12345")

  // Scheduling
  deliveryDate: string;           // "YYYY-MM-DD"
  deliveryTime: string;           // "HH:MM" (24-hour, Pacific Time)

  // Order details
  totalItem: number;              // Headcount (number of people)
  priceTotal: number;             // Total food cost in USD

  // Pickup location (restaurant/vendor)
  pickupLocation: {
    name: string;
    address: string;
    city: string;
    state: string;                // 2-letter code, e.g. "CA"
    zip?: string;
    phone?: string;
  };

  // Drop-off location (end customer)
  dropOffLocation: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip?: string;
    instructions?: string;        // e.g. "Leave at front desk"
    recipient: {
      name: string;
      phone: string;              // min 10 digits
    };
  };

  metadata?: Record<string, unknown>;
}
```

### Response (200)

```ts
{
  status: "SUCCESS" | "ERROR";
  message?: string;

  // Present on SUCCESS
  orderId?: string;               // UUID — use for update/confirm
  deliveryFee?: number;           // Final fee charged to CaterCow
  deliveryCost?: number;          // Base cost before mileage
  totalMileagePay?: number;       // Mileage surcharge included in deliveryFee
  totalFee?: number;              // deliveryFee + priceTotal

  // Diagnostics
  distance?: number;              // Miles, pickup → drop-off
  numberOfBridges?: number;       // 0 or 1 (informational only)
  usedFallbackDistance?: boolean; // true if Google Maps lookup failed
}
```

### Example

**Request:**
```json
{
  "orderCode": "CC-12345",
  "deliveryDate": "2026-05-15",
  "deliveryTime": "11:30",
  "totalItem": 30,
  "priceTotal": 850.00,
  "pickupLocation": {
    "name": "Tasty Catering Co.",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "phone": "415-555-0100"
  },
  "dropOffLocation": {
    "name": "Acme Corp HQ",
    "address": "500 Market St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "instructions": "Loading dock, ring bell #3",
    "recipient": {
      "name": "Jane Smith",
      "phone": "415-555-0200"
    }
  }
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "orderId": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "deliveryFee": 62.50,
  "deliveryCost": 62.50,
  "totalMileagePay": 0,
  "totalFee": 912.50,
  "distance": 1.8,
  "numberOfBridges": 0,
  "usedFallbackDistance": false
}
```

---

## Endpoint 2 — Update Order

**Purpose:** Modify a draft order before confirmation. Returns recalculated pricing.

**`POST /orders/update`**

### Request

```ts
{
  id: string;                     // UUID returned from /orders/draft
  // Any of the draft fields, only those that change
  orderCode?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  totalItem?: number;
  priceTotal?: number;
  pickupLocation?: { /* same shape as draft */ };
  dropOffLocation?: { /* same shape as draft */ };
  metadata?: Record<string, unknown>;
}
```

### Response

Same shape as `/orders/draft` response.

---

## Endpoint 3 — Confirm Order

**Purpose:** Finalize the draft for dispatch. Once confirmed, Ready Set will assign a driver and begin webhook callbacks.

**`POST /orders/confirm`**

### Request

```ts
{
  id: string;                     // UUID from draft/update
  isAccepted: boolean;            // true to confirm, false to reject
  reason?: string;                // required if isAccepted === false
  metadata?: Record<string, unknown>;
}
```

### Response

```ts
{
  status: "SUCCESS" | "ERROR";
  message: string;
  orderNumber?: string;           // Ready Set's internal order number, e.g. "CC-12345"
  orderId?: string;
}
```

---

## Endpoint 4 — Status Webhook (Ready Set → CaterCow)

**Purpose:** Ready Set notifies CaterCow when order status changes. CaterCow hosts a webhook endpoint and provides the URL during onboarding.

**Direction:** Ready Set → CaterCow
**Method:** `POST`
**URL:** Provided by CaterCow (e.g. `https://api.catercow.com/webhooks/readyset`)

### Headers (sent by Ready Set)

```
Content-Type: application/json
x-readyset-signature: <HMAC-SHA256 of body using shared secret>
```

### Payload

```ts
{
  orderId: string;                // Ready Set UUID
  orderCode: string;              // CaterCow's original order code
  orderNumber: string;            // Ready Set's order number
  status:
    | "ASSIGNED"
    | "PICKED_UP"
    | "ON_THE_WAY"
    | "ARRIVED"
    | "DELIVERED"
    | "CANCELLED";
  timestamp: string;              // ISO 8601 UTC
  driver?: {
    name: string;
    phone: string;
  };
  location?: {                    // Present for ON_THE_WAY pings
    lat: number;
    lng: number;
  };
  notes?: string;
}
```

### Expected response

CaterCow's webhook should return `200 OK` within 10 seconds. Non-2xx responses trigger retry with exponential backoff (5 attempts over ~30 minutes).

---

## Pricing

> **Note:** The pricing values shown in this section are **reference examples only**, drawn from an existing Ready Set partner integration to illustrate the shape of the pricing logic the API supports. The **agreed CaterCow rate card will replace these values in the production integration** — schema and response fields remain identical.

### Response field shape

Every quote returned by `/orders/draft` and `/orders/update` includes:

- `deliveryFee` — the final fee charged to the partner for the delivery
- `deliveryCost` — base cost component before any distance-based adjustments
- `totalMileagePay` — distance-based component (if applicable)
- `totalFee` — `deliveryFee + priceTotal` (convenience field)
- `distance`, `numberOfBridges`, `usedFallbackDistance` — diagnostics

### Reference pricing structure (example only)

Delivery fee is typically calculated as the **lesser** of headcount tier or food cost tier, with a minimum fee enforced. The table below is an illustrative reference — *not* the proposed CaterCow rate card.

| Tier | Headcount | Food Cost | Within 10 mi | Beyond 10 mi |
|------|-----------|-----------|--------------|--------------|
| 1 | 0–25 | $0–$300 | $42.50 | $85 + $3.00/mi |
| 2 | 26–49 | $300.01–$599.99 | $52.50 | $90 + $3.00/mi |
| 3 | 50–74 | $600–$899.99 | $62.50 | $110 + $3.00/mi |
| 4 | 75–99 | $900–$1,199.99 | $72.50 | $120 + $3.00/mi |
| 5 | 100+ | $1,200+ | 10% of food cost | 10% of food cost + $3.00/mi |

**Reference values:**
- Minimum fee: $42.50 (enforced regardless of tier calculation)
- Mileage: $3.00 per mile beyond 10-mile threshold
- Bridge tolls: auto-detected for internal driver compensation, **not charged** to the partner

*Example only. The actual CaterCow rate card is being finalized by our commercial team and will be supplied separately.*

---

## Validation Rules

### Required fields
- `orderCode` — non-empty string
- `deliveryDate` — `YYYY-MM-DD`, cannot be in the past
- `deliveryTime` — `HH:MM`, 24-hour
- `totalItem` — positive integer
- `priceTotal` — non-negative number
- `pickupLocation.{name, address, city, state}`
- `dropOffLocation.{name, address, city, state}`
- `dropOffLocation.recipient.{name, phone}` — phone min 10 digits

### Optional fields
- `pickupLocation.{zip, phone}`
- `dropOffLocation.{zip, instructions}`
- `metadata`

### Constraints
- `state` — 2-letter US state code
- All times are interpreted as **Pacific Time** on input; webhook timestamps are returned in UTC.

---

## Error Codes

| HTTP | Status field | Meaning |
|------|--------------|---------|
| 200 | `SUCCESS` | Request succeeded |
| 400 | `ERROR` | Invalid request payload (see `message`) |
| 401 | `ERROR` | Missing or invalid auth headers |
| 404 | `ERROR` | Order not found (update/confirm) |
| 422 | `ERROR` | Pricing calculation failed |
| 500 | `ERROR` | Internal error — please retry or contact support |

---

## Integration Flow

```
1. CaterCow → POST /orders/draft       → returns orderId + pricing quote
2. CaterCow → POST /orders/update      → optional, recalculates quote
3. CaterCow → POST /orders/confirm     → finalizes order, Ready Set dispatches
4. Ready Set → CaterCow webhook        → status updates as driver progresses
   (ASSIGNED → PICKED_UP → ON_THE_WAY → ARRIVED → DELIVERED)
```

---

## Onboarding Checklist

To stand up the integration, we'll need from CaterCow:

- [ ] Webhook URLs for status callbacks (production + staging — recommended to be separate endpoints on your side too)
- [ ] Confirmation of header naming (we propose `partner: catercow` + `x-api-key`)
- [ ] Test order codes / sandbox volumes you'd like to validate against in staging
- [ ] **CaterCow's API documentation** so Ready Set can also pull/push data on your platform if useful
- [ ] Approximate peak orders/day so we can size rate limits appropriately

Ready Set will provide:

- [ ] **Staging API key + base URL** — issued first, for integration testing
- [ ] **Production API key + base URL** — issued after staging validation passes
- [ ] HMAC signing secret for webhook verification (one per environment)
- [ ] Bruno / Postman collection for partner testing
- [ ] **Final rate card** — supplied separately by our commercial team
- [ ] Technical point of contact for onboarding

---

## Support

**Technical contact (Ready Set):**
- Emmanuel Alanis — ealanis@readysetllc.com

**Account contact:**
- Gary Vinson — gary@readysetllc.com

---

## Changelog

### v0.1 (2026-05-01)
- Initial draft for CaterCow review
- Modeled on Ready Set's existing partner integration patterns
