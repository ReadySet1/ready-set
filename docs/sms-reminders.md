# SMS Reminders — Automated Driver Notifications

Automated SMS reminders sent to drivers about their daily deliveries, sourced from the Coolfire Google Sheet.

## Overview

The helpdesk team previously generated SMS templates manually at `/admin/logistics-tools`, copied the text, and pasted it into a messaging app. This feature automates the entire flow: reading delivery data from Google Sheets, building the same SMS templates, and sending them directly via Twilio.

### Two Reminder Types

| Type | When Sent | Content |
|------|-----------|---------|
| **Next-Day** | Evening before (midnight UTC / 6 PM CST) | Detailed: order #, pickup time, vendor address, client address, pay, headcount |
| **Same-Day** | Morning of (1 PM UTC / 7 AM CST) | Condensed: route/order list with pickup times + readiness confirmation |

## Architecture

```
Google Sheet ("Drives - Coolfire" tab)
    │
    ▼
Google Sheets API (service account)
    │
    ▼
Parser (header-based column mapping)
    │
    ▼
Group by driver name + phone
    │
    ▼
Message Builder (next-day or same-day template)
    │
    ▼
SMS Provider (Twilio) ──► Driver's phone
    │
    ▼
SmsReminderBatch / SmsReminderLog (Prisma)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/sms/types.ts` | Provider-agnostic `SmsProvider` interface |
| `src/lib/sms/twilio.ts` | Twilio implementation with E.164 phone normalization |
| `src/lib/sms/index.ts` | Provider factory (configured via `SMS_PROVIDER` env var) |
| `src/lib/google-sheets/client.ts` | Google Sheets API client |
| `src/lib/google-sheets/parser.ts` | Sheet row parser, date filter, group-by-driver |
| `src/services/sms-reminders/message-builder.ts` | Next-day and same-day message templates |
| `src/services/sms-reminders/index.ts` | Orchestrator: `previewSmsReminderBatch()`, `runSmsReminderBatch()` |

### API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/admin/sms-reminders/preview` | POST | Admin session | Dry-run preview of messages to send |
| `/api/admin/sms-reminders/send` | POST | Admin session | Send SMS to all or selected drivers |
| `/api/admin/sms-reminders/history` | GET | Admin session | Paginated batch history with logs |
| `/api/admin/sms-reminders/cron` | GET | CRON_SECRET or admin | Vercel Cron endpoint |
| `/api/webhooks/twilio` | POST | Public (Twilio callback) | Delivery status updates |

### Database Models

**`SmsReminderBatch`** (`sms_reminder_batches`) — one record per send cycle:
- `type`: "next_day" or "same_day"
- `targetDate`: delivery date
- `status`: "pending" | "in_progress" | "completed" | "failed"
- `totalDrivers`, `totalSent`, `totalFailed`, `totalSkipped`
- `triggeredBy`: admin email or "cron"

**`SmsReminderLog`** (`sms_reminder_logs`) — one record per individual SMS:
- `batchId`: FK to batch
- `driverName`, `phoneNumber`, `messageBody`
- `status`: "sent" | "delivered" | "failed" | "skipped"
- `providerMsgId`: Twilio message SID
- `orderNumbers`: JSON array of order identifiers

## Setup

### 1. Google Sheet: Add "Driver Phone" Column

The Coolfire sheet ("Drives - Coolfire" tab) needs a **"Driver Phone"** column. Add it after the "Backup Driver" column and populate with driver phone numbers in any standard format (the system normalizes to E.164).

Accepted formats: `5125551234`, `(512) 555-1234`, `+15125551234`, `512-555-1234`

### 2. Twilio Account

1. Create an account at [twilio.com](https://www.twilio.com)
2. Get a phone number (toll-free recommended for faster verification)
3. For production: register for A2P 10DLC to avoid carrier filtering (takes 1-2 weeks)
4. Configure the status callback URL in the Twilio console:
   - Go to Phone Numbers > Active Numbers > select your number
   - Under Messaging > "A MESSAGE COMES IN" section, set the status callback to:
     `https://yourdomain.com/api/webhooks/twilio`

### 3. Environment Variables

Add to `.env.local` (and Vercel project settings for production):

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
SMS_PROVIDER=twilio

# Google Sheets (should already be configured)
GOOGLE_SHEETS_CLIENT_EMAIL=sheets-quotes@ready-set-439716.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_PROJECT_ID=ready-set-439716
GOOGLE_SHEETS_SHEET_ID=your_spreadsheet_id

# Cron authentication (should already be configured)
CRON_SECRET=your_cron_secret
```

### 4. Database Migration

Run the Prisma migration to create the SMS tables:

```bash
pnpm db:generate
dotenv -e .env.local -- npx prisma migrate dev --name add-sms-reminder-tables
```

## Usage

### Admin UI (`/admin/sms-reminders`)

**Preview & Send tab:**
1. Select a delivery date and message type (next-day or same-day)
2. Optionally set the helpdesk agent name (defaults to "Ready Set")
3. Click "Load Preview" to see all drivers, their phone numbers, and message previews
4. Drivers without phone numbers are highlighted in yellow
5. Click "Send All" or send individually per driver

**History tab:**
- View past send batches with sent/failed/skipped counts
- Expand any batch to see individual message logs with delivery status

### Automated Cron

Two Vercel Cron jobs run daily (configured in `vercel.json`):

| Schedule | UTC | CST | Type |
|----------|-----|-----|------|
| `0 0 * * *` | Midnight | 6:00 PM | Next-day (tomorrow's deliveries) |
| `0 13 * * *` | 1:00 PM | 7:00 AM | Same-day (today's deliveries) |

To test the cron endpoint manually:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://yourdomain.com/api/admin/sms-reminders/cron?type=next_day"
```

### API Usage

**Preview:**
```bash
curl -X POST /api/admin/sms-reminders/preview \
  -H "Content-Type: application/json" \
  -d '{"type": "next_day", "targetDate": "2026-04-11"}'
```

**Send to all:**
```bash
curl -X POST /api/admin/sms-reminders/send \
  -H "Content-Type: application/json" \
  -d '{"type": "next_day", "targetDate": "2026-04-11"}'
```

**Send to specific drivers:**
```bash
curl -X POST /api/admin/sms-reminders/send \
  -H "Content-Type: application/json" \
  -d '{"type": "next_day", "targetDate": "2026-04-11", "drivers": ["Mary Kelley"]}'
```

## Google Sheet Column Mapping

The parser uses **header-based** column lookup (not index-based), so it survives column reordering. Required headers:

| Header | Required | Description |
|--------|----------|-------------|
| `Date` | Yes | Delivery date (M/D/YY format, e.g., "3/1/26") |
| `Driver` | Yes | Driver name — used to group orders |
| `Driver Phone` | Yes | **New column** — driver phone number |
| `Pick Up` | Yes | Pickup time (e.g., "10:00 AM") |
| `Vendor` | Yes | Vendor/restaurant name |
| `Route/Order` | Yes | Order number or route identifier |
| `Client` | Yes | Client/company name |
| `Client Address` | Yes | Delivery address |
| `Vendor Address` | Yes | Pickup address |
| `Headcount / Total Drops` | No | Headcount (included in next-day message) |
| `Driver Max Pay Per Drop` | No | Pay amount (included in next-day message) |
| `Vendor Pick-Up Location` | No | Pickup location name (falls back to Vendor) |
| `Special Notes` | No | Delivery instructions (stored, not yet in SMS) |

## SMS Message Templates

### Next-Day Confirmation

```
Hi Mary Kelley! This is Ready Set. Here are your food drive for tomorrow,
Friday, 4/11/2026. Please check the details and confirm. Thank you!

---------1ST ORDER----------

ORDER# Direct - Order # 2 (Driver1)
PICK UP: 10:00 AM
La Barbeque - 2401 E Cesar Chavez, Austin, TX 78702

DROP OFF:
FC stadium - Q2 Stadium at 10414 McKalla Place, Austin, TX 78758

PAY: $70.00
HEADCOUNT: 22
```

### Same-Day Confirmation

```
Hi Mary Kelley! This is Ready Set. Here are your food drive for today,
Friday, 4/11/2026. Please check the details and confirm. Thank you!

Route/Order  Pick Up
Direct - Order # 2 (Driver1)  10:00 AM

Please confirm your readiness for today's food drive by replying.
If unavailable, inform us ASAP to arrange a replacement to avoid penalties.

✅ Ensure restaurant sign-off via Coolfire app with location updates activated.
✅ Check Coolfire app for drive details. Notify promptly of app issues.

Arrive 15 mins early at the resto. Thanks, and drive safely!
```

## SMS Provider Abstraction

The system is built with a provider-agnostic interface so Twilio can be swapped out:

```typescript
// src/lib/sms/types.ts
interface SmsProvider {
  send(to: string, body: string): Promise<SmsResult>;
}
```

To add a new provider:
1. Create `src/lib/sms/your-provider.ts` implementing `SmsProvider`
2. Add a case in `src/lib/sms/index.ts` for the new provider name
3. Set `SMS_PROVIDER=your-provider` in env vars

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing required sheet headers" | Check that the Google Sheet has the expected column names in row 1 |
| "No deliveries found for this date" | Verify the date format in the sheet matches M/D/YY and the target date is correct |
| SMS not delivered | Check Twilio console for delivery status. Verify phone number format. Check A2P 10DLC registration status |
| "Missing Twilio configuration" | Ensure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are set |
| "Missing Google Sheets configuration" | Ensure `GOOGLE_SHEETS_CLIENT_EMAIL` and `GOOGLE_SHEETS_PRIVATE_KEY` are set |
| Cron not triggering | Verify `CRON_SECRET` is set in Vercel environment variables and matches `vercel.json` cron config |
| Driver shows "No phone number" | Add the driver's phone to the "Driver Phone" column in the Google Sheet |
