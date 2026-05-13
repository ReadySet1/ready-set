# Ready Set — Partner Order API

**Audience:** CaterCow Engineering
**Status:** Reflects current Ready Set implementation
**Last Updated:** 2026-05-12
**Version:** 0.2

> This document describes the API contract between CaterCow and Ready Set as currently implemented. v0.2 reconciles field names and response shapes with the live routes (previous v0.1 drafted-but-not-yet-built shapes that drifted from what shipped). All endpoints below have been deployed to staging and are ready for CaterCow's integration testing.

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

Optional but **strongly recommended**:

```
Idempotency-Key: <unique-key-per-logical-request>
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

## Idempotency

Every mutating endpoint (`/orders/draft`, `/orders/update`, `/orders/confirm`) accepts an `Idempotency-Key` header. When present, Ready Set caches the response for **24 hours**, keyed by `(partner, idempotency-key)`. Repeated requests within that window return the cached response with the original status code — safe to retry on network failure, timeout, or 5xx without risk of double-creating orders.

```
Idempotency-Key: 7c4d2e8a-1f9b-4a0e-9c3d-5e6f7a8b9c0d
```

**Recommended:** generate a fresh UUIDv4 per logical request; reuse it for retries of the same request. Different logical requests should use different keys.

**Caveat:** the cache key is `(partner, idempotency-key)` only — payload contents are not part of the key. If you send a different body with the same Idempotency-Key, you will receive the cached response from the original body, not a recomputed one. Always generate a new key when the request payload changes meaningfully.

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

### Response (201 Created)

On success, returns HTTP **201 Created**:

```ts
{
  status: "SUCCESS";
  id: string;                       // UUID — use for /orders/update and /orders/confirm
  deliveryPrice: number;            // Final delivery fee charged to the partner (USD)
  totalPrice: number;               // deliveryPrice + priceTotal (convenience)
  estimatedPickupTime: string;      // ISO 8601 UTC — when the driver is expected to pick up

  breakdown?: {
    basePrice: number;              // Base delivery fee component before adjustments
    mileageFee?: number;            // Mileage surcharge applied (if any)
    dailyDriveDiscount?: number;    // Same-day-volume discount applied (if any)
    bridgeToll?: number;            // Driver-side bridge toll (NOT charged to partner; informational only)
    peakTimeMultiplier?: number;    // Multiplier applied for peak windows (if any)
  };
}
```

On error, returns one of the codes in the [Error Codes](#error-codes) section with shape:

```ts
{
  status: "ERROR";
  message: string;
  details?: Record<string, unknown>; // Present on 400 validation errors — Zod-formatted field paths
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

**Response (HTTP 201):**
```json
{
  "status": "SUCCESS",
  "id": "ac59dadb-0ca0-45f4-ab9e-2e009d3c5b3b",
  "deliveryPrice": 62.50,
  "totalPrice": 912.50,
  "estimatedPickupTime": "2026-05-15T18:30:00.000Z",
  "breakdown": {
    "basePrice": 62.50,
    "mileageFee": 0,
    "dailyDriveDiscount": 0
  }
}
```

---

## Endpoint 2 — Update Order

**Purpose:** Modify a draft order before confirmation. Returns recalculated pricing.

**`POST /orders/update`**

### Request

Update is a **full-body replace**, not a partial update. Send every field exactly as you would for `/orders/draft`, plus the `id` returned from the original draft. Fields you don't intend to change should be sent with their current value. Sending a partial body will return `400 Bad Request`.

```ts
{
  id: string;                       // UUID returned from /orders/draft
  orderCode: string;                // Required (same value as draft, unless intentionally changing)
  deliveryDate: string;             // Required
  deliveryTime: string;             // Required
  totalItem: number;                // Required
  priceTotal: number;               // Required
  pickupLocation: { /* full shape same as draft, all required fields */ };
  dropOffLocation: { /* full shape same as draft, all required fields */ };
  metadata?: Record<string, unknown>;
}
```

### Response (200 OK)

Same shape as `/orders/draft` response, but returned with HTTP **200 OK** instead of 201 Created.

```ts
{
  status: "SUCCESS";
  id: string;
  deliveryPrice: number;
  totalPrice: number;
  estimatedPickupTime: string;
  breakdown?: { /* same as draft */ };
}
```

---

## Endpoint 3 — Confirm Order

**Purpose:** Finalize the draft for dispatch. Once confirmed (`isAccepted: true`), Ready Set will assign a driver and begin webhook callbacks. Sending `isAccepted: false` cancels the draft.

**`POST /orders/confirm`**

### Request

```ts
{
  id: string;                       // UUID from draft/update
  isAccepted: boolean;              // true to confirm, false to reject
  reason?: string;                  // Required when isAccepted === false
  metadata?: Record<string, unknown>;
}
```

### Response (200 OK)

```ts
{
  status: "CONFIRMED" | "CANCELLED" | "ERROR";
  message: string;
  id: string;                       // The same order UUID
  orderNumber: string;              // Ready Set's prefixed order number, e.g. "CC-12345"

  // Present when status === "CONFIRMED"
  estimatedDeliveryTime?: string;   // ISO 8601 UTC — when delivery is expected to complete
  driverAssignment?: {
    expectedAssignmentTime: string; // ISO 8601 UTC — when a driver is expected to be assigned
    trackingAvailable: boolean;     // true once driver assignment unlocks live tracking
  };
}
```

The `status` field distinguishes the two success branches:

- `"CONFIRMED"` — order accepted and dispatched (request had `isAccepted: true`)
- `"CANCELLED"` — order intentionally rejected (request had `isAccepted: false`)
- `"ERROR"` — unexpected failure during confirmation; check `message`

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

- `deliveryPrice` — the final fee charged to the partner for the delivery
- `totalPrice` — `deliveryPrice + priceTotal` (convenience field)
- `estimatedPickupTime` — ISO 8601 UTC, when the driver is expected to arrive at pickup
- `breakdown.basePrice` — base cost component before any distance-based adjustments
- `breakdown.mileageFee` — distance-based surcharge (if applicable)
- `breakdown.dailyDriveDiscount` — same-day-volume discount (if applicable)
- `breakdown.bridgeToll` — driver-side toll compensation (informational only; not charged to the partner)
- `breakdown.peakTimeMultiplier` — peak window multiplier (if applicable)

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
| 200 | `SUCCESS` / `CONFIRMED` / `CANCELLED` | Request succeeded (update, confirm) |
| 201 | `SUCCESS` | Order draft created (draft endpoint only) |
| 400 | `ERROR` | Invalid request payload — `message` describes the failure; `details` includes field-level errors (Zod-formatted) |
| 401 | `ERROR` | Missing or invalid auth headers |
| 404 | `ERROR` | Order not found (update / confirm) |
| 409 | `ERROR` | Duplicate `orderCode` for this partner — an active order with the same code already exists. The conflicting order's `id` is included in `details.existingOrderId`. Treat this as a successful idempotent retry: use the existing `id` for subsequent update / confirm calls. |
| 413 | `ERROR` | Request body exceeds the 256 KB size limit |
| 415 | `ERROR` | Wrong `Content-Type` (must be `application/json`) |
| 422 | `ERROR` | Pricing calculation failed — typically a malformed pickup / drop-off address. Retry with corrected values. |
| 429 | `ERROR` | Rate limit exceeded — see [Rate Limiting](#rate-limiting). Response includes a `Retry-After` header (seconds) indicating when to retry. |
| 500 | `ERROR` | Internal error — please retry (idempotent via `Idempotency-Key`) or contact support |

---

## Rate Limiting

All partner endpoints enforce a per-partner rate limit. The default ceiling is **100 requests / minute** per partner (sliding window), measured across all endpoints combined. Rates can be raised on request via the support contact below.

Exceeding the limit returns:

- HTTP `429 Too Many Requests`
- `Retry-After: <seconds>` header — the number of seconds to wait before the next attempt
- Response body: `{ "status": "ERROR", "message": "Rate limit exceeded" }`

Respect the `Retry-After` value rather than guessing — the limiter is sliding-window and an arbitrary retry can hit a fresh rejection. Combined with `Idempotency-Key`, you can safely retry a 429 once the window opens without risk of duplicate processing.

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

### v0.2 (2026-05-12)
- Reconciled response shapes with the live route implementations. Previous v0.1 fields drifted from what shipped:
  - Draft / Update response: `orderId` → `id`, `deliveryFee` → `deliveryPrice`, `totalFee` → `totalPrice`. Removed `deliveryCost`, `totalMileagePay`, `distance`, `numberOfBridges`, `usedFallbackDistance` (these were proposed in v0.1 but the routes return them under `breakdown.*` instead).
  - Draft endpoint returns HTTP **201 Created** (was documented as 200).
  - Added `estimatedPickupTime` and the full `breakdown` object to draft / update responses.
  - Confirm response: documented the real `status` enum (`"CONFIRMED" | "CANCELLED" | "ERROR"`), the `driverAssignment` object, and `estimatedDeliveryTime`.
- Documented `Idempotency-Key` header (24h cache, partner-scoped).
- Documented update endpoint as **full-body replace** (Zod schema requires every field).
- Added 409 (duplicate `orderCode`), 413 (body size), 415 (content-type), 429 (rate limit) to the Error Codes table.
- Added a Rate Limiting section covering the per-partner 100/min default and the `Retry-After` header.

### v0.1 (2026-05-01)
- Initial draft for CaterCow review
- Modeled on Ready Set's existing partner integration patterns
