# Order Status Testing Documentation

This document outlines the comprehensive testing suite for the Order Status functionality that was implemented and fixed.

## Overview

The Order Status feature includes:
- Client Dashboard with order cards and "View All" link
- Order Status page with paginated order table
- Individual Order Details page
- API endpoints for fetching orders and order details
- Navigation between all components

## Test Coverage

### 1. Integration Tests (`src/__tests__/order-status-integration.test.tsx`)

**Purpose**: Test the complete integration between components and API endpoints.

**Test Cases**:
- ✅ **UserOrdersTable Component**
  - Renders orders table with pagination
  - Displays correct order information
  - Handles pagination correctly
  - Displays 5 orders per page
  - Shows pagination information in center

- ✅ **UserOrderDetail Component**
  - Renders order details correctly
  - Displays address information
  - Shows special notes
  - Shows "Back to Orders" button
  - Handles order not found gracefully
  - Handles API errors gracefully

- ✅ **ClientDashboardContent Component**
  - Renders dashboard with order cards
  - Displays correct order information in cards
  - "View Details" links point to correct order status page
  - Displays dashboard stats correctly
  - "View All" link points to order status page

- ✅ **API Integration**
  - User orders API returns correct pagination data
  - Individual order API returns correct order data

### 2. Unit Tests (`src/__tests__/api/user-orders.test.ts`)

**Purpose**: Test individual API endpoints in isolation.

**Test Cases**:
- ✅ **GET /api/user-orders**
  - Returns orders with pagination data
  - Handles authentication error
  - Handles database errors gracefully
  - Returns correct pagination for multiple pages

- ✅ **GET /api/user-orders/[order_number]**
  - Returns order details for valid order number
  - Returns order details for on-demand order
  - Returns 404 for non-existent order
  - Handles authentication error
  - Handles database errors gracefully
  - Correctly maps database fields to frontend format

### 3. End-to-End Tests (`e2e/order-status-workflow.spec.ts`)

**Purpose**: Test the complete user workflow from browser perspective.

**Test Cases**:
- ✅ **Complete Workflow**
  - Dashboard → Order Status → Order Details → Back to Orders
  - Verifies all navigation links work correctly
  - Checks that order information displays properly (not N/A or NaN)

- ✅ **Pagination**
  - Tests pagination controls work correctly
  - Verifies pagination information displays
  - Tests navigation between pages

- ✅ **Order Details**
  - Verifies all order information sections are present
  - Checks addresses display correctly
  - Tests driver details section

- ✅ **Error Handling**
  - Tests invalid order handling
  - Verifies graceful error messages

- ✅ **Navigation**
  - Tests all navigation links point to correct URLs
  - Verifies "View All" and "View Details" links

- ✅ **Responsive Design**
  - Tests mobile viewport compatibility
  - Verifies all pages work on mobile devices

- ✅ **Loading States**
  - Tests loading indicators display correctly
  - Verifies smooth transitions between states

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom msw jest
```

### Run All Tests
```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Run E2E Tests
```bash
# Install Playwright
npx playwright install

# Run E2E tests
npx playwright test e2e/order-status-workflow.spec.ts

# Run E2E tests in headed mode
npx playwright test e2e/order-status-workflow.spec.ts --headed

# Run E2E tests with debug
npx playwright test e2e/order-status-workflow.spec.ts --debug
```

### Run Specific Test Suites
```bash
# Run only integration tests
npm test order-status-integration

# Run only API tests
npm test user-orders.test

# Run only E2E tests
npx playwright test order-status-workflow
```

## Test Data

### Mock Orders
The tests use consistent mock data that matches the expected API response format:

```typescript
const mockOrders = [
  {
    id: '1',
    order_number: 'SF-12360',
    order_type: 'catering',
    status: 'active',
    date: '2025-07-30T12:00:00Z',
    order_total: '234.00',
    // ... other fields
  }
];
```

### Mock Order Detail
```typescript
const mockOrderDetail = {
  id: '1',
  order_number: 'SF-12360',
  order_type: 'catering',
  status: 'active',
  // ... complete order details
};
```

## Key Testing Scenarios

### 1. Fixed Issues
- ✅ **Broken "View All" Link**: Now correctly redirects to `/order-status`
- ✅ **Order Details Display**: Fixed API field mapping to show actual data instead of N/A
- ✅ **Pagination**: Added proper pagination with 5 orders per page
- ✅ **Navigation**: "View Details" links now point to correct order status pages

### 2. Error Scenarios
- ✅ **Invalid Order Numbers**: Graceful 404 handling
- ✅ **API Errors**: Proper error messages and fallbacks
- ✅ **Authentication Errors**: 401 responses handled correctly
- ✅ **Database Errors**: 500 responses with meaningful messages

### 3. Edge Cases
- ✅ **Empty Order Lists**: Handles no orders gracefully
- ✅ **Large Order Lists**: Pagination works with many orders
- ✅ **Missing Data**: Handles null/undefined fields properly
- ✅ **Mobile Responsiveness**: All components work on mobile devices

## Test Environment Setup

### Mock Service Worker (MSW)
Used for API mocking in integration tests:
```typescript
const server = setupServer(
  rest.get('/api/user-orders', (req, res, ctx) => {
    // Mock response
  }),
  rest.get('/api/user-orders/:orderNumber', (req, res, ctx) => {
    // Mock response
  })
);
```

### Prisma Mocking
Database operations are mocked for unit tests:
```typescript
jest.mock('@/utils/prismaDB', () => ({
  prisma: mockPrisma,
}));
```

### Supabase Mocking
Authentication is mocked for testing:
```typescript
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));
```

## Continuous Integration

### GitHub Actions
The tests are configured to run in CI/CD pipeline:

```yaml
- name: Run Tests
  run: |
    npm test
    npm run test:e2e
```

### Pre-commit Hooks
Tests run automatically before commits to ensure code quality.

## Coverage Goals

- **Unit Tests**: >90% coverage for API endpoints
- **Integration Tests**: >85% coverage for component interactions
- **E2E Tests**: 100% coverage for critical user workflows

## Maintenance

### Adding New Tests
1. Follow the existing test structure
2. Use consistent mock data
3. Test both success and error scenarios
4. Include accessibility and responsive design tests

### Updating Tests
1. Update mock data when API changes
2. Maintain test isolation
3. Keep tests focused and readable
4. Document any new test scenarios

## Troubleshooting

### Common Issues
1. **MSW Not Working**: Ensure server is started in `beforeAll`
2. **Async Tests Failing**: Use `waitFor` for async operations
3. **Mock Data Mismatch**: Verify API response format matches mocks
4. **E2E Timeouts**: Increase timeout for slow operations

### Debug Commands
```bash
# Debug unit tests
npm test -- --verbose

# Debug E2E tests
npx playwright test --debug

# Run specific test
npm test -- --testNamePattern="specific test name"
```

This testing suite ensures the Order Status functionality is robust, reliable, and provides a great user experience across all scenarios. 