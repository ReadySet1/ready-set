# ReadySet API Tests (Bruno)

API test collection for the ReadySet application using [Bruno](https://www.usebruno.com/).

## Setup

### 1. Install Bruno
Download and install Bruno from: https://www.usebruno.com/downloads

### 2. Open Collection
1. Open Bruno
2. Click "Open Collection"
3. Navigate to `docs/bruno-api-tests/ReadySet-API-Tests`
4. Select the folder

### 3. Select Environment
1. Click the environment dropdown (top-right)
2. Select:
   - **Local**: `http://localhost:3000` (requires `pnpm dev`)
   - **Development**: Vercel preview deployment
   - **Production**: `https://readysetllc.com`

### 4. Configure Authentication (if needed)
For endpoints requiring authentication:
1. Open the environment settings
2. Set `AUTH_TOKEN` to a valid JWT token
3. You can get a token by logging in via the browser and copying from DevTools

## Test Coverage

This collection covers the changes in PR #166 (development → main):

### REA-209: CaterValley Shared Utilities
| Test | Description |
|------|-------------|
| Create Draft Order | Tests order creation with address parsing |
| Invalid Auth | Tests auth-utils.ts validation |
| Missing Auth | Tests missing API key handling |
| Update Order | Tests order updates via order-utils.ts |
| Confirm Order | Tests order confirmation flow |
| Address with Suite | Tests address-utils.ts suite extraction |

### REA-179: API Response Structure
| Test | Description |
|------|-------------|
| Health Check | Verifies JSON response structure |
| Calculator | Tests delivery fee response format |
| Order Debug | Tests admin endpoint responses |
| Order Metrics | Tests metrics endpoint structure |

### REA-180: File Uploads & Storage
| Test | Description |
|------|-------------|
| Get Upload URL | Tests signed URL generation |
| List Files | Tests file listing response |
| Invalid File Type | Tests file type validation |
| Storage Upload | Tests direct upload |
| Storage Cleanup | Tests cleanup process |

## Running Tests

### Run All Tests
1. Right-click on "ReadySet API Tests" collection
2. Select "Run"

### Run Folder
1. Right-click on a folder (e.g., "CaterValley")
2. Select "Run"

### Run Single Test
1. Open the test file
2. Click "Run" (play button)

## Test Flow (CaterValley)

For complete CaterValley testing, run in order:
1. **Create Draft Order** - Creates order, saves `orderId`
2. **Update Order** - Uses saved `orderId`
3. **Confirm Order** - Confirms the order

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BASE_URL` | API base URL |
| `CATER_VALLEY_URL` | CaterValley endpoint URL |
| `PARTNER` | CaterValley partner header |
| `API_KEY` | CaterValley API key |
| `AUTH_TOKEN` | JWT token for authenticated requests |

## Troubleshooting

### 401 Unauthorized
- Ensure `AUTH_TOKEN` is set in environment
- Token may have expired - get a fresh one

### Connection Refused (Local)
- Ensure dev server is running: `pnpm dev`
- Check server is on port 3000

### CaterValley 401
- Verify `API_KEY` matches server config
- Check `partner` header is set

## Related Files

- Existing CaterValley tests: `docs/catervalley/bruno-collection/`
- API routes: `src/app/api/`
- Test files: `src/__tests__/api/`
