# Email Draft — CaterCow API Integration

**Status:** Draft, ready to send
**Author:** Emmanuel Alanis
**Date:** 2026-05-01
**Attachment:** `ReadySet-Partner-API-Contract-v0.1.pdf`

---

## Headers

**To:** Sean — `support@catercow.com`
**CC:**
- Gary Vinson `<gary@readysetllc.com>`
- April Ducao `<jing@readysetllc.com>`
- Mark Fuentes `<mark@readysetllc.com>`
- Dev team `<dev@readysetllc.com>`

**Subject:** API Integration — Ready Set Partner API (Draft Contract Attached)

**Attachment:** `ReadySet-Partner-API-Contract-v0.1.pdf`

---

## Body

Hi Sean,

Great to hear you're ready to move forward on integration. To answer your second question first: yes, we currently support API-driven order ingestion for catering partners.

Attached is **v0.1 of our Partner Order API contract** for your team to review. It covers:

- **Three inbound endpoints** — Draft → Update → Confirm — so you can quote, adjust, and finalize orders programmatically
- **Outbound status webhooks** from Ready Set to CaterCow, HMAC-signed, covering the full delivery lifecycle (assigned → picked up → on the way → arrived → delivered)
- **Two separate environments** — a **staging / QA** base URL where your dev team can test the full lifecycle against fake dispatches, plus the **production** base URL once we're ready to go live. Each gets its own API key.
- **Authentication** via a per-partner API key we'll issue you (one for staging, one for production)
- **Validation rules, error codes, and full example payloads**
- **Pricing structure** — the contract shows our reference pricing model so you can see how quotes are returned in the API response, but **the actual rate card for the CaterCow integration will be the one our commercial team has agreed with you** and will be wired into the production environment. The reference table in the document is illustrative only.

A few things we'd need from your side to kick this off:

1. **Your API documentation** — we'd like to review what's available on the CaterCow side as well, in case there are flows where Ready Set should pull or push data into your platform.
2. **Webhook URLs** — where should we send order status callbacks? Ideally one URL for staging and one for production, so test traffic doesn't hit your live systems.
3. **Confirmation on the contract** — any field name changes, missing fields, or constraints we should know about. We can adjust before we lock to v1.0.
4. **Approximate volume** — peak orders/day so we can size rate limits appropriately.

Once we're aligned on the contract, our dev team can have the integration live on **staging within 1–2 weeks** for your team to test end-to-end before we cut over to production.

Looping in our dev team on this thread so they can answer technical questions directly.

Best,
Emmanuel Alanis
Ready Set
ealanis@readysetllc.com

---

## Follow-up reply to Gary (separate, short)

**To:** Gary Vinson `<gary@readysetllc.com>`
**Subject:** Re: Fwd: API Integration

Hi Gary,

Done — sent Sean v0.1 of our Partner API contract (PDF attached) and looped the dev team in on the thread, with you, April, and Mark on CC. I asked him for CaterCow's API docs in return and offered both staging and production environments so their team can test safely before we go live.

One quick check on my side: the contract includes our standard reference pricing as an *example only* (clearly labeled), since I wanted to be sure we send the rate card you've agreed with CaterCow rather than assume. **Could you forward me the agreed pricing for CaterCow when you have a moment?** I'll wire it into the production environment once we get there.

I'll keep you posted as Sean and the dev team work through the technical questions.

Thanks,
Emmanuel

---

## Notes

- The PDF (`ReadySet-Partner-API-Contract-v0.1.pdf`) lives next to this draft in `docs/catercow/`.
- Internal-only implementation plan is in `docs/catercow/IMPLEMENTATION_PLAN.md` — do **not** attach to the email.
- If Sean replies confirming the contract shape, next steps are tracked in the implementation plan (Phase 1 refactor, Phase 2 onboarding).
