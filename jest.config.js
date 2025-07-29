const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  // CI-specific timeout settings
  testTimeout: process.env.CI ? 60000 : 30000,
  // Memory optimization for CI
  maxWorkers: process.env.CI ? 2 : '50%',
  // Better test isolation
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
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  // Exclude integration tests from unit test runs
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
    '<rootDir>/src/.*\\.integration\\.(test|spec)\\.(js|jsx|ts|tsx)$',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
    '!src/app/**/layout.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
    '!src/app/**/not-found.tsx',
    '!src/app/**/global-error.tsx',
    '!src/middleware.ts',
    '!src/app/**/opengraph-image.*',
    '!src/app/**/icon.*',
    '!src/app/**/apple-icon.*',
    '!src/sanity/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
  // Enhanced reporting for CI
  reporters: process.env.CI 
    ? [
        'default',
        ['jest-junit', {
          outputDirectory: 'test-results',
          outputName: 'junit.xml',
          suiteName: 'Jest Unit Tests',
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
module.exports = createJestConfig(customJestConfig) 