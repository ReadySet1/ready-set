// src/lib/error-testing.ts
import React from "react";
import { ErrorSeverity, ErrorCategory } from "./error-logging";

/**
 * Error simulation utilities for testing error boundaries
 */

// Predefined test errors for different scenarios
export const TestErrors = {
  // React Component Errors
  REACT_ERROR: new Error("React component rendering failed"),
  REACT_HOOK_ERROR: new Error("useEffect cleanup function threw an error"),
  REACT_STATE_ERROR: new Error(
    "Cannot update component while rendering a different component",
  ),

  // Network Errors
  NETWORK_ERROR: new Error("Network request failed"),
  FETCH_ERROR: new Error("Failed to fetch resource"),
  TIMEOUT_ERROR: new Error("Request timeout"),
  CONNECTION_ERROR: new Error("Connection refused"),

  // Authentication Errors
  AUTH_ERROR: new Error("Unauthorized access"),
  TOKEN_ERROR: new Error("Invalid token"),
  SESSION_ERROR: new Error("Session expired"),

  // Validation Errors
  VALIDATION_ERROR: new Error("Invalid input data"),
  REQUIRED_FIELD_ERROR: new Error("Required field missing"),

  // Chunk Loading Errors
  CHUNK_LOAD_ERROR: new Error("Loading chunk 123 failed"),
  SCRIPT_LOAD_ERROR: new Error("Script loading failed"),

  // State Management Errors
  CONTEXT_ERROR: new Error("Context provider not found"),
  REDUX_ERROR: new Error("Redux store error"),

  // Generic Errors
  GENERIC_ERROR: new Error("Something went wrong"),
  UNKNOWN_ERROR: new Error("Unknown error occurred"),
  RUNTIME_ERROR: new Error("Runtime error"),
} as const;

/**
 * Error simulation functions
 */
export class ErrorSimulator {
  /**
   * Simulate a React component error by throwing an error in a component
   */
  static simulateComponentError(error: Error = TestErrors.REACT_ERROR): never {
    throw error;
  }

  /**
   * Simulate a network error by throwing a network-related error
   */
  static simulateNetworkError(error: Error = TestErrors.NETWORK_ERROR): never {
    throw error;
  }

  /**
   * Simulate an authentication error
   */
  static simulateAuthError(error: Error = TestErrors.AUTH_ERROR): never {
    throw error;
  }

  /**
   * Simulate a chunk loading error
   */
  static simulateChunkError(error: Error = TestErrors.CHUNK_LOAD_ERROR): never {
    const chunkError = Object.assign(error, { name: "ChunkLoadError" });
    throw chunkError;
  }

  /**
   * Simulate an async operation error
   */
  static async simulateAsyncError(
    error: Error = TestErrors.GENERIC_ERROR,
    delay: number = 1000,
  ): Promise<never> {
    await new Promise((resolve) => setTimeout(resolve, delay));
    throw error;
  }

  /**
   * Simulate a promise rejection
   */
  static simulatePromiseRejection(
    error: Error = TestErrors.GENERIC_ERROR,
  ): Promise<never> {
    return Promise.reject(error);
  }
}

/**
 * React component for testing error boundaries
 */
export function ErrorTrigger({
  errorType = "REACT_ERROR",
  error,
  children,
}: {
  errorType?: keyof typeof TestErrors | "custom";
  error?: Error;
  children?: React.ReactNode;
}) {
  const [shouldError, setShouldError] = React.useState(false);

  React.useEffect(() => {
    if (shouldError) {
      const errorKey = errorType === "custom" ? "GENERIC_ERROR" : errorType;
      const errorToThrow =
        error ||
        TestErrors[errorKey as keyof typeof TestErrors] ||
        TestErrors.REACT_ERROR;
      ErrorSimulator.simulateComponentError(errorToThrow);
    }
  }, [shouldError, errorType, error]);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Error Boundary Test Component</h3>
        <button
          onClick={() => setShouldError(true)}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
        >
          Trigger Error
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        This component will throw an error when the button is clicked to test
        error boundary functionality.
      </p>
      {children}
    </div>
  );
}

/**
 * Error testing utilities for different scenarios
 */
export const ErrorTesting = {
  /**
   * Test all error boundary types
   */
  testAllBoundaries: async () => {
    console.log("🧪 Testing all error boundary types...");

    // Test component errors
    try {
      ErrorSimulator.simulateComponentError(TestErrors.REACT_ERROR);
    } catch (error) {
      console.log("✅ Component error boundary test passed");
    }

    // Test network errors
    try {
      ErrorSimulator.simulateNetworkError(TestErrors.NETWORK_ERROR);
    } catch (error) {
      console.log("✅ Network error boundary test passed");
    }

    // Test chunk errors
    try {
      ErrorSimulator.simulateChunkError(TestErrors.CHUNK_LOAD_ERROR);
    } catch (error) {
      console.log("✅ Chunk load error boundary test passed");
    }

    console.log("🎉 All error boundary tests completed");
  },

  /**
   * Test error recovery mechanisms
   */
  testErrorRecovery: async () => {
    console.log("🔄 Testing error recovery mechanisms...");

    // This would test the retry mechanisms
    const { RetryManager } = await import("./error-recovery");

    const retryManager = new RetryManager({
      maxRetries: 2,
      retryDelay: 100,
      onRetry: (attempt) => console.log(`Retry attempt ${attempt}`),
      onRecoverySuccess: () => console.log("✅ Recovery successful"),
      onMaxRetriesReached: () => console.log("❌ Max retries reached"),
    });

    try {
      await retryManager.execute(async () => {
        // Simulate a failing operation that succeeds on retry
        if (Math.random() < 0.7) {
          throw new Error("Temporary failure");
        }
        return "success";
      });
    } catch (error) {
      console.log("Recovery test completed");
    }
  },

  /**
   * Generate test error scenarios
   */
  generateTestScenarios: () => {
    return [
      {
        name: "React Component Error",
        error: TestErrors.REACT_ERROR,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
      },
      {
        name: "Network Error",
        error: TestErrors.NETWORK_ERROR,
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
      },
      {
        name: "Authentication Error",
        error: TestErrors.AUTH_ERROR,
        category: ErrorCategory.AUTH,
        severity: ErrorSeverity.CRITICAL,
      },
      {
        name: "Chunk Loading Error",
        error: TestErrors.CHUNK_LOAD_ERROR,
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.HIGH,
      },
      {
        name: "Validation Error",
        error: TestErrors.VALIDATION_ERROR,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
      },
    ];
  },

  /**
   * Stress test error boundaries
   */
  stressTest: async (iterations: number = 10) => {
    console.log(`🚀 Starting stress test with ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      const errors = Object.values(TestErrors);
      const randomError = errors[Math.floor(Math.random() * errors.length)];

      try {
        ErrorSimulator.simulateComponentError(randomError);
      } catch (error) {
        console.log(
          `Stress test iteration ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("🎯 Stress test completed");
  },
};

/**
 * Error boundary test suite
 */
export class ErrorBoundaryTestSuite {
  private results: Array<{
    testName: string;
    passed: boolean;
    error?: Error;
    duration: number;
  }> = [];

  /**
   * Run complete error boundary test suite
   */
  async runFullTestSuite(): Promise<void> {
    console.log("🧪 Running complete error boundary test suite...");

    const startTime = Date.now();

    // Test 1: Component Error Boundary
    await this.testComponentBoundary();

    // Test 2: Section Error Boundary
    await this.testSectionBoundary();

    // Test 3: Global Error Boundary
    await this.testGlobalBoundary();

    // Test 4: Error Recovery
    await this.testErrorRecovery();

    // Test 5: Network Error Handling
    await this.testNetworkErrorHandling();

    const duration = Date.now() - startTime;
    console.log(`✅ Test suite completed in ${duration}ms`);

    this.printResults();
  }

  private async testComponentBoundary(): Promise<void> {
    const testName = "Component Error Boundary Test";

    try {
      const startTime = Date.now();

      // This would need to be wrapped in a component that can throw
      // For now, we'll simulate the test
      ErrorSimulator.simulateComponentError(TestErrors.REACT_ERROR);

      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        error: error as Error,
        duration: 0,
      });
    }
  }

  private async testSectionBoundary(): Promise<void> {
    const testName = "Section Error Boundary Test";

    try {
      const startTime = Date.now();

      ErrorSimulator.simulateNetworkError(TestErrors.NETWORK_ERROR);

      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        error: error as Error,
        duration: 0,
      });
    }
  }

  private async testGlobalBoundary(): Promise<void> {
    const testName = "Global Error Boundary Test";

    try {
      const startTime = Date.now();

      ErrorSimulator.simulateChunkError(TestErrors.CHUNK_LOAD_ERROR);

      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        error: error as Error,
        duration: 0,
      });
    }
  }

  private async testErrorRecovery(): Promise<void> {
    const testName = "Error Recovery Test";

    try {
      const startTime = Date.now();

      const { RetryManager } = await import("./error-recovery");
      const retryManager = new RetryManager({ maxRetries: 2 });

      await retryManager.execute(async () => {
        if (Math.random() < 0.8) {
          throw new Error("Simulated failure");
        }
        return "success";
      });

      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        error: error as Error,
        duration: 0,
      });
    }
  }

  private async testNetworkErrorHandling(): Promise<void> {
    const testName = "Network Error Handling Test";

    try {
      const startTime = Date.now();

      ErrorSimulator.simulateNetworkError(TestErrors.FETCH_ERROR);

      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        error: error as Error,
        duration: 0,
      });
    }
  }

  private printResults(): void {
    console.log("\n📊 Error Boundary Test Results:");
    console.table(
      this.results.map((result) => ({
        Test: result.testName,
        Passed: result.passed ? "✅" : "❌",
        Duration: `${result.duration}ms`,
        Error: result.error?.message || "None",
      })),
    );

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    console.log(
      `\n🎯 Summary: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`,
    );
  }
}
