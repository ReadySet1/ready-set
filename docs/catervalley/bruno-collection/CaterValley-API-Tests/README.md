# CaterValley API Tests - Bruno Collection

This Bruno collection contains comprehensive tests for the CaterValley delivery fee fix.

## 🚀 Quick Start

### Import into Bruno

1. Open Bruno
2. Click the three dots (⋯) → **Import Collection**
3. Select this folder: `CaterValley-API-Tests`
4. Click **Import**

Or simply drag and drop this folder into Bruno!

### Select Environment

After importing:
1. Click the environment dropdown (top-right)
2. Choose either:
   - **Local** - for testing on `http://localhost:3000`
   - **Production** - for testing on `https://readysetllc.com`

## 📁 Collection Structure

```
CaterValley-API-Tests/
├── Bug Fix Tests/              # Tests verifying the $130 fix
│   ├── 1. Client Reported Issue (1.1 Miles)
│   ├── 2. Minimum Fee Enforcement
│   └── 3. Mileage Rate Verification (15 Miles)
├── Tier Tests/                 # Tests for each pricing tier
│   ├── Tier 1 - Small Order
│   ├── Tier 2 - Medium Order (26 People)
│   ├── Tier 3 - Large Order (50 People)
│   └── Tier 5 - Enterprise (120 People)
├── Complete Flow/              # End-to-end order flow
│   ├── 1. Create Draft Order
│   ├── 2. Update Order
│   └── 3. Confirm Order
└── environments/
    ├── Local.bru
    └── Production.bru
```

## ✅ Test Cases

### Bug Fix Tests (Critical)

These tests verify the fix for the reported issue:

1. **Client Reported Issue (1.1 Miles)**
   - **Expected:** $42.50 (was $130)
   - Verifies the EXACT scenario reported by client

2. **Minimum Fee Enforcement**
   - **Expected:** $42.50 for $10 order
   - Ensures minimum fee is always enforced

3. **Mileage Rate Verification (15 Miles)**
   - **Expected:** $90.50 (not $100)
   - Confirms $1.10/mile rate (not $3.00)

### Tier Tests

Tests for each pricing tier:

- **Tier 1:** ≤25 people OR ≤$300 → $42.50 (within 10 mi)
- **Tier 2:** 26-49 people OR $300.01-599.99 → $52.50
- **Tier 3:** 50-74 people OR $600-899.99 → $62.50
- **Tier 5:** 100+ people OR $1200+ → 10% of food cost

### Complete Flow

End-to-end testing:
1. Create draft order
2. Update order details
3. Confirm order for dispatch

## 🧪 Running Tests

### Run Individual Request
1. Select a request
2. Click **Send** button
3. View response in the right panel
4. Tests automatically run and show results

### Run Entire Folder
1. Right-click on a folder (e.g., "Bug Fix Tests")
2. Select **Run**
3. View test results summary

### Run Entire Collection
1. Click collection name
2. Click **Run** button
3. All requests execute in sequence
4. View comprehensive test report

## 📊 Expected Results

All tests should pass with these validations:

| Test Case | Expected Fee | Pass Criteria |
|-----------|--------------|---------------|
| 1.1 miles, 1 item | $42.50 | Not $130 ✅ |
| Min fee (low cost) | $42.50 | Minimum enforced ✅ |
| 15 miles, 1 item | $90.50 | Not $100 ✅ |
| 26 people, short | $52.50 | Tier 2 ✅ |
| 50 people, short | $62.50 | Tier 3 ✅ |
| 120 people | $150.00 | 10% of $1500 ✅ |
| Update flow | $42.50 | Min enforced ✅ |
| Confirm flow | SUCCESS | Order confirmed ✅ |

## 🔍 Test Assertions

Each request includes automated tests that verify:
- ✅ HTTP status codes
- ✅ Response structure
- ✅ Delivery fee calculations
- ✅ Tier pricing accuracy
- ✅ Minimum fee enforcement

## 🛠️ Variables

The collection uses environment variables:

```
BASE_URL: API base URL
PARTNER: catervalley
API_KEY: ready-set
orderId: (Runtime variable for order flow)
```

## 📝 Documentation

Each request includes:
- **Docs tab:** Detailed explanation and context
- **Tests tab:** Automated assertions
- **Examples:** Expected request/response

## 🐛 Troubleshooting

### 401 Unauthorized
- Check headers are set correctly
- Verify API key in environment

### 400 Bad Request
- Check request body format
- Verify date/time formats
- Ensure phone numbers are 10+ chars

### Still seeing $130
- Ensure you're on branch `fix/catervalley-delivery-fee-130`
- Restart development server
- Clear API caches

## 📚 Related Documentation

- **Fix Summary:** `../BUG_FIX_DELIVERY_FEE_SUMMARY.md`
- **API Contract:** `../API_CONTRACT.md`
- **Postman Version:** `../POSTMAN_TEST_EXAMPLES.md`

## 🚀 Next Steps

1. ✅ Import collection into Bruno
2. ✅ Select environment (Local or Production)
3. ✅ Run all tests
4. ✅ Verify all pass
5. 🔜 Share results with CaterValley team
6. 🔜 Deploy to staging
7. 🔜 Production deployment

## 💡 Tips

- **Bruno Advantage:** This collection is stored as files, perfect for version control!
- **Collaboration:** Share this folder with your team via Git
- **CLI Support:** Run tests in CI/CD with Bruno CLI
- **Documentation:** Built-in docs make tests self-explanatory

## 📞 Support

**Technical Issues:**
- Emmanuel Alanis: ealanis@readysetllc.com

**CaterValley Team:**
- Halil Han Badem: halil@catervalley.com
- Ugras Bassullu: ugras@catervalley.com

---

**Issue Tracker:** REA-183  
**Branch:** `fix/catervalley-delivery-fee-130`  
**Date:** November 13, 2025

