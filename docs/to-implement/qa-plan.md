# QA Coverage Improvement Plan for Ready Set

## Executive Summary
This plan outlines a comprehensive strategy to improve QA coverage from the current failing state to a robust, maintainable test suite with 80%+ coverage.

## Current State Analysis

### Test Results
- **Total Test Suites**: 34 (33 failed, 1 passed)
- **Total Tests**: 36 (26 failed, 10 passed)
- **Coverage Target**: 70% (global)
- **Main Issues**: 
  - Module resolution errors
  - Next.js 15 compatibility issues
  - Mocking configuration problems

## Phase 1: Fix Existing Test Infrastructure (Week 1)

### 1.1 Update Jest Configuration
```typescript
// jest.config.js updates
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Fix module resolution
    '^@/(.*)$': '<rootDir>/src/$1',
    // Add CSS module mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Add static asset mocks
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
  // Update transform for Next.js 15
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
}
```

### 1.2 Create Missing Mock Files
```javascript
// test/__mocks__/fileMock.js
module.exports = 'test-file-stub';

// test/__mocks__/styleMock.js
module.exports = {};
```

### 1.3 Update Test Setup
```typescript
// jest.setup.ts
import '@testing-library/jest-dom';
import { loadEnvConfig } from '@next/env';

// Load env vars
loadEnvConfig(process.cwd());

// Fix TextEncoder/Decoder for Node 18+
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// Mock next/navigation properly
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
  useParams() {
    return {};
  },
}));
```

## Phase 2: Testing Strategy by Feature (Week 2-3)

### 2.1 Authentication Testing
```typescript
// src/components/Auth/__tests__/SignIn.test.tsx
describe('SignIn Component', () => {
  it('should update header on successful login');
  it('should handle invalid credentials');
  it('should support magic link login');
  it('should redirect to returnTo URL after login');
});

// src/components/Header/__tests__/Header.test.tsx
describe('Header Component', () => {
  it('should show Sign In/Up buttons when logged out');
  it('should show user menu when logged in');
  it('should update immediately after auth state change');
});
```

### 2.2 Address Management Testing
```typescript
// src/components/AddressManager/__tests__/AddressManager.test.tsx
describe('Address Manager', () => {
  it('should handle CA/California state input correctly');
  it('should validate address fields');
  it('should save addresses to database');
  it('should handle Bay Area selection');
});
```

### 2.3 Order Creation Testing
```typescript
// src/components/Orders/__tests__/OrderCreation.test.tsx
describe('Order Creation', () => {
  it('should create orders with valid addresses');
  it('should handle vendor order creation');
  it('should show only Bay Area in countries list');
  it('should validate required fields');
});
```

### 2.4 Admin Features Testing
```typescript
// src/app/(backend)/admin/__tests__/JobApplications.test.tsx
describe('Job Applications Admin', () => {
  it('should update application status');
  it('should export data to CSV');
  it('should handle permission errors gracefully');
});

// src/app/(backend)/admin/__tests__/Users.test.tsx
describe('Users Admin', () => {
  it('should display users based on permissions');
  it('should render vendor details correctly');
  it('should handle helpdesk user access');
});
```

## Phase 3: Integration Testing (Week 3-4)

### 3.1 E2E Test Setup with Playwright
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 3.2 Critical User Flows
```typescript
// e2e/auth-flow.spec.ts
test('complete authentication flow', async ({ page }) => {
  // Test login -> header update -> logout cycle
});

// e2e/order-flow.spec.ts
test('complete order creation flow', async ({ page }) => {
  // Test order creation with address selection
});

// e2e/admin-flow.spec.ts
test('admin management flow', async ({ page }) => {
  // Test admin features based on permissions
});
```

## Phase 4: Continuous Integration (Week 4)

### 4.1 GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:integration
      - run: pnpm test:e2e
      - uses: codecov/codecov-action@v3
```

### 4.2 Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "pnpm test:unit"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "jest --findRelatedTests"]
  }
}
```

## Phase 5: Testing Best Practices

### 5.1 Component Testing Pattern
```typescript
// Standard component test structure
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  // Rendering tests
  describe('rendering', () => {
    it('should render with default props');
    it('should render loading state');
    it('should render error state');
  });

  // Interaction tests
  describe('interactions', () => {
    it('should handle user clicks');
    it('should validate form inputs');
  });

  // Integration tests
  describe('integration', () => {
    it('should update parent state');
    it('should call API endpoints');
  });
});
```

### 5.2 API Testing Pattern
```typescript
// API route test structure
describe('API: /api/route-name', () => {
  it('should handle GET requests');
  it('should validate POST data');
  it('should check authentication');
  it('should return proper error codes');
});
```

## Implementation Checklist

### Week 1: Infrastructure
- [ ] Fix Jest configuration for Next.js 15
- [ ] Update all mock files
- [ ] Fix failing test imports
- [ ] Set up proper environment variables

### Week 2: Unit Tests
- [ ] Auth component tests (SignIn, SignUp, Header)
- [ ] Address management tests
- [ ] Order creation tests
- [ ] User profile tests

### Week 3: Integration Tests
- [ ] Database integration tests
- [ ] API route tests
- [ ] Supabase auth integration
- [ ] Email notification tests

### Week 4: E2E & CI/CD
- [ ] Playwright E2E tests
- [ ] GitHub Actions setup
- [ ] Coverage reporting
- [ ] Performance benchmarks

## Success Metrics

### Coverage Goals
- **Unit Test Coverage**: 80%
- **Integration Test Coverage**: 70%
- **E2E Critical Paths**: 100%

### Quality Metrics
- Test execution time < 5 minutes
- Zero flaky tests
- All PRs require passing tests
- Coverage never decreases

## Testing Tools & Libraries

### Required Dependencies
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0",
    "@swc/jest": "^0.2.29",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "identity-obj-proxy": "^3.0.0",
    "msw": "^2.0.0"
  }
}
```

## Maintenance Plan

### Daily
- Run tests before committing
- Fix any failing tests immediately

### Weekly
- Review coverage reports
- Update tests for new features
- Refactor flaky tests

### Monthly
- Audit test performance
- Update testing dependencies
- Review and update test strategies

## Risk Mitigation

### Common Issues & Solutions
1. **Flaky Tests**: Use `waitFor` and proper async handling
2. **Slow Tests**: Mock external services, use test databases
3. **Coverage Gaps**: Focus on critical paths first
4. **Environment Issues**: Use consistent test data and seeds

## Conclusion

This comprehensive plan will transform the QA coverage from a failing state to a robust, maintainable test suite that ensures code quality and prevents regressions. The phased approach allows for gradual improvement while maintaining development velocity.