# Carrier Integration Setup Guide

## Quick Setup

### 1. Environment Variables

Add these to your `.env.local` file:

```bash
# CaterValley Integration
CATERVALLEY_WEBHOOK_URL=https://api.catervalley.com/api/operation/order/update-order-status
CATERVALLEY_API_KEY=your_api_key_here

# For local testing (optional mock endpoints)
# CATERVALLEY_WEBHOOK_URL=http://localhost:3001/mock/catervalley/webhook
```

### 2. Database Migration (if needed)

The integration uses existing database schema. Ensure your database is up to date:

```bash
pnpm db:push
# or
npx prisma db push
```

### 3. Testing the Integration

#### A. Create a CaterValley Order

1. Go to `/admin/catering-orders/new`
2. Fill out the form with:
   - **Brokerage**: Select "CaterValley ⚡ (Integrated)"
   - **Order Number**: Use format `CV-12345` (must start with `CV-`)
   - Fill in other required fields
3. Submit the order

#### B. Test Status Updates

1. Navigate to the created order details page
2. In the admin panel, find the order in the catering orders list
3. You should see the CaterValley badge on the order card
4. Update the driver status via API:

```bash
curl -X PATCH "http://localhost:3000/api/catering-requests/[order-id]/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your-session-token]" \
  -d '{
    "driverStatus": "ASSIGNED",
    "driverId": "optional-driver-uuid"
  }'
```

#### C. View Carrier Dashboard

1. Navigate to `/admin/carriers`
2. You should see the CaterValley integration card
3. Check connectivity status and order statistics
4. Test the "Test All" button to verify webhook connectivity

### 4. Dashboard Integration

The main dashboard at `/admin` now includes:

- **Carrier Summary Widget**: Shows carrier status and today's orders
- **Enhanced Order Cards**: Display carrier badges for integrated orders
- **Navigation**: "Carrier Integrations" link in the sidebar

## Testing Webhook Flow

### Mock Webhook Server (Optional)

For local testing, you can set up a simple mock server:

```javascript
// mock-webhook-server.js
const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

app.post('/mock/catervalley/webhook', (req, res) => {
  console.log('CaterValley Webhook Received:', req.body);
  console.log('Headers:', req.headers);
  
  // Simulate successful response
  res.json({ result: true, message: 'Status updated successfully' });
});

app.listen(PORT, () => {
  console.log(`Mock webhook server running on port ${PORT}`);
});
```

Run it with:
```bash
node mock-webhook-server.js
```

Then update your `.env.local`:
```bash
CATERVALLEY_WEBHOOK_URL=http://localhost:3001/mock/catervalley/webhook
```

### Test Webhook Delivery

1. Create a CaterValley order (CV- prefix)
2. Update the order status through the API
3. Check the mock server logs to see the webhook payload
4. Verify the webhook response in the API response

## Troubleshooting

### Common Issues

1. **Webhook timeouts**: Check `CATERVALLEY_WEBHOOK_URL` is accessible
2. **Authentication errors**: Verify `CATERVALLEY_API_KEY` is correct
3. **Order not detected as CaterValley**: Ensure order number starts with `CV-`
4. **Dashboard not loading carrier data**: Check browser console for API errors

### Debug Logging

Enable debug logging by checking the server console when:
- Creating orders with carrier integration
- Updating order status
- Testing carrier connectivity

### API Response Format

Successful status update response:
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "CV-12345",
    "status": "ASSIGNED",
    "driverStatus": "ASSIGNED",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "webhookResults": {
    "caterValley": {
      "success": true,
      "attempts": 1
    }
  },
  "message": "Order status successfully updated to ASSIGNED"
}
```

## Adding More Carriers

When ready to add additional carriers:

1. Update `CARRIER_CONFIGS` in `src/lib/services/carrierService.ts`
2. Add environment variables for the new carrier
3. Create API endpoints following the CaterValley pattern
4. Update brokerage options in form components
5. Test the integration using the same flow

The system is designed to be easily extensible for multiple carriers while maintaining the same dashboard experience. 