# Phase 4 Deployment Checklist

Pre-deployment verification checklist for Phase 4 Driver Dashboard features.

---

## Pre-Deployment Checklist

### 1. External Service Accounts

- [ ] **Mapbox Account**
  - [ ] Account created at https://account.mapbox.com/
  - [ ] Access token generated
  - [ ] Token restricted to production domain(s)
  - [ ] Billing alerts configured (free tier: 50K loads/month)

- [ ] **Firebase Project**
  - [ ] Project created at https://console.firebase.google.com/
  - [ ] Web app registered
  - [ ] Cloud Messaging enabled
  - [ ] VAPID key generated
  - [ ] Admin SDK credentials downloaded

- [ ] **SendGrid Account**
  - [ ] Account created at https://sendgrid.com/
  - [ ] API key generated with Mail Send permission
  - [ ] Sender domain/email verified
  - [ ] Email templates created

- [ ] **Sentry Project**
  - [ ] Project created at https://sentry.io/
  - [ ] DSN copied
  - [ ] Auth token generated (scopes: project:releases, project:write, org:read)
  - [ ] Source maps upload configured

---

### 2. Environment Variables

#### Verify all variables are set in production:

```bash
# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
NEXT_PUBLIC_FIREBASE_VAPID_KEY=xxx

# Firebase (Server)
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# SendGrid
SENDGRID_API_KEY=SG.xxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntryu_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Feature Flags
NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=true
NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=true
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_SSE=true
NEXT_PUBLIC_FF_REALTIME_FALLBACK_TO_REST=true
```

- [ ] All variables added to hosting platform (Vercel/etc.)
- [ ] FIREBASE_PRIVATE_KEY has proper newline escaping
- [ ] No secrets exposed in client-side variables

---

### 3. Database

- [ ] **PostGIS Extension**
  - [ ] `postgis` extension enabled
  - [ ] Verified with: `SELECT PostGIS_Version();`

- [ ] **Migrations**
  - [ ] All migrations applied: `pnpm prisma migrate deploy`
  - [ ] Prisma client generated: `pnpm prisma generate`

- [ ] **Tables Verified**
  - [ ] `driver_locations` table exists with geography columns
  - [ ] `driver_shifts` table has mileage fields
  - [ ] `deliveries` table has POD fields
  - [ ] `push_tokens` table exists

---

### 4. Storage

- [ ] **Supabase Storage**
  - [ ] `deliveries` bucket created for POD images
  - [ ] Bucket policies configured (authenticated uploads)
  - [ ] Public read access enabled for POD images

---

### 5. Service Worker

- [ ] **Firebase Messaging SW**
  - [ ] `/public/firebase-messaging-sw.js` exists
  - [ ] Firebase config matches environment variables
  - [ ] SW registered correctly in browser

---

### 6. SSL/HTTPS

- [ ] Production domain has valid SSL certificate
- [ ] All API endpoints accessible via HTTPS
- [ ] Service worker only loads on HTTPS

---

### 7. Build Verification

```bash
# Run full build
pnpm build

# Verify no build errors
# Check for TypeScript errors
# Verify Sentry source maps uploaded
```

- [ ] Build completes without errors
- [ ] TypeScript check passes: `pnpm typecheck`
- [ ] ESLint passes: `pnpm lint`
- [ ] Source maps uploaded to Sentry

---

### 8. Test Suite

```bash
# Run all Phase 4 tests
pnpm test:unit -- --testPathPattern="(LiveDriverMap|tracking|notification|mileage)"
```

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (if applicable)

---

### 9. Manual Testing

#### Map Visualization
- [ ] Admin dashboard map loads at `/admin/tracking`
- [ ] Map displays in both Street and Satellite views
- [ ] Zoom controls work
- [ ] Map fits to driver markers

#### Real-time Updates
- [ ] Test driver simulator works at `/admin/tracking/test-driver`
- [ ] Driver appears on admin map in real-time
- [ ] Position updates within 2 seconds
- [ ] Connection mode toggle works (WebSocket/SSE)

#### Push Notifications
- [ ] Permission prompt appears
- [ ] Token registration succeeds
- [ ] Test notification received
- [ ] Background notifications work

#### Email Notifications
- [ ] Test email sends successfully
- [ ] Email template renders correctly
- [ ] Links in email work

#### POD Upload
- [ ] Camera capture works on mobile
- [ ] Image compression reduces file size
- [ ] Upload succeeds
- [ ] Image visible in admin gallery

#### Mileage Calculation
- [ ] API returns mileage for completed shift
- [ ] GPS quality metrics included
- [ ] Reasonable distance values

---

### 10. Performance

- [ ] Page load time < 3 seconds
- [ ] Map initial render < 2 seconds
- [ ] WebSocket latency < 500ms
- [ ] No memory leaks during extended use

---

### 11. Error Monitoring

- [ ] Sentry receiving events
- [ ] Source maps showing readable stack traces
- [ ] User context attached to errors
- [ ] Alert rules configured for critical errors

---

### 12. Rollback Plan

- [ ] Previous deployment identified for rollback
- [ ] Feature flags can disable new features
- [ ] Database migrations are reversible (if any)
- [ ] Team knows rollback procedure

---

## Post-Deployment Verification

### Immediate (First 15 minutes)

- [ ] Application loads without errors
- [ ] Admin dashboard accessible
- [ ] Real-time tracking functional
- [ ] No spike in Sentry errors

### Short-term (First hour)

- [ ] Push notifications delivering
- [ ] Email notifications sending
- [ ] POD uploads working
- [ ] Mileage calculations accurate

### Ongoing Monitoring

- [ ] Mapbox usage within limits
- [ ] Firebase quotas healthy
- [ ] SendGrid delivery rates normal
- [ ] Sentry error rate acceptable

---

## Emergency Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| Mapbox | support@mapbox.com | Map issues |
| Firebase | Firebase Console | Push issues |
| SendGrid | support@sendgrid.com | Email issues |
| Sentry | support@sentry.io | Monitoring issues |
| Supabase | support@supabase.io | Realtime/DB issues |

---

## Related Documentation

- [Audit Report](driver-dashboard-audit-2025-01.md)
- [Implementation Guide](phase-4-implementation-guide.md)
- [Quick Reference](driver-dashboard-quick-reference.md)
- [Test Plan](driver-dashboard-test-plan.md)
