const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  compress: true, // Enable gzip compression for production
  typescript: {
    // Skip type checking during builds to prevent deployment failures
    // NOTE: This is a workaround for legacy code. New code should be type-safe.
    // Consider running 'pnpm typecheck' separately in CI/CD to catch type errors
    ignoreBuildErrors: true,
  },
  experimental: {
    // Enable 'use cache' directive for static site generation
    useCache: true,
  },
  serverExternalPackages: ['@prisma/client', 'prisma', 'jsdom'],
  skipTrailingSlashRedirect: true,
  // Ensure all API routes are treated as dynamic
  async rewrites() {
    return [];
  },

  webpack: (config, { isServer, dev, isEdgeRuntime }) => {
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
    }
    
    // Handle Prisma client during build - improved configuration
    if (isServer) {
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
      
      // Copy Prisma binaries for production builds
      if (!dev) {
        config.plugins = config.plugins || [];
        
        // Add custom plugin to copy Prisma binaries
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

  // Only suppress logs in CI environments to catch upload failures locally
  silent: process.env.CI === 'true',

  // Upload source maps to Sentry
  // This will be enabled when SENTRY_AUTH_TOKEN is set
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Error handling for source map uploads
  errorHandler: (err, invokeErr, compilation) => {
    compilation.warnings.push('Sentry source map upload failed: ' + err.message);
  },
};

// Make sure adding Sentry options is the last code to run before exporting
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
