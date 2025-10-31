/**
 * Circuit Breaker Edge Case Tests
 *
 * Comprehensive tests for circuit breaker edge cases, race conditions,
 * concurrent operations, and boundary conditions.
 *
 * Part of REA-94: Add Edge Case Tests for Circuit Breaker
 */

import { ApiCircuitBreaker, DEFAULT_API_RESILIENCE_CONFIG } from '@/utils/api-resilience';

// Helper to wait for a specified time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create a fresh circuit breaker for each test
const createTestCircuitBreaker = (name: string = 'Test', config = {}) => {
  return new ApiCircuitBreaker(name, {
    ...DEFAULT_API_RESILIENCE_CONFIG,
    circuitBreakerThreshold: 3,
    circuitBreakerTimeout: 1000, // 1 second for faster tests
    inactivityResetTimeout: 2000, // 2 seconds for faster tests
    ...config,
  });
};

describe('Circuit Breaker Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // 1. CONCURRENT OPERATIONS
  // ==========================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent requests during state transition from closed to open', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Simulate 10 concurrent failures
      const failures = Array.from({ length: 10 }, () =>
        Promise.resolve().then(() => circuitBreaker.recordFailure())
      );

      await Promise.all(failures);

      const state = circuitBreaker.getState();
      expect(state.state).toBe('open');
      expect(state.failureCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle concurrent successes and failures', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Simulate mixed concurrent operations
      const operations = [
        ...Array.from({ length: 5 }, () => Promise.resolve().then(() => circuitBreaker.recordSuccess())),
        ...Array.from({ length: 5 }, () => Promise.resolve().then(() => circuitBreaker.recordFailure())),
      ];

      await Promise.all(operations);

      const state = circuitBreaker.getState();
      // State should be deterministic despite concurrent operations
      expect(['closed', 'open']).toContain(state.state);
    });

    it('should maintain consistency during concurrent isOpen checks', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Check state concurrently from multiple "threads"
      const checks = Array.from({ length: 100 }, () =>
        Promise.resolve(circuitBreaker.isOpen())
      );

      const results = await Promise.all(checks);

      // All checks should return the same result
      const allSame = results.every(result => result === results[0]);
      expect(allSame).toBe(true);
      expect(results[0]).toBe(true);
    });

    it('should handle concurrent getMonitoringData calls', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Generate some activity
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();

      // Concurrent monitoring data requests
      const monitoringCalls = Array.from({ length: 50 }, () =>
        Promise.resolve(circuitBreaker.getMonitoringData())
      );

      const results = await Promise.all(monitoringCalls);

      // All results should be consistent
      expect(results).toHaveLength(50);
      results.forEach(data => {
        expect(data.name).toBe('Test');
        expect(data.state).toBeDefined();
        expect(data.metrics).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // 2. RACE CONDITIONS
  // ==========================================================================

  describe('Race Conditions', () => {
    it('should handle race condition between recordFailure and state transition', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Record 2 failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Race: third failure triggering transition vs isOpen check
      const raceOperations = await Promise.allSettled([
        Promise.resolve().then(() => circuitBreaker.recordFailure()),
        Promise.resolve().then(() => circuitBreaker.isOpen()),
        Promise.resolve().then(() => circuitBreaker.recordFailure()),
      ]);

      // Circuit should be open after these operations
      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('should handle race condition in half-open state', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for half-open transition
      await wait(1100);

      // Force transition to half-open
      circuitBreaker.isOpen();

      // Race: concurrent success and failure in half-open
      const operations = await Promise.allSettled([
        Promise.resolve().then(() => circuitBreaker.recordSuccess()),
        Promise.resolve().then(() => circuitBreaker.recordFailure()),
      ]);

      const finalState = circuitBreaker.getState();
      // State should be deterministic (either closed or open, not stuck in half-open)
      expect(['closed', 'open']).toContain(finalState.state);
    });

    it('should prevent race condition in getState and reset', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Concurrent getState and reset operations
      const operations = await Promise.allSettled([
        Promise.resolve(circuitBreaker.getState()),
        Promise.resolve().then(() => circuitBreaker.reset()),
        Promise.resolve(circuitBreaker.getState()),
      ]);

      // Final state should be closed after reset
      expect(circuitBreaker.getState().state).toBe('closed');
    });
  });

  // ==========================================================================
  // 3. STATE TRANSITION EDGE CASES
  // ==========================================================================

  describe('State Transition Edge Cases', () => {
    it('should handle immediate failures in half-open state', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for transition to half-open
      await wait(1100);
      circuitBreaker.isOpen(); // Trigger transition check
      expect(circuitBreaker.getState().state).toBe('half-open');

      // Immediate failure should transition back to open
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('should handle requests at exact threshold boundary', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Record failures up to threshold - 1
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('closed');

      // One more failure should open circuit
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('should handle state transition at timeout boundary', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      const openTime = Date.now();

      // Wait almost until timeout
      await wait(900);
      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait past timeout
      await wait(200);
      expect(circuitBreaker.isOpen()).toBe(false); // Should trigger half-open
      expect(circuitBreaker.getState().state).toBe('half-open');
    });

    it('should handle rapid state transitions', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Rapid open/close cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Open
        for (let i = 0; i < 3; i++) {
          circuitBreaker.recordFailure();
        }
        expect(circuitBreaker.getState().state).toBe('open');

        // Wait and transition to half-open
        await wait(1100);
        circuitBreaker.isOpen();

        // Success to close
        circuitBreaker.recordSuccess();
        expect(circuitBreaker.getState().state).toBe('closed');
      }

      // Final state should be closed
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should handle inactivity reset correctly', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for inactivity reset (2 seconds)
      await wait(2100);

      // Check should trigger inactivity reset
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState().state).toBe('closed');
    });
  });

  // ==========================================================================
  // 4. BOUNDARY CONDITIONS
  // ==========================================================================

  describe('Boundary Conditions', () => {
    it('should handle zero threshold configuration', () => {
      const circuitBreaker = createTestCircuitBreaker('Test', {
        circuitBreakerThreshold: 0,
      });

      // With threshold 0, circuit opens immediately (0 >= 0 is true)
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('open');
    });

    it('should handle very high threshold', () => {
      const circuitBreaker = createTestCircuitBreaker('Test', {
        circuitBreakerThreshold: 1000,
      });

      // Many failures shouldn't open circuit
      for (let i = 0; i < 100; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState().state).toBe('closed');
      expect(circuitBreaker.getState().failureCount).toBe(100);
    });

    it('should handle rapid successive requests', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Rapid-fire requests
      for (let i = 0; i < 100; i++) {
        if (i < 3) {
          circuitBreaker.recordFailure();
        } else {
          circuitBreaker.recordSuccess();
        }
      }

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.totalRequests).toBe(100);
      expect(monitoring.metrics.totalFailures).toBe(3);
      expect(monitoring.metrics.totalSuccesses).toBe(97);
    });

    it('should handle success after threshold reached but before open', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Reach threshold - 1
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Success should reset failure count
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState().failureCount).toBe(0);

      // Should need 3 more failures to open
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('closed');

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState().state).toBe('open');
    });
  });

  // ==========================================================================
  // 5. HIGH LOAD SCENARIOS
  // ==========================================================================

  describe('High Load Scenarios', () => {
    it('should maintain consistency under high concurrent load', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Simulate 1000 concurrent operations
      const operations = Array.from({ length: 1000 }, (_, i) => {
        return Promise.resolve().then(() => {
          if (i % 2 === 0) {
            circuitBreaker.recordSuccess();
          } else {
            circuitBreaker.recordFailure();
          }
        });
      });

      await Promise.all(operations);

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.totalRequests).toBe(1000);
      expect(monitoring.metrics.totalSuccesses).toBe(500);
      expect(monitoring.metrics.totalFailures).toBe(500);
      expect(monitoring.metrics.failureRate).toBeCloseTo(50, 0);
    });

    it('should handle burst of failures followed by recovery', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Burst of failures
      for (let i = 0; i < 50; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState().state).toBe('open');

      // Wait for recovery
      await wait(1100);
      circuitBreaker.isOpen();
      expect(circuitBreaker.getState().state).toBe('half-open');

      // Recovery with successes
      for (let i = 0; i < 50; i++) {
        circuitBreaker.recordSuccess();
      }
      expect(circuitBreaker.getState().state).toBe('closed');

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.totalRequests).toBe(100);
    });

    it('should track metrics correctly under sustained load', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Sustained load with varying success/failure patterns
      for (let i = 0; i < 500; i++) {
        if (i < 100) {
          circuitBreaker.recordFailure();
        } else {
          circuitBreaker.recordSuccess();
        }
      }

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.totalRequests).toBe(500);
      expect(monitoring.metrics.totalFailures).toBe(100);
      expect(monitoring.metrics.totalSuccesses).toBe(400);
      expect(monitoring.metrics.failureRate).toBe(20);
    });

    it('should handle multiple concurrent monitoring data requests under load', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Generate activity
      const activityPromises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          if (i % 3 === 0) {
            circuitBreaker.recordFailure();
          } else {
            circuitBreaker.recordSuccess();
          }
        })
      );

      // Concurrent monitoring requests while under load
      const monitoringPromises = Array.from({ length: 50 }, () =>
        Promise.resolve(circuitBreaker.getMonitoringData())
      );

      await Promise.all([...activityPromises, ...monitoringPromises]);

      // Verify final state
      const finalMonitoring = circuitBreaker.getMonitoringData();
      expect(finalMonitoring.metrics.totalRequests).toBe(100);
    });
  });

  // ==========================================================================
  // 6. METRICS ACCURACY
  // ==========================================================================

  describe('Metrics Accuracy', () => {
    it('should accurately track all state transitions', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait and recover
      await wait(1100);
      circuitBreaker.isOpen(); // Trigger half-open
      circuitBreaker.recordSuccess(); // Close

      // Open again
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.openTransitions).toBe(2);
      expect(monitoring.metrics.halfOpenTransitions).toBe(1);
      expect(monitoring.metrics.closeTransitions).toBe(1);
    });

    it('should calculate failure rate correctly', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // 25% failure rate (1 failure, 3 successes)
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();

      const monitoring = circuitBreaker.getMonitoringData();
      expect(monitoring.metrics.failureRate).toBe(25);
    });

    it('should maintain accurate counts across state transitions', async () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Initial failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      const afterOpen = circuitBreaker.getMonitoringData();
      expect(afterOpen.metrics.totalFailures).toBe(3);

      // Recovery
      await wait(1100);
      circuitBreaker.isOpen();
      circuitBreaker.recordSuccess();

      const afterClose = circuitBreaker.getMonitoringData();
      expect(afterClose.metrics.totalSuccesses).toBe(1);
      expect(afterClose.metrics.totalFailures).toBe(3);
    });
  });

  // ==========================================================================
  // 7. RESET AND CLEANUP
  // ==========================================================================

  describe('Reset and Cleanup', () => {
    it('should fully reset circuit breaker state', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Generate activity
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Reset
      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
    });

    it('should handle reset during open state', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState().state).toBe('open');

      // Reset while open
      circuitBreaker.reset();

      // Should be closed and operational
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should allow operation after reset', () => {
      const circuitBreaker = createTestCircuitBreaker();

      // Open and reset
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      circuitBreaker.reset();

      // Should operate normally
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState().state).toBe('closed');

      // Should open again after threshold failures
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState().state).toBe('open');
    });
  });
});
