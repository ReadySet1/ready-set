# CaterValley Integration Troubleshooting Guide

## Common Issues and Solutions

### 1. "order_not_found" Error

**Symptoms:**
- Webhook returns: `{"result":false,"message":"order_not_found","data":{}}`
- Orders created in Ready Set admin don't trigger successful webhooks

**Root Cause:**
The order doesn't exist in CaterValley's system. This happens when:
- Orders are manually created in Ready Set without coming from CaterValley first
- There's an environment mismatch (staging vs production)
- The order integration flow is incomplete

**Solution:**
1. **Use the proper integration flow**:
   ```
   CaterValley → Ready Set (create order) → Ready Set → CaterValley (status updates)
   ```

2. **Test with CaterValley's staging environment**:
   ```bash
   # Update your .env to use staging endpoints if available
   CATERVALLEY_WEBHOOK_URL=https://api-staging.catervalley.com/api/order/update-order-status
   ```

3. **Coordinate with CaterValley team**:
   - Confirm the correct API environment (staging vs production)
   - Verify they have the same test orders in their system
   - Ensure order synchronization is working

### 2. "endpoint_not_found" Error

**Symptoms:**
- Webhook returns: `{"result":"error","message":"endpoint_not_found"}`

**Root Cause:**
- The API endpoint URL has changed
- Authentication headers are incorrect
- CaterValley's API is experiencing issues

**Solution:**
1. **Verify the endpoint URL**:
   ```bash
   # Test connectivity
   curl -i http://localhost:3000/api/test/catervalley-webhook
   ```

2. **Check authentication**:
   ```bash
   # Verify API key is correct
   echo $CATERVALLEY_API_KEY
   ```

3. **Contact CaterValley support** to confirm:
   - Current webhook URL
   - Required headers and authentication
   - API status and availability

### 3. Network Connectivity Issues

**Symptoms:**
- Timeout errors
- Connection refused
- SSL/TLS errors

**Solution:**
1. **Test basic connectivity**:
   ```bash
   # Test the webhook endpoint directly
   curl -v https://api-courier.catervalley.com/api/order/update-order-status
   ```

2. **Check firewall/proxy settings**:
   - Ensure outbound HTTPS traffic is allowed
   - Verify no corporate proxy is blocking requests
   - Check if IP whitelisting is required

### 4. Authentication Problems

**Symptoms:**
- HTTP 401 Unauthorized
- HTTP 403 Forbidden
- Authentication-related error messages

**Solution:**
1. **Verify environment variables**:
   ```bash
   # Check if variables are set
   printenv | grep CATERVALLEY
   ```

2. **Update authentication headers**:
   ```typescript
   // Ensure correct headers are being sent
   headers: {
     'Content-Type': 'application/json',
     'partner': 'ready-set',
     'x-api-key': process.env.CATERVALLEY_API_KEY,
   }
   ```

## Testing Procedures

### 1. Test Webhook Connectivity

```bash
# Basic connectivity test
curl -s http://localhost:3000/api/test/catervalley-webhook | jq .

# Test with real order data
curl -s -X POST http://localhost:3000/api/test/catervalley-webhook \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"TEST123","status":"CONFIRM"}' | jq .
```

### 2. Test Complete Integration Flow

1. **Have CaterValley create a test order**:
   ```bash
   # This should come from CaterValley's system
   curl -X POST http://localhost:3000/api/cater-valley/orders/draft \
     -H "Content-Type: application/json" \
     -H "partner: catervalley" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{
       "orderCode": "TEST_INTEGRATION_001",
       "deliveryDate": "2024-01-20",
       "deliveryTime": "14:00",
       "totalItem": 10,
       "priceTotal": 150.00,
       "pickupLocation": {...},
       "dropOffLocation": {...}
     }'
   ```

2. **Confirm the order**:
   ```bash
   curl -X POST http://localhost:3000/api/cater-valley/orders/confirm \
     -H "Content-Type: application/json" \
     -H "partner: catervalley" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"id":"ORDER_ID","isAccepted":true}'
   ```

3. **Test status updates**:
   ```bash
   curl -X PATCH http://localhost:3000/api/catering-requests/ORDER_ID/status \
     -H "Content-Type: application/json" \
     -d '{"driverStatus":"ASSIGNED","driverId":"test-driver-id"}'
   ```

## Environment Configuration Checklist

### Required Environment Variables

```bash
# CaterValley Integration
CATERVALLEY_WEBHOOK_URL=https://api-courier.catervalley.com/api/order/update-order-status
CATERVALLEY_API_KEY=your_api_key_here

# Optional: For development/staging
# CATERVALLEY_WEBHOOK_URL=https://api-staging.catervalley.com/api/order/update-order-status
```

### Verification Steps

1. ✅ **API Key is valid**
2. ✅ **Webhook URL is reachable**
3. ✅ **Headers are correctly formatted**
4. ✅ **Payload structure matches CaterValley's expectations**
5. ✅ **Order exists in both systems**
6. ✅ **Integration flow is properly implemented**

## Common Error Messages

| Error Message | HTTP Code | Cause | Solution |
|---------------|-----------|--------|----------|
| `order_not_found` | 404 | Order doesn't exist in CaterValley | Use proper integration flow |
| `endpoint_not_found` | 404 | Wrong URL or API changes | Verify endpoint with CaterValley |
| `unauthorized` | 401 | Invalid API key | Check authentication credentials |
| `forbidden` | 403 | Access denied | Verify API permissions |
| Connection timeout | - | Network issues | Check connectivity and firewall |

## Contact Information

### When to Contact CaterValley Support

1. **Endpoint URL changes** - Confirm current webhook URL
2. **Authentication issues** - Verify API key and headers
3. **Order synchronization problems** - Ensure orders exist in their system
4. **New environment setup** - Get staging/development credentials

### When to Contact Ready Set Development Team

1. **Webhook implementation bugs** - Code-level issues
2. **Database synchronization problems** - Order storage issues
3. **New feature requests** - Additional integration capabilities
4. **Performance optimization** - Webhook reliability improvements

## Development Tips

### Enable Debug Logging

Add this to your environment for detailed webhook logging:

```bash
# Enhanced logging for troubleshooting
DEBUG=webhook:*
LOG_LEVEL=debug
```

### Mock CaterValley for Testing

For local development, you can set up a mock webhook server:

```javascript
// mock-catervalley-server.js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/order/update-order-status', (req, res) => {
  console.log('Mock CaterValley received:', req.body);
  
  // Simulate different responses based on order number
  if (req.body.orderNumber === 'FAIL_TEST') {
    return res.status(404).json({
      result: false,
      message: 'order_not_found',
      data: {}
    });
  }
  
  res.json({
    result: true,
    message: 'Status updated successfully',
    data: {}
  });
});

app.listen(3001, () => {
  console.log('Mock CaterValley server running on port 3001');
});
```

Then update your environment:
```bash
CATERVALLEY_WEBHOOK_URL=http://localhost:3001/api/order/update-order-status
``` 