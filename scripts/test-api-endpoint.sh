#!/bin/bash

# Test script for CaterValley timezone fix API endpoint
# Run this script after starting your development server with: npm run dev

echo "🧪 Testing CaterValley API Endpoint..."
echo ""

# Set the API endpoint
API_URL="http://localhost:3000/api/cater-valley/orders/draft"

# Test payload - exactly like Halil's test case
read -r -d '' PAYLOAD << 'EOF'
{
  "orderCode": "TIMEZONE_TEST_001",
  "deliveryDate": "2024-06-15",
  "deliveryTime": "11:00",
  "totalItem": 25,
  "priceTotal": 500.00,
  "pickupLocation": {
    "name": "Test Restaurant",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  },
  "dropOffLocation": {
    "name": "Test Office",
    "address": "456 Market St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "recipient": {
      "name": "John Doe",
      "phone": "4155551234"
    }
  }
}
EOF

echo "📡 Making request to: $API_URL"
echo "📅 Testing deliveryTime: '11:00' (PDT)"
echo "🎯 Expected pickupTime: '2024-06-15T17:15:00.000Z' (UTC)"
echo ""

# Make the API request
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "partner: catervalley" \
  -H "x-api-key: ${CATERVALLEY_API_KEY:-test-key}" \
  -d "$PAYLOAD")

# Parse response and status code
status_code=$(echo "$response" | tail -n1)
json_response=$(echo "$response" | sed '$d')

echo "📋 Results:"
echo "Status Code: $status_code"

if [ "$status_code" = "201" ] || [ "$status_code" = "200" ]; then
    echo "✅ Request successful!"
    echo ""
    echo "📊 Response:"
    echo "$json_response" | python3 -m json.tool 2>/dev/null || echo "$json_response"
    
    # Extract and check the estimatedPickupTime
    pickup_time=$(echo "$json_response" | grep -o '"estimatedPickupTime":"[^"]*"' | cut -d'"' -f4)
    
    echo ""
    echo "🔍 Timezone Fix Verification:"
    echo "  estimatedPickupTime: $pickup_time"
    
    if [[ "$pickup_time" == *".000Z" ]]; then
        echo "  ✅ Has UTC format (.000Z suffix)"
    else
        echo "  ❌ Missing UTC format (.000Z suffix)"
    fi
    
    if [ "$pickup_time" = "2024-06-15T17:15:00.000Z" ]; then
        echo "  ✅ Correct UTC conversion (11:00 PDT → 17:15 UTC)"
        echo ""
        echo "🎉 TIMEZONE FIX VERIFIED! Halil's issue is resolved."
        echo "📧 Ready to notify Halil for re-testing."
    else
        echo "  ❌ Incorrect UTC conversion"
        echo "  Expected: 2024-06-15T17:15:00.000Z"
        echo "  Actual:   $pickup_time"
    fi
    
else
    echo "❌ Request failed!"
    echo ""
    echo "📊 Error Response:"
    echo "$json_response"
    
    if [ "$status_code" = "000" ]; then
        echo ""
        echo "💡 Server is not running. Start it with: npm run dev"
    fi
fi

echo ""
echo "📋 Test Summary:"
echo "  • Input: deliveryTime '11:00' (local Pacific Time)"
echo "  • Expected: pickupTime '2024-06-15T17:15:00.000Z' (UTC)"
echo "  • This demonstrates the fix for Halil's reported issue" 