const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Integration test specific config
const integrationJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  // Longer timeout for integration tests
  testTimeout: process.env.CI ? 150000 : 60000,
  // Limit workers for integration tests (database dependent)
  maxWorkers: 1,
  // Better test isolation for integration tests
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    // Fix module resolution
    '^@/(.*)$': '<rootDir>/src/$1',
    // Add CSS module mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Add static asset mocks
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
  // Only run integration tests
  testMatch: [
    '<rootDir>/src/**/*.integration.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.integration.{js,jsx,ts,tsx}',
  ],
  // Don't collect coverage for integration tests (focus on unit tests for coverage)
  collectCoverage: false,
  // Enhanced reporting for CI
  reporters: process.env.CI 
    ? [
        'default',
        ['jest-junit', {
          outputDirectory: 'test-results',
          outputName: 'integration-junit.xml',
          suiteName: 'Jest Integration Tests',
        }]
      ] 
    : ['default'],
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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Better error reporting in CI
  verbose: process.env.CI ? true : false,
  // Force exit after tests complete in CI
  forceExit: process.env.CI ? true : false,
  // Detect open handles in CI to prevent hanging
  detectOpenHandles: process.env.CI ? true : false,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(integrationJestConfig)