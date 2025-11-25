const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  // Use V8 coverage provider instead of babel-plugin-istanbul
  // This prevents instrumentation errors with mock objects in test files
  coverageProvider: 'v8',
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
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/test/',
    '/tests/',
    '\\.(test|spec)\\.(js|jsx|ts|tsx)$',
    'src/__tests__/helpers/',
  ],
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
    'node_modules/(?!(.*\\.mjs$|@supabase|isows|bufferutil|@solana|ws|@noble|tweetnacl|cheerio.*|resend|parse5|dom-serializer|domutils|htmlparser2|entities|domhandler|date-fns|date-fns-tz))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Add test timeout - increased for CI stability
  testTimeout: 30000,
  // Bail early to prevent hanging tests
  bail: false,
  // Set max concurrency for CI
  maxConcurrency: 5,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig) 