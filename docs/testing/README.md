# Testing Documentation

This guide covers the testing infrastructure, patterns, and best practices for the Ready Set application.

## Test Stack

| Tool | Purpose |
|------|---------|
| Jest | Unit and integration testing |
| React Testing Library | Component testing |
| Playwright | End-to-end testing |
| TanStack Query | Async state testing |

## Coverage Requirements

- **CI Threshold**: 80% pass rate (enforced in CI pipeline)
- **Target**: 95%+ pass rate (will increase threshold as tests improve)
- **Coverage Report**: Generated in `coverage/` directory

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run in watch mode
pnpm test:unit:watch

# Run with coverage
pnpm test:ci

# Run specific test file
pnpm test src/__tests__/path/to/file.test.ts

# Run tests matching pattern
pnpm test --testPathPattern="AddressManager"
```

### Integration Tests

```bash
# Run integration tests only
pnpm test:integration
```

### E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e e2e/auth/login.spec.ts
```

### All Tests

```bash
# Run complete test suite
pnpm test:all
```

## Writing Tests

### File Naming Conventions

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` (in `e2e/` directory)

### Directory Structure

```
src/
├── __tests__/
│   ├── api/                 # API route tests
│   ├── components/          # Component tests
│   ├── hooks/               # Hook tests
│   ├── integration/         # Integration tests
│   ├── security/            # Security tests
│   └── helpers/             # Test utilities
e2e/
├── auth/                    # Authentication E2E tests
├── orders/                  # Order flow E2E tests
└── fixtures/                # Test fixtures
```

### Mocking Guidelines

#### Supabase Client
```typescript
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user123", user_metadata: { role: "client" } } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    from: jest.fn((table) => createMockQueryBuilder()),
  })),
}));
```

#### React Query
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

render(<Component />, { wrapper: createWrapper() });
```

#### Fetch API
```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({ data: mockData }),
});
```

### Testing Patterns

#### Async Components
```typescript
await waitFor(() => {
  expect(screen.getByText("Expected Text")).toBeInTheDocument();
});
```

#### User Interactions
```typescript
const user = userEvent.setup();
await user.click(screen.getByRole("button", { name: /submit/i }));
```

#### API Routes
```typescript
const request = new NextRequest("http://localhost/api/endpoint", {
  method: "POST",
  body: JSON.stringify(data),
});
const response = await POST(request);
expect(response.status).toBe(200);
```

## CI/CD Integration

### GitHub Actions

The CI pipeline runs on every pull request and push to main/development:

1. **Lint & Type Check** - ESLint and TypeScript validation (blocking)
2. **Unit Tests** - Jest with 80% pass rate threshold (blocking)
3. **Build Check** - Production build validation (non-blocking)
4. **E2E Tests** - Playwright (requires secrets configuration)

### Pass Rate Threshold

Tests are enforced with a pass rate threshold:
- **Current threshold**: 80%
- **Target**: 95%

If the pass rate falls below the threshold, CI will fail.

## Pre-commit Hooks

### Current Configuration (Staged Rollout)

**Pre-commit** (fast feedback):
- Lint check only

**Pre-push** (comprehensive):
- TypeScript type checking
- Lint check
- Prisma schema validation

### Full Hooks (Coming Soon)
See `.husky/pre-commit.enhanced` and `.husky/pre-push.enhanced` for full versions.

## Troubleshooting

### Common Issues

#### "No QueryClient set"
Wrap components using React Query in `QueryClientProvider`:
```typescript
render(<Component />, { wrapper: createWrapper() });
```

#### Supabase mock errors
Ensure your mock includes all methods the component uses:
- `auth.getUser()`, `auth.getSession()`
- `from()` with query builder chain

#### Async test failures
Use `waitFor` for async operations and avoid test pollution with proper cleanup.

### Known Limitations

Some tests are documented as known limitations:
- Complex filter tests requiring mock-level changes
- Tests requiring specific environment configurations

See individual test files for `@skip` annotations with explanations.

## Additional Documentation

- [Calculator Tests](./CALCULATOR_TESTS.md)
- [User Deletion Testing](./user-deletion-testing-guide.md)
- [Realtime Testing](./REALTIME_TESTING_CHECKLIST.md)
- [PR Footer Tests](./PR_FOOTER_TESTS.md)

## Support

For test-related questions, consult:
1. This documentation
2. Jest documentation: https://jestjs.io/
3. Testing Library docs: https://testing-library.com/
4. Playwright docs: https://playwright.dev/
