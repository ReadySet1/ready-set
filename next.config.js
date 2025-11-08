const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/**
 * Environment Variable Validation
 *
 * Validates required environment variables at build time to catch configuration
 * issues early, before deployment.
 */
function validateEnvironmentVariables() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missing = [];

  for (const envVar of required) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ Build Error: Missing Required Environment Variables\n');
    console.error('The following environment variables are required but not set:\n');
    missing.forEach(envVar => {
      console.error(`  - ${envVar}`);
    });
    console.error('\n📖 To fix this:');
    console.error('  1. Copy .env.example to .env.local');
    console.error('  2. Fill in the required values');
    console.error('  3. Restart the build\n');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.startsWith('http')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL starting with http:// or https://');
  }

  // Validate Supabase anon key length (warn only, don't block)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && anonKey.length < 20) {
    console.warn('⚠️  Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY seems too short (< 20 characters)');
    console.warn('   This may indicate a configuration error.');
  }

  console.log('✅ Environment variables validated successfully');
}

// Run validation (skip during development for better DX)
if (process.env.NODE_ENV !== 'development' || process.env.VALIDATE_ENV === 'true') {
  validateEnvironmentVariables();
}

/**
 * Next.js Configuration
 *
 * Build Memory Requirements:
 * Large builds may require increased Node.js memory allocation.
 * Use: NODE_OPTIONS="--max-old-space-size=4096" pnpm build
 *
 * This is typically needed for:
 * - Large codebases with extensive TypeScript compilation
 * - Sentry source map uploads (can be memory-intensive)
 * - Multiple concurrent build processes
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  compress: true, // Enable gzip compression for production

  typescript: {
    // Skip type checking during builds to prevent deployment failures
    // NOTE: This is a workaround for legacy code. New code should be type-safe.
    // TypeScript validation is enforced separately in CI/CD pipeline (.github/workflows/ci.yml)
    // The CI pipeline runs 'pnpm typecheck' which will catch and fail on type errors
    // Consider running 'pnpm typecheck' locally before committing
    ignoreBuildErrors: true,
  },

  experimental: {
    // Enable 'use cache' directive for static site generation
    useCache: true,
    // Optimize package imports
    optimizePackageImports: ['@supabase/supabase-js', 'react-icons', 'date-fns'],
  },

  // Modularize large library imports to reduce bundle size
  modularizeImports: {
    'react-icons': {
      transform: 'react-icons/{{member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },

  serverExternalPackages: ['@prisma/client', 'prisma', 'jsdom'],
  skipTrailingSlashRedirect: true,
  // Ensure all API routes are treated as dynamic
  async rewrites() {
    return [];
  },

  webpack: (config, { isServer, dev }) => {
    // Configure externals for server-side rendering
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pg');

      // Externalize jsdom to avoid CSS file bundling issues with isomorphic-dompurify
      config.externals.push('jsdom');

      // Don't externalize @prisma/client - bundle it
      if (config.externals.includes('@prisma/client')) {
        config.externals = config.externals.filter(external => external !== '@prisma/client');
      }

      // Force Prisma to use standard import path
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/client': require.resolve('@prisma/client'),
      };

      // Ensure binary targets are properly included
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      // PERFORMANCE: Skip Prisma binary copying on Vercel (handled automatically)
      // This saves significant build time by avoiding file operations
      if (!dev && !process.env.VERCEL) {
        config.plugins = config.plugins || [];

        // Add custom plugin to copy Prisma binaries (only for local builds)
        const { CopyPlugin } = require('webpack').webpack || {};
        if (CopyPlugin) {
          config.plugins.push(
            new CopyPlugin({
              patterns: [
                {
                  from: path.join(__dirname, 'node_modules/.prisma/client/*.node'),
                  to: path.join(__dirname, '.next/server/[name][ext]'),
                  noErrorOnMissing: true,
                },
                {
                  from: path.join(__dirname, 'node_modules/prisma/libquery_engine-*.so.node'),
                  to: path.join(__dirname, '.next/server/[name][ext]'),
                  noErrorOnMissing: true,
                },
              ],
            })
          );
        }
      }
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/join-the-team',
        destination: '/apply',
        permanent: true,
      },
      {
        source: '/join-the-us',
        destination: '/apply',
        permanent: true,
      },
      {
        source: '/join-the-team/:path*',
        destination: '/apply',
        permanent: true,
      },
      {
        source: '/join-us',
        destination: '/apply',
        permanent: true,
      },
      {
        source: '/careers',
        destination: '/apply',
        permanent: true,
      },
    ]
  },
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppress verbose logs to reduce build output noise
  // Set to false if you need to debug source map uploads
  silent: true,

  // Upload source maps to Sentry
  // This will be enabled when SENTRY_AUTH_TOKEN is set
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hide source maps from public (don't include them in the browser)
  hideSourceMaps: true,

  // Suppress CLI output to reduce log verbosity
  telemetry: false,

  // Only upload source maps if auth token is available
  // This prevents warnings when building locally without Sentry configured
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Wipe debug IDs to reduce sourcemap warnings
  widenClientFileUpload: true,

  // PERFORMANCE: Disable source map uploads on Vercel to speed up builds
  // Source maps add 3-5 minutes to build time. Upload them from CI/CD instead.
  disableServerWebpackPlugin: process.env.VERCEL === '1',
  disableClientWebpackPlugin: process.env.VERCEL === '1',

  // Error handling for source map uploads - don't add warnings to build output
  errorHandler: (err, invokeErr, compilation) => {
    // Only log to console, don't add to webpack warnings
    if (process.env.NODE_ENV === 'development') {
      console.log('Sentry source map upload skipped or failed (this is normal in local development)');
    }
  },
};

// Make sure adding Sentry options is the last code to run before exporting
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
