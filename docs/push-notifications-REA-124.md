## REA-124 Push Notifications (PWA/Firebase)

This document summarizes the implementation of browser push notifications for delivery status updates, aligned with the REA-124 Plane issue (`https://plane.readysetllc.com/ready-set-llc/browse/REA-124/`).

### Data Model

- `profiles.has_push_notifications` (boolean, default `false`):
  - Indicates whether the user has enabled push notifications for their account.
- `profile_push_tokens` table:
  - Stores Firebase Cloud Messaging (FCM) tokens per profile and device.
  - Key columns: `id`, `profile_id`, `token`, `user_agent`, `platform`, `created_at`, `revoked_at`.
  - Indexed on `profile_id` and `(profile_id, revoked_at)` for fast lookup of active tokens.

### Firebase Configuration

Environment variables (public config):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

Backend (admin) configuration:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\n`-escaped newlines)

### Backend Components

- `src/lib/firebase-admin.ts`:
  - Lazy-initialized Firebase Admin App + Messaging singleton for server-side use.
- `src/services/notifications/push.ts`:
  - `sendPushNotification` sends a single push to a specific token.
  - `sendDeliveryStatusPush` sends a delivery status event to all active tokens for a profile.
  - `mapDispatchStatusToPushEvent` and `buildDeliveryStatusMessage` map internal dispatch statuses to user-facing messages.
- `src/services/notifications/delivery-status.ts`:
  - `sendDispatchStatusNotification` resolves the customer profile from `orderId` and triggers push notifications for supported statuses.
- `src/app/api/dispatch/status-update/route.ts`:
  - Uses `sendDispatchStatusNotification` in place of the previous mock notification function.

### API Routes

- `POST /api/notifications/push/register`
  - Authenticated users register the current device’s FCM token.
  - Body: `{ token: string; userAgent?: string; platform?: string }`.
  - Upserts into `profile_push_tokens` and sets `profiles.has_push_notifications = true`.
- `GET /api/notifications/push/preferences`
  - Returns `{ hasPushNotifications: boolean; devices: [...] }` for the current user.
- `PATCH /api/notifications/push/preferences`
  - Body: `{ hasPushNotifications?: boolean }`.
  - When set to `false`, revokes all active tokens for the profile.
- `GET /api/notifications/push/firebase-config`
  - Exposes public Firebase config for the service worker.

### Frontend Components

- `public/firebase-messaging-sw.js`:
  - Classic service worker that loads Firebase compat scripts.
  - Fetches Firebase config from `/api/notifications/push/firebase-config`.
  - Handles `onBackgroundMessage` to show notifications and a `notificationclick` handler to open the tracking URL.
- `src/lib/firebase-web.ts`:
  - Browser-side Firebase initialization + `requestFcmToken` helper using `getToken` with the VAPID key.
- `src/hooks/usePushNotifications.ts`:
  - React hook that:
    - Detects browser support for Notifications, Service Workers, and Push.
    - Loads account-level preferences from `/api/notifications/push/preferences`.
    - Provides `enableOnThisDevice` and `disableAllDevices` helpers.
    - Manages a simple state machine: `idle`, `requesting_permission`, `enabled`, `disabled`, `unsupported`, `error`.
- `src/app/(site)/profile/page.tsx`:
  - Adds a **Notification Preferences** card in the sidebar using `usePushNotifications`.
  - Accessible, keyboard-navigable controls to enable/disable delivery status notifications.

### Notification Triggers

The following dispatch statuses trigger customer push notifications:

- `ACCEPTED` → “Your delivery has been assigned”
- `EN_ROUTE_TO_DELIVERY` → “Driver is on the way”
- `ARRIVED_AT_DELIVERY` → “Driver has arrived”
- `DELIVERY_COMPLETE` → “Delivery completed”
- `DELAYED` → “Delivery delayed”
- `FAILED` → “Delivery could not be completed”

All push failures are logged via the existing `DispatchSystemError` + `trackDispatchError` utilities without breaking the core status update flow.

### Testing

- `src/services/notifications/push.test.ts`:
  - Unit tests for status-to-event mapping and message generation.
  - Rate limiting / deduplication tests.
  - Integration tests for status-to-message pipeline.
- `src/app/api/notifications/push/register/route.test.ts`:
  - Basic validation test for the registration endpoint (invalid payload handling).

### Rate Limiting

Push notifications include deduplication to prevent duplicate notifications on retries:

- **TTL Window**: 60 seconds (same profile + event + order combination)
- **Implementation**: In-memory cache in `src/services/notifications/push.ts`
- **Functions**:
  - `isDuplicateNotification(profileId, event, orderId)` - Check if duplicate
  - `markNotificationSent(profileId, event, orderId)` - Mark as sent
  - `clearNotificationCache()` - Clear cache (for testing)

### Troubleshooting

#### Notifications not being received

1. **Check browser support**:
   - Notifications require: `Notification` API, `ServiceWorker` API, `PushManager` API
   - Safari on iOS requires iOS 16.4+ and the app must be added to Home Screen
   - Private/Incognito mode may block notifications

2. **Check user preferences**:
   - Verify `profiles.has_push_notifications = true` in database
   - Check for active tokens in `profile_push_tokens` table (where `revoked_at IS NULL`)

3. **Check Firebase configuration**:
   - Backend: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - Frontend: `NEXT_PUBLIC_FIREBASE_*` environment variables
   - VAPID key: `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

4. **Check service worker**:
   - Verify `/firebase-messaging-sw.js` is served correctly
   - Check browser DevTools > Application > Service Workers
   - Look for errors in service worker console

#### Duplicate notifications

- Notifications are deduplicated for 60 seconds based on `profileId:event:orderId`
- If duplicates occur, check if the same status update is being sent multiple times
- Rate limiting is in-memory; server restarts will reset the cache

#### Invalid tokens

- Tokens are automatically revoked when Firebase returns `registration-token-not-registered`
- Check `profile_push_tokens.revoked_at` to see if tokens were invalidated
- Users may need to re-enable notifications after clearing browser data

#### Errors in logs

Push notification errors are tracked via `DispatchSystemError` with type `DRIVER_NOTIFICATION_ERROR`:

```typescript
// Error context includes:
{
  dispatchId: string | undefined,
  driverId: string | undefined,
  orderId: string,
  notificationDetails: {
    type: "status_update_push",
    recipient: "customer" | "admin" | "multiple"
  }
}
```

Search logs/Sentry for `DRIVER_NOTIFICATION_ERROR` to find push failures.

#### Firebase quota limits

Firebase Cloud Messaging has the following limits:
- **Free tier**: Unlimited notifications
- **Rate limits**: 1,000 messages/second per project (soft limit)
- **Token limits**: Tokens expire after ~2 months of inactivity

#### Testing notifications manually

1. Enable notifications in profile settings
2. Trigger a dispatch status update via API:
   ```bash
   curl -X POST /api/dispatch/status-update \
     -H "Content-Type: application/json" \
     -d '{
       "dispatchId": "uuid",
       "driverId": "uuid",
       "orderId": "uuid",
       "status": "EN_ROUTE_TO_DELIVERY"
     }'
   ```
3. Check browser for notification popup
4. Check service worker console for background message logs


