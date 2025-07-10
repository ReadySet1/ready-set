#!/bin/bash

echo "🔗 Testing New CaterValley Webhook URL"
echo "======================================"
echo ""

WEBHOOK_URL="https://api.catervalley.com/api/operation/order/update-order-status"
API_KEY="ready-set"
PARTNER="ready-set"

echo "🌐 Webhook URL: $WEBHOOK_URL"
echo "🔑 API Key: $API_KEY"
echo "👥 Partner: $PARTNER"
echo ""

echo "Test 1: OPTIONS Request (Connectivity Check)"
echo "--------------------------------------------"
HTTP_STATUS=$(curl -w "%{http_code}" -s -o /tmp/options_response.txt \
  -X OPTIONS "$WEBHOOK_URL" \
  -H "partner: $PARTNER" \
  -H "x-api-key: $API_KEY")

if [ "$HTTP_STATUS" -eq 204 ] || [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ SUCCESS - OPTIONS request returned HTTP $HTTP_STATUS"
else
  echo "❌ FAILED - OPTIONS request returned HTTP $HTTP_STATUS"
  echo "Response: $(cat /tmp/options_response.txt)"
fi
echo ""

echo "Test 2: POST Request with Test Payload"
echo "--------------------------------------"
TEST_PAYLOAD='{"orderNumber": "TEST123", "status": "CONFIRM"}'
echo "Payload: $TEST_PAYLOAD"

HTTP_STATUS=$(curl -w "%{http_code}" -s -o /tmp/post_response.txt \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "partner: $PARTNER" \
  -H "x-api-key: $API_KEY" \
  -d "$TEST_PAYLOAD")

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $(cat /tmp/post_response.txt)"

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ SUCCESS - POST request successful"
else
  echo "❌ FAILED - POST request failed"
fi
echo ""

echo "Test 3: Comparison with Old URL (Expected to Fail)"
echo "--------------------------------------------------"
OLD_WEBHOOK_URL="https://api-courier.catervalley.com/api/order/update-order-status"
echo "Old URL: $OLD_WEBHOOK_URL"

HTTP_STATUS_OLD=$(curl -w "%{http_code}" -s -o /tmp/old_response.txt \
  -X POST "$OLD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "partner: $PARTNER" \
  -H "x-api-key: $API_KEY" \
  -d "$TEST_PAYLOAD")

echo "Old URL HTTP Status: $HTTP_STATUS_OLD"
echo "Old URL Response: $(cat /tmp/old_response.txt)"

if [ "$HTTP_STATUS_OLD" -ne 200 ]; then
  echo "✅ EXPECTED - Old URL should fail or behave differently"
else
  echo "⚠️  WARNING - Old URL still works (may need coordination with CaterValley)"
fi
echo ""

echo "🎯 Summary"
echo "=========="
echo "New Webhook URL: $WEBHOOK_URL"
echo "Status: $([ "$HTTP_STATUS" -eq 200 ] && echo "✅ WORKING" || echo "❌ NOT WORKING")"
echo ""
echo "Next Steps:"
echo "1. ✅ Update environment variables in production deployment"
echo "2. ✅ Deploy updated code to production"
echo "3. ✅ Test with real order status update"
echo "4. ✅ Notify CaterValley team of successful update"
echo ""

# Cleanup temp files
rm -f /tmp/options_response.txt /tmp/post_response.txt /tmp/old_response.txt 