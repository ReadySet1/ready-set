# CaterValley Integration - Implementation Checklist

## Phase 1: Foundation Setup

### Environment Variables
```bash
# .env.local or .env
CATERVALLEY_API_KEY="ready-set"
CATERVALLEY_WEBHOOK_URL="https://api.catervalley.com/api/operation/order/update-order-status"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

- [ ] Add environment variables to `.env.local`
- [ ] Add environment variables to production environment (Vercel/Railway/etc.)
- [ ] Verify API key matches agreed value with CaterValley
- [ ] Verify webhook URL is correct production endpoint

### Database Setup

- [ ] Add CaterValley tables to Prisma schema
- [ ] Run database migration: `npx prisma migrate dev --name add_catervalley_tables`
- [ ] Verify tables created successfully
- [ ] Sync schema to production: `npx prisma migrate deploy`
- [ ] Test database connection

### Dependencies

```bash
npm install date-fns date-fns-tz zod
```

- [ ] Install required dependencies
- [ ] Verify types are working correctly
- [ ] Update TypeScript configuration if needed

## Phase 2: Core Implementation

### Type Definitions
- [ ] Copy `types/catervalley.ts` to project
- [ ] Verify all types are properly exported
- [ ] Ensure no conflicting type names with existing code

### API Endpoints

#### Draft Order Endpoint
- [ ] Create `/app/api/cater-valley/orders/draft/route.ts`
- [ ] Implement authentication validation
- [ ] Implement request validation with Zod
- [ ] Implement pricing calculation
- [ ] **CRITICAL**: Enforce minimum delivery fee of $42.50
- [ ] Implement time conversion (local → UTC)
- [ ] Create draft order in database
- [ ] Return proper response format
- [ ] Add error handling
- [ ] Add logging

#### Update Order Endpoint
- [ ] Create `/app/api/cater-valley/orders/update/route.ts`
- [ ] Implement order lookup by ID
- [ ] Implement delta updates (merge with existing)
- [ ] Recalculate pricing
- [ ] **CRITICAL**: Enforce minimum delivery fee of $42.50
- [ ] Update database record
- [ ] Add error handling

#### Confirm Order Endpoint
- [ ] Create `/app/api/cater-valley/orders/confirm/route.ts`
- [ ] Implement order finalization
- [ ] Generate ReadySet order number
- [ ] Update order status to CONFIRMED
- [ ] Return confirmation with tracking info
- [ ] Trigger driver assignment workflow
- [ ] Add error handling

#### Status Endpoint
- [ ] Create `/app/api/cater-valley/status/route.ts`
- [ ] Implement health check
- [ ] Check database connectivity
- [ ] Return API version and uptime
- [ ] Add service status details

### Utility Functions

#### Authentication (`lib/catervalley/auth.ts`)
- [ ] Implement header validation
- [ ] Verify Content-Type header
- [ ] Verify partner header
- [ ] Verify x-api-key header
- [ ] Return detailed error messages

#### Time Conversion (`lib/catervalley/time.ts`)
- [ ] Implement local to UTC conversion
- [ ] Implement UTC to local conversion
- [ ] Handle daylight saving time correctly
- [ ] Implement peak time detection
- [ ] Add timezone configuration

#### Pricing Calculation (`lib/catervalley/pricing.ts`)
- [ ] Implement head count tier pricing
- [ ] Implement food cost tier pricing
- [ ] Implement peak time multiplier
- [ ] **CRITICAL**: Implement minimum fee enforcement ($42.50)
- [ ] Implement discount calculation
- [ ] Add pricing validation
- [ ] Add comprehensive logging

#### Webhook Delivery (`lib/catervalley/webhook.ts`)
- [ ] Implement webhook sending function
- [ ] Implement retry logic (3 attempts)
- [ ] Implement exponential backoff
- [ ] Add timeout handling
- [ ] Log all delivery attempts
- [ ] Handle network errors gracefully

#### Database Functions (`lib/catervalley/database.ts`)
- [ ] Implement createDraftOrder
- [ ] Implement updateDraftOrder
- [ ] Implement confirmOrder
- [ ] Implement getOrderById
- [ ] Implement getOrderByOrderNumber
- [ ] Implement addStatusUpdate
- [ ] Implement updateOrderStatus
- [ ] Implement logWebhookDelivery
- [ ] Implement checkDatabaseConnection

## Phase 3: Testing

### Unit Tests
- [ ] Test authentication validation
- [ ] Test time conversion functions
- [ ] Test pricing calculation logic
- [ ] Test minimum fee enforcement
- [ ] Test peak time detection
- [ ] Test webhook delivery logic
- [ ] Run all unit tests: `npm test`

### Integration Tests
- [ ] Test draft order endpoint
- [ ] Test update order endpoint
- [ ] Test confirm order endpoint
- [ ] Test status endpoint
- [ ] Test invalid authentication
- [ ] Test invalid request payloads
- [ ] Test time conversion accuracy
- [ ] Test minimum fee enforcement
- [ ] Test peak time pricing
- [ ] Run integration tests: `npm test -- integration`

### Postman/cURL Testing
```bash
# Test Draft Order
curl -X POST https://readysetllc.com/api/cater-valley/orders/draft \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: ready-set" \
  -d '{
    "orderCode": "TEST-001",
    "deliveryAddress": {...},
    "pickupLocation": {...},
    "deliveryTime": "11:00",
    "priceTotal": 173.87,
    "items": [...]
  }'
```

- [ ] Test draft order with valid request
- [ ] Test draft order with minimum fee scenario
- [ ] Test draft order with peak time
- [ ] Test update order with valid ID
- [ ] Test update order with invalid ID
- [ ] Test confirm order
- [ ] Test status endpoint
- [ ] Test with invalid authentication
- [ ] Verify all responses match specification

### End-to-End Testing
- [ ] Create test order from CaterValley demo account
- [ ] Verify order appears in ReadySet database
- [ ] Verify pricing is correct (min $42.50)
- [ ] Verify time conversion is correct (UTC)
- [ ] Update the order and verify recalculation
- [ ] Confirm the order
- [ ] Verify order number generated correctly
- [ ] Send status updates via webhook
- [ ] Verify status updates appear in CaterValley system
- [ ] Test complete order lifecycle

## Phase 4: Webhook Implementation

### Status Update Functionality
- [ ] Create function to send courier status updates
- [ ] Implement status mapping (ReadySet → CaterValley)
- [ ] Test webhook with all status types:
  - [ ] ASSIGNED
  - [ ] PICKED_UP
  - [ ] ON_THE_WAY
  - [ ] ARRIVED
  - [ ] DELIVERED
  - [ ] CANCELLED
  - [ ] FAILED

### Driver Integration
- [ ] Integrate with driver assignment system
- [ ] Trigger ASSIGNED webhook when driver assigned
- [ ] Trigger PICKED_UP webhook when driver picks up order
- [ ] Trigger ON_THE_WAY webhook when driver starts delivery
- [ ] Trigger ARRIVED webhook when driver arrives
- [ ] Trigger DELIVERED webhook when order completed

### Webhook Monitoring
- [ ] Set up webhook delivery logging
- [ ] Create dashboard for webhook status
- [ ] Set up alerts for failed webhooks
- [ ] Implement webhook retry queue
- [ ] Test retry mechanism

## Phase 5: Production Deployment

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed by team
- [ ] Environment variables configured in production
- [ ] Database migrations applied to production
- [ ] Minimum delivery fee ($42.50) verified
- [ ] Time conversion tested with production data
- [ ] Webhook URL updated to production
- [ ] Error tracking configured (Sentry/etc.)
- [ ] Logging configured
- [ ] Performance monitoring set up

### Deployment Steps
1. [ ] Deploy to staging environment
2. [ ] Run smoke tests on staging
3. [ ] Coordinate with CaterValley team
4. [ ] Deploy to production
5. [ ] Verify all endpoints accessible
6. [ ] Test with CaterValley demo account
7. [ ] Monitor logs for any errors
8. [ ] Confirm webhook delivery working

### Post-Deployment Verification
- [ ] Test draft order creation
- [ ] Test order updates
- [ ] Test order confirmation
- [ ] Test status endpoint
- [ ] Verify minimum fee enforcement
- [ ] Verify time conversion accuracy
- [ ] Test webhook delivery
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Verify database performance

### Documentation
- [ ] API documentation complete
- [ ] Internal runbook created
- [ ] Error handling documented
- [ ] Monitoring dashboard set up
- [ ] Support contact information documented
- [ ] Escalation procedures defined

## Phase 6: Monitoring & Maintenance

### Ongoing Monitoring
- [ ] Set up daily order volume monitoring
- [ ] Monitor API response times
- [ ] Monitor webhook delivery success rate
- [ ] Monitor database performance
- [ ] Track pricing calculation accuracy
- [ ] Monitor minimum fee enforcement

### Alerts
- [ ] Alert on API errors > 5% rate
- [ ] Alert on webhook failures > 10% rate
- [ ] Alert on database connection issues
- [ ] Alert on orders below minimum fee
- [ ] Alert on time conversion errors

### Regular Reviews
- [ ] Weekly review of error logs
- [ ] Monthly review of pricing accuracy
- [ ] Quarterly review with CaterValley team
- [ ] Review and update documentation

## Critical Issues to Watch

### 🚨 MINIMUM DELIVERY FEE ($42.50)
**Status**: MUST BE ENFORCED  
**Last Issue**: Nov 5, 2025 - Test showed $35 instead of $42.50  
**Action Items**:
- [ ] Verify all pricing calculations enforce minimum
- [ ] Add explicit validation in response
- [ ] Add warning when minimum applied
- [ ] Test edge cases thoroughly

### Time Conversion (Local → UTC)
**Status**: FIXED (June 24, 2025)  
**Last Issue**: June 23, 2025 - Returning local time instead of UTC  
**Action Items**:
- [ ] Verify all timestamps have "Z" suffix
- [ ] Test during DST transitions
- [ ] Verify with various delivery times

### Webhook Reliability
**Status**: OPERATIONAL  
**Action Items**:
- [ ] Monitor delivery success rate
- [ ] Ensure retry mechanism working
- [ ] Log all attempts for debugging

## Contact Information

### ReadySet Team
- Emmanuel Alanis: ealanis@readysetllc.com (Primary)
- Gary Vinson: gary@readysetllc.com
- Mark Fuentes: mark@readysetllc.com

### CaterValley Team
- Halil Han Badem (CTO): halil@catervalley.com, (408) 217-5114
- Ugras Bassullu: ugras@catervalley.com, (650) 519-6151
- Idris Eyrice: idris@catervalley.com

### Resources
- API Specification: `/docs/catervalley-integration-spec.md`
- Postman Documentation: https://documenter.getpostman.com/view/32527900/2sAYHxn3vs
- Production Webhook: https://api.catervalley.com/api/operation/order/update-order-status

## Rollback Procedure

If issues arise after deployment:

1. [ ] Notify CaterValley team immediately
2. [ ] Switch webhook URL to maintenance mode
3. [ ] Roll back to previous deployment
4. [ ] Restore database if needed
5. [ ] Investigate root cause
6. [ ] Fix and re-test
7. [ ] Re-deploy when ready
8. [ ] Notify CaterValley team

## Success Criteria

✅ All API endpoints returning correct responses  
✅ Minimum delivery fee of $42.50 enforced 100% of the time  
✅ Time conversion accurate (local → UTC)  
✅ Webhook delivery success rate > 95%  
✅ Order creation and confirmation working smoothly  
✅ No critical errors in production  
✅ CaterValley team satisfied with integration  
✅ Orders flowing through system successfully
