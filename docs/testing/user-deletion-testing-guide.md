# User Deletion Testing Strategy Guide

## Overview

This document outlines the comprehensive testing strategy for the user deletion endpoint (`DELETE /api/users/[userId]`). The testing suite covers authorization, database integrity, edge cases, frontend integration, and performance characteristics.

## Test Types

### 🔒 Unit Tests

**Location**: `src/__tests__/api/users/userId-delete.test.ts`

#### Authorization Tests

- ✅ Verify only ADMIN/SUPER_ADMIN can delete users
- ✅ Test SUPER_ADMIN protection logic (cannot delete SUPER_ADMIN users)
- ✅ Validate authentication requirement
- ✅ Prevent self-deletion attempts
- ✅ Block unauthorized user types (VENDOR, CLIENT, HELPDESK)

#### Database Integrity Tests

- ✅ Test deletion with various related record scenarios
- ✅ Verify CASCADE deletion behavior
- ✅ Test transaction rollback on failures
- ✅ Validate complex address relationship handling
- ✅ Ensure file uploads are preserved with null userId

#### Edge Case Testing

- ✅ Non-existent user deletion attempts
- ✅ Users with complex relationship webs
- ✅ Database connection failures
- ✅ Prisma error handling (P2025, P2003, P2002, etc.)
- ✅ Transaction timeout scenarios

#### Audit Trail Testing

- ✅ Successful deletion logging
- ✅ Failed deletion logging
- ✅ Performance timing capture

### 🔗 Integration Tests

**Location**: `src/__tests__/integration/user-deletion-flow.integration.test.ts`

#### Frontend Integration

- ✅ Test success response structure for UI consumption
- ✅ Verify error response format for error handling
- ✅ Validate response timing and performance

#### Database State Verification

- ✅ Before/after database snapshots
- ✅ Verify no orphaned records remain
- ✅ Check foreign key integrity after deletion
- ✅ End-to-end workflow validation

#### Cross-Component Integration

- ✅ Full deletion workflow from authentication to cleanup
- ✅ Transaction rollback verification
- ✅ Complex user scenario handling

### ⚡ Performance Tests

**Location**: `src/__tests__/performance/user-deletion-performance.test.ts`

#### Transaction Performance

- ✅ Measure deletion time for various user types
- ✅ Test with users having different amounts of related records
- ✅ Identify potential bottlenecks
- ✅ Performance consistency across multiple operations

#### Scalability Testing

- ✅ Users with varying amounts of related data
- ✅ Different user types performance comparison
- ✅ Concurrent deletion handling

#### Bottleneck Identification

- ✅ Individual operation timing within transactions
- ✅ Memory usage patterns and leak detection
- ✅ Database connection and transaction overhead
- ✅ Stress testing with concurrent requests

## Running Tests

### Prerequisites

- Node.js and pnpm installed
- Database connection configured
- Test environment variables set

### Quick Start

```bash
# Run all user deletion tests
./scripts/test-user-deletion.sh all

# Run specific test types
./scripts/test-user-deletion.sh unit
./scripts/test-user-deletion.sh integration
./scripts/test-user-deletion.sh performance

# Run with coverage reporting
./scripts/test-user-deletion.sh coverage

# Run in watch mode for development
./scripts/test-user-deletion.sh watch
```

### Using npm/pnpm Scripts

```bash
# Run all tests
pnpm test:user-deletion

# Run unit tests only
pnpm test:user-deletion:unit

# Run integration tests only
pnpm test:user-deletion:integration

# Run performance tests only
pnpm test:user-deletion:performance

# Run with coverage
pnpm test:user-deletion:coverage
```

### Manual Jest Commands

```bash
# Unit tests
pnpm jest src/__tests__/api/users/userId-delete.test.ts

# Integration tests
pnpm jest src/__tests__/integration/user-deletion-flow.integration.test.ts

# Performance tests
pnpm jest src/__tests__/performance/user-deletion-performance.test.ts --testTimeout=30000

# All user deletion tests with coverage
pnpm jest --testPathPattern="user.*delete" --coverage
```

## Test Environment Configuration

### Environment Variables

Ensure these are set in your test environment:

```bash
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
```

### Database Setup

- Integration and performance tests require a real database connection
- Unit tests use mocked Prisma client
- Tests automatically detect environment and skip database operations in test mode

## Performance Benchmarks

### Expected Performance Thresholds

| Test Type             | Threshold    | Description                        |
| --------------------- | ------------ | ---------------------------------- |
| Simple Deletion       | < 2 seconds  | User with minimal related data     |
| Complex Deletion      | < 5 seconds  | User with moderate related data    |
| Heavy Deletion        | < 8 seconds  | User with extensive related data   |
| Memory Usage          | < 50MB       | Heap memory increase per operation |
| Concurrent Operations | < 10 seconds | Multiple simultaneous deletions    |

### Performance Monitoring

- Transaction timing is logged for each deletion
- Memory usage is tracked for leak detection
- Database operation overhead is measured
- Performance warnings are logged for slow operations (>5 seconds)

## Debugging Test Failures

### Common Issues and Solutions

#### Authentication Failures

```bash
# Check if Supabase mocks are properly configured
# Verify user ID consistency between auth and profile lookups
```

#### Database Connection Issues

```bash
# Ensure DATABASE_URL is correctly set
# Check if database is running and accessible
# Verify Prisma client initialization
```

#### Transaction Timeout Errors

```bash
# Increase test timeout for performance tests
# Check database performance and connection pooling
# Verify transaction complexity is reasonable
```

#### Memory Leaks in Performance Tests

```bash
# Enable garbage collection: node --expose-gc
# Monitor heap usage patterns
# Check for circular references in test data
```

## Coverage Targets

### Minimum Coverage Requirements

- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

### Coverage Areas

- All authorization paths
- All database operation branches
- Error handling scenarios
- Edge cases and validations

## Continuous Integration

### GitHub Actions Integration

```yaml
- name: Run User Deletion Tests
  run: |
    pnpm install
    pnpm test:user-deletion:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/user-deletion/lcov.info
```

### Pre-commit Hooks

```bash
# Add to .husky/pre-commit
pnpm test:user-deletion:unit
```

## Test Data Management

### Test User Creation

- Tests create isolated test users with unique identifiers
- All test data includes timestamps to avoid conflicts
- Cleanup is performed in finally blocks to prevent test pollution

### Database State Management

- Integration tests capture before/after snapshots
- Performance tests measure database operation counts
- All tests ensure complete cleanup of created data

## Monitoring and Alerting

### Performance Alerts

- Tests log warnings for operations exceeding thresholds
- Memory usage spikes are detected and reported
- Database connection issues are captured and logged

### Audit Trail Verification

- All deletion operations must generate audit logs
- Audit logs include complete operation context
- Failed operations must log error details for debugging

## Best Practices

### Writing New Tests

1. Follow the existing test patterns and structure
2. Use descriptive test names that explain the scenario
3. Include both positive and negative test cases
4. Ensure proper cleanup in finally blocks
5. Mock external dependencies consistently

### Maintaining Tests

1. Update tests when endpoint behavior changes
2. Review performance thresholds periodically
3. Keep test data scenarios relevant and realistic
4. Monitor test execution times and optimize when needed

### Debugging Tests

1. Use verbose output for detailed failure information
2. Check console logs for audit trail information
3. Verify database state before and after operations
4. Use performance timing logs to identify bottlenecks

---

## Related Documentation

- [API Documentation](../api/user-deletion-endpoint.md)
- [Database Schema](../database/schema-relationships.md)
- [Performance Optimization](../performance/user-deletion-optimization.md)
- [Security Guidelines](../security/user-deletion-security.md)
