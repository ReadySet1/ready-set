# Notifications Setup Guide

Complete setup instructions for push notifications (Firebase) and email notifications (Resend) in the Driver Dashboard.

---

## Overview

The notification system keeps drivers and customers informed about delivery status changes through:

1. **Push Notifications** - Firebase Cloud Messaging (FCM) for real-time alerts
2. **Email Notifications** - Resend for delivery status emails

---

## Push Notifications (Firebase)

### Prerequisites

- Firebase project
- HTTPS domain (required for service workers)
- PWA-compatible browser (Chrome, Edge, Safari 16.4+)

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"**
3. Enter project name (e.g., "Ready Set")
4. Disable Google Analytics (optional for notifications)
5. Click **"Create project"**

### 2. Add Web App

1. In Firebase console, click the web icon (`</>`)
2. Register app with nickname (e.g., "Ready Set Web")
3. Copy the config object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "project.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

### 3. Generate VAPID Key

1. Go to **Project Settings** > **Cloud Messaging**
2. Scroll to **Web Push certificates**
3. Click **"Generate key pair"**
4. Copy the key (starts with `B...`)

### 4. Generate Admin SDK Credentials

1. Go to **Project Settings** > **Service accounts**
2. Click **"Generate new private key"**
3. Download the JSON file
4. Extract values for environment variables

### 5. Environment Variables

```bash
# Client-side Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BLc7...

# Server-side Admin SDK
FIREBASE_PROJECT_ID=project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Important:** The `FIREBASE_PRIVATE_KEY` must include the `\n` characters. In `.env` files, wrap in quotes.

### 6. Service Worker

Create `/public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSy...", // Same as NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "project.firebaseapp.com",
  projectId: "project-id",
  messagingSenderId: "123456789012",
  appId: "1:123:web:abc123"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);

  const { title, body, icon } = payload.notification || {};
  const { url } = payload.data || {};

  self.registration.showNotification(title || 'New Notification', {
    body: body || '',
    icon: icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url }
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Focus existing window or open new
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

### 7. Client Implementation

```typescript
// src/lib/firebase-web.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });

    return token;
  } catch (error) {
    console.error('Failed to get notification token:', error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
```

### 8. Server Implementation

```typescript
// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

export async function sendPushNotification(
  token: string,
  notification: { title: string; body: string; url?: string }
) {
  const messaging = getMessaging();

  try {
    await messaging.send({
      token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      webpush: {
        fcmOptions: {
          link: notification.url
        }
      }
    });
    return { success: true };
  } catch (error: any) {
    // Handle invalid tokens
    if (error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, should be removed from database
      return { success: false, shouldRemoveToken: true };
    }
    throw error;
  }
}
```

### 9. Token Registration API

```typescript
// src/app/api/notifications/push/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const { token, userId } = await request.json();

  // Store token in database
  await prisma.pushToken.upsert({
    where: { userId },
    update: { token, updatedAt: new Date() },
    create: { userId, token }
  });

  return NextResponse.json({ success: true });
}
```

---

## Email Notifications (Resend)

### 1. Create Resend Account

1. Go to https://resend.com/
2. Sign up with GitHub or email
3. Verify your email address

### 2. Create API Key

1. Go to **API Keys** in dashboard
2. Click **"Create API Key"**
3. Name it (e.g., "Ready Set Production")
4. Select permissions (Full access or Sending access)
5. Copy the key (starts with `re_`)

### 3. Environment Variables

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 4. Domain Verification (Recommended)

1. Go to **Domains** in dashboard
2. Click **"Add Domain"**
3. Add your domain (e.g., `readyset.com`)
4. Add the DNS records shown:
   - SPF record
   - DKIM records
5. Click **"Verify"**

### 5. Implementation

```typescript
// src/services/notifications/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface DeliveryEmailData {
  to: string;
  customerName: string;
  status: string;
  driverName: string;
  eta: string;
  trackingUrl?: string;
}

export async function sendDeliveryStatusEmail(data: DeliveryEmailData) {
  try {
    const { data: result, error } = await resend.emails.send({
      from: 'Ready Set <noreply@readyset.com>',
      to: data.to,
      subject: `Delivery Update: ${data.status}`,
      html: `
        <h1>Your Delivery Update</h1>
        <p>Hi ${data.customerName},</p>
        <p>Your delivery is <strong>${data.status}</strong>.</p>
        <p>Driver: ${data.driverName}</p>
        <p>ETA: ${data.eta}</p>
        ${data.trackingUrl ? `<p><a href="${data.trackingUrl}">Track your delivery</a></p>` : ''}
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error };
    }

    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}
```

### 6. React Email Templates (Optional)

For more complex templates, use React Email:

```typescript
// src/emails/DeliveryStatusEmail.tsx
import { Html, Head, Body, Container, Text, Link } from '@react-email/components';

interface DeliveryStatusEmailProps {
  customerName: string;
  status: string;
  driverName: string;
  eta: string;
  trackingUrl?: string;
}

export function DeliveryStatusEmail({
  customerName,
  status,
  driverName,
  eta,
  trackingUrl
}: DeliveryStatusEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hi {customerName},</Text>
          <Text>Your delivery is {status}.</Text>
          <Text>Driver: {driverName}</Text>
          <Text>ETA: {eta}</Text>
          {trackingUrl && <Link href={trackingUrl}>Track your delivery</Link>}
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Notification Events

The system triggers notifications on these delivery events:

| Event | Push | Email | Description |
|-------|------|-------|-------------|
| `delivery:assigned` | Yes | No | Delivery assigned to driver |
| `driver:en_route` | Yes | Yes | Driver picked up and en route |
| `driver:arrived` | Yes | Yes | Driver arrived at destination |
| `delivery:completed` | Yes | Yes | Delivery completed |
| `delivery:delayed` | Yes | Yes | Delivery delayed |
| `delivery:failed` | Yes | Yes | Delivery failed |

### Triggering Notifications

```typescript
// src/services/notifications/dispatcher.ts
import { sendPushNotification } from '@/lib/firebase-admin';
import { sendDeliveryStatusEmail } from './email';
import { checkDeduplication } from './dedup';

export async function notifyDeliveryStatusChange(
  delivery: Delivery,
  event: DeliveryEvent
) {
  // Check for duplicate notifications (60-second window)
  const isDuplicate = await checkDeduplication(delivery.id, event);
  if (isDuplicate) return;

  // Send push notification
  if (delivery.customer.pushToken) {
    await sendPushNotification(delivery.customer.pushToken, {
      title: getEventTitle(event),
      body: getEventBody(event, delivery),
      url: `/orders/${delivery.orderId}`
    });
  }

  // Send email notification (for certain events)
  if (['driver:en_route', 'driver:arrived', 'delivery:completed'].includes(event)) {
    await sendDeliveryStatusEmail({
      to: delivery.customer.email,
      customerName: delivery.customer.name,
      status: formatStatus(event),
      driverName: delivery.driver.name,
      eta: delivery.eta
    });
  }
}
```

---

## Deduplication

Prevent duplicate notifications with a 60-second TTL cache:

```typescript
// src/services/notifications/dedup.ts
const notificationCache = new Map<string, number>();
const DEDUP_TTL = 60000; // 60 seconds

export async function checkDeduplication(
  deliveryId: string,
  event: string
): Promise<boolean> {
  const key = `${deliveryId}:${event}`;
  const lastSent = notificationCache.get(key);

  if (lastSent && Date.now() - lastSent < DEDUP_TTL) {
    return true; // Is duplicate
  }

  notificationCache.set(key, Date.now());
  return false;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  notificationCache.forEach((timestamp, key) => {
    if (now - timestamp > DEDUP_TTL) {
      notificationCache.delete(key);
    }
  });
}, 60000);
```

---

## Testing

### Test Push Notifications

1. Visit the app in a browser
2. Click "Enable Notifications" when prompted
3. Use the test endpoint:

```bash
curl -X POST http://localhost:3000/api/notifications/push/test \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user-id"}'
```

### Test Email Notifications

```bash
curl -X POST http://localhost:3000/api/notifications/email/test \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

---

## Troubleshooting

### Push Notifications Not Working

1. **Check HTTPS** - Service workers require HTTPS
2. **Verify permissions** - User must grant notification permission
3. **Check service worker** - Look for errors in DevTools > Application > Service Workers
4. **Validate token** - Tokens expire; implement token refresh

### Emails Not Sending

1. **Check API key** - Verify RESEND_API_KEY is set and starts with `re_`
2. **Domain verification** - Ensure sender domain is verified in Resend dashboard
3. **Check spam** - Test emails may go to spam folder
4. **View activity** - Check Resend dashboard (Logs section) for delivery status
5. **Rate limits** - Free tier has limits; check usage in dashboard

### Token Validation Errors

```typescript
// Handle invalid tokens
if (error.code === 'messaging/registration-token-not-registered') {
  // Remove from database
  await prisma.pushToken.delete({ where: { token } });
}
```

---

## Related Documentation

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Resend API Docs](https://resend.com/docs)
- [React Email](https://react.email/)
- [Push Notifications Implementation](../push-notifications-REA-124.md)
- [Email Template Usage](../email/EMAIL_TEMPLATE_USAGE.md)
- [Driver Dashboard Audit](../driver-dashboard-audit-2025-01.md)
