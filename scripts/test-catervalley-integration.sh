#!/bin/bash

# CaterValley Integration Test Script
# This script tests all the Ready Set API endpoints that CaterValley needs

# Configuration
BASE_URL="http://localhost:3000"  # Change this to your production URL
API_KEY="ready-set"
PARTNER="catervalley"

echo "🚀 Testing CaterValley Integration with Ready Set"
echo "================================================"
echo "Base URL: $BASE_URL"
echo "API Key: $API_KEY"
echo "Partner: $PARTNER"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "partner: $PARTNER" \
            -H "x-api-key: $API_KEY")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "partner: $PARTNER" \
            -H "x-api-key: $API_KEY" \
            -d "$data")
    fi
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ SUCCESS (HTTP $http_code)${NC}"
        echo "Response: $response_body" | jq . 2>/dev/null || echo "Response: $response_body"
    else
        echo -e "${RED}❌ FAILED (HTTP $http_code)${NC}"
        echo "Response: $response_body"
    fi
    echo ""
}

# Test 1: Status Endpoint
test_endpoint "GET" "/api/cater-valley/status" "" "Integration Status Check"

# Test 2: Draft Order - Standard delivery with 30 headcount
draft_order_data='{
  "orderCode": "TEST_SCRIPT_001",
  "deliveryDate": "2025-05-30",
  "deliveryTime": "14:00",
  "totalItem": 30,
  "priceTotal": 400.00,
  "pickupLocation": {
    "name": "Test Restaurant",
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA"
  },
  "dropOffLocation": {
    "name": "Test Company",
    "address": "456 Market St",
    "city": "San Francisco",
    "state": "CA",
    "recipient": {
      "name": "John Doe",
      "phone": "5551234567"
    }
  }
}'

test_endpoint "POST" "/api/cater-valley/orders/draft" "$draft_order_data" "Create Draft Order (Standard Delivery)"

# Extract order ID from the last successful response for update/confirm tests
order_id=$(echo "$response_body" | jq -r '.id' 2>/dev/null)

if [ "$order_id" != "null" ] && [ "$order_id" != "" ]; then
    echo -e "${GREEN}📝 Order ID extracted: $order_id${NC}"
    echo ""
    
    # Test 3: Update Order - Over 10 miles delivery test
    update_order_data='{
      "id": "'$order_id'",
      "orderCode": "TEST_SCRIPT_001",
      "deliveryDate": "2025-05-30",
      "deliveryTime": "15:00",
      "totalItem": 50,
      "priceTotal": 750.00,
      "pickupLocation": {
        "name": "Test Restaurant",
        "address": "123 Main St",
        "city": "San Francisco",
        "state": "CA"
      },
      "dropOffLocation": {
        "name": "Test Company",
        "address": "2855 Campus Dr",
        "city": "San Jose",
        "state": "CA",
        "recipient": {
          "name": "John Doe",
          "phone": "5551234567"
        }
      }
    }'
    
    test_endpoint "POST" "/api/cater-valley/orders/update" "$update_order_data" "Update Draft Order (Over 10 Miles Test)"
    
    # Test 4: Large Order Test - 100+ headcount for percentage pricing
    large_order_data='{
      "orderCode": "TEST_LARGE_001",
      "deliveryDate": "2025-05-30",
      "deliveryTime": "16:00",
      "totalItem": 120,
      "priceTotal": 1500.00,
      "pickupLocation": {
        "name": "Catering Company",
        "address": "789 Restaurant Row",
        "city": "San Francisco",
        "state": "CA"
      },
      "dropOffLocation": {
        "name": "Corporate Event",
        "address": "303 Almaden Blvd",
        "city": "San Jose", 
        "state": "CA",
        "recipient": {
          "name": "Event Coordinator",
          "phone": "5551234567"
        }
      }
    }'
    
    test_endpoint "POST" "/api/cater-valley/orders/draft" "$large_order_data" "Create Large Order (100+ headcount, percentage pricing)"
    
    # Test 5: Confirm Original Order
    confirm_order_data='{
      "id": "'$order_id'",
      "isAccepted": true
    }'
    
    test_endpoint "POST" "/api/cater-valley/orders/confirm" "$confirm_order_data" "Confirm Order"
    
else
    echo -e "${RED}❌ Could not extract order ID from draft response. Skipping update/confirm tests.${NC}"
    echo ""
fi

# Test 6: Over 30 Miles Test (Long Distance)
long_distance_order='{
  "orderCode": "TEST_LONG_001",
  "deliveryDate": "2025-05-30",
  "deliveryTime": "17:00",
  "totalItem": 35,
  "priceTotal": 450.00,
  "pickupLocation": {
    "name": "SF Restaurant",
    "address": "100 Market St",
    "city": "San Francisco",
    "state": "CA"
  },
  "dropOffLocation": {
    "name": "South Bay Office",
    "address": "1600 Amphitheatre Parkway",
    "city": "Mountain View",
    "state": "CA",
    "recipient": {
      "name": "Tech Coordinator",
      "phone": "5551234567"
    }
  }
}'

test_endpoint "POST" "/api/cater-valley/orders/draft" "$long_distance_order" "Create Long Distance Order (Over 30 Miles Test)"

# Test 7: Test Authentication Failure
echo -e "${YELLOW}Testing: Authentication Failure (should fail)${NC}"
echo "Endpoint: POST /api/cater-valley/orders/draft (without auth)"

auth_fail_response=$(curl -s -w "\n%{http_code}" -X "POST" "$BASE_URL/api/cater-valley/orders/draft" \
    -H "Content-Type: application/json" \
    -d "$draft_order_data")

auth_fail_code=$(echo "$auth_fail_response" | tail -n1)
auth_fail_body=$(echo "$auth_fail_response" | head -n -1)

if [ "$auth_fail_code" = "401" ]; then
    echo -e "${GREEN}✅ EXPECTED FAILURE (HTTP $auth_fail_code) - Authentication working correctly${NC}"
else
    echo -e "${RED}❌ UNEXPECTED RESULT (HTTP $auth_fail_code) - Authentication may not be working${NC}"
fi
echo "Response: $auth_fail_body"
echo ""

# Test 8: Test Non-existent Endpoint (should trigger catch-all debug)
test_endpoint "POST" "/api/cater-valley/nonexistent" '{"test": "data"}' "Non-existent Endpoint (should be caught by debug)"

echo "🏁 Integration Test Complete"
echo "=========================="
echo ""
echo "📋 Summary:"
echo "- If all tests show ✅ SUCCESS, the integration is working correctly"
echo "- If you see ❌ FAILED, check the error messages and server logs"
echo "- The authentication failure test should show 'EXPECTED FAILURE'"
echo "- The non-existent endpoint test should be caught by the debug endpoint"
echo ""
echo "🔧 Next Steps:"
echo "1. Share this test script with CaterValley team"
echo "2. Ask them to run it against your production URL"
echo "3. Check server logs for any debug information"
echo "4. Coordinate with CaterValley to verify their configuration" 