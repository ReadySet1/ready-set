# Email Draft — Reply to Nate (CaterCow API Integration)

**Status:** Draft, pending review
**Author:** Emmanuel Alanis
**Date:** 2026-06-05
**In reply to:** Nate (support@catercow.com), Fri Jun 5 2026 4:38 PM
**Thread:** API Integration — Ready Set Partner API

---

## Headers

**To:** support@catercow.com (Nate)
**Cc:**
- Gary Vinson `<gary@readysetllc.com>`
- Mark Fuentes `<mark@readysetllc.com>`

**Subject:** Re: API Integration — Ready Set Partner API

---

## Body

Hi Nate,

Thanks for pushing through the full lifecycle and for the clear notes — really helpful. Answers below.

**1. Cancelling / updating a confirmed order**

Your testing is correct, and I owe you a correction: a **confirmed order is locked** — you can't `update` it or cancel it via `confirm(isAccepted:false)` once it's in `CONFIRMED`. My earlier note that update/cancel "still works post-confirmation" was wrong; the cancel path applies to a **draft** (pre-confirmation) order, which matches the v0.1 contract. Sorry for the confusion.

Given that, your plan is exactly right: **confirm ~24h before delivery.** Drafts can be freely `update`d (deliverables, addresses, contacts, timing) any number of times right up until you confirm, so confirming late costs you nothing and keeps the order fully editable through the window your customers actually make changes in. If you ever need to confirm earlier and then change something, the path today is cancel-the-draft-and-re-draft *before* confirming — but with a ~24h confirm window you shouldn't hit that.

**2. Fetch / GET endpoint**

Point taken — you've asked twice and it's a reasonable baseline expectation. We're going to add **`GET /orders/{id}`** (current status + recent lifecycle events) and have it ready for go-live so you have a resync path if a webhook is ever missed. I'll confirm the exact response shape when it lands.

**3. Webhooks + signing secret**

We've got your endpoints noted:
- Staging: `https://api.staging.steerdelivery.com/webhooks/ready_set`
- Production: `https://api.steerdelivery.com/webhooks/ready_set`

I'm finishing the outbound dispatcher on our side so lifecycle callbacks (`ASSIGNED → PICKED_UP → ON_THE_WAY → ARRIVED → DELIVERED`, plus `CANCELLED`) fire to your URL, HMAC-signed. I'll send the **staging signing secret** (separate, 1Password share) the moment that's wired and your staging endpoint is reachable, so you're verifying against real traffic rather than silence. One correction to my earlier email: the signature header is **`x-readyset-signature`** (HMAC-SHA256 of the raw body) — please verify against that name.

**4. steerdelivery.com**

Thanks for confirming it's your delivery-comms microservice — that clears up the domain difference. We'll note it on the partner record so production credential exchange goes smoothly.

I'll follow up as soon as the staging webhooks + secret are ready on our side. 

Best,
Emman

---

## Internal notes (do NOT send)

These came out of verifying Nate's findings against the repo on 2026-06-05:

- **Confirm-lock:** `isOrderEditable()` (`src/app/api/cater-valley/_lib/order-utils.ts:124`) allows only `PENDING`/`ACTIVE`. Draft → `ACTIVE`; confirm → `CONFIRMED` locks both update and cancel. Matches `API_CONTRACT.md:246`; the May 13 email was the thing that was wrong. Decision (2026-06-05): match the contract, no code change — tell Nate to confirm ~24h out.
- **Outbound webhook gap:** the registry-driven dispatcher `src/lib/services/partnerWebhookService.ts` does **not** exist (tasks-board had it marked done — corrected). Status route dispatches only via `CARRIER_CONFIGS` (catervalley/ezcater); CaterCow gets zero callbacks until the dispatcher is built. Tracked as `catercow-dispatcher-refactor` (now open) and `catercow-webhook-preconfigure` (now open, blocked on it).
- **GET endpoint:** committed for go-live — `catercow-get-orders-scope`, `IMPLEMENTATION_PLAN.md` Phase 4.1 (~half day).
- **Header name:** code + contract use `x-readyset-signature`; the May 13 email said `X-Ready-Set-Signature` + `X-Ready-Set-Timestamp`. Reply above uses the code/contract name and drops the timestamp header (not implemented). If we want replay protection via timestamp, that's a small extra addition to scope.
