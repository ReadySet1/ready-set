// This file configures the initialization of Sentry for edge features (middleware, edge functions, etc.)
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is separate from the Next.js instrumentation config.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { createBeforeSend } from '@/lib/monitoring/sentry-filters';

// Validate DSN is configured
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn) {
  console.warn('Sentry DSN not configured, error tracking disabled');
  // Early exit - don't initialize Sentry if DSN is missing
} else {
  // Parse sample rate from environment variable or use defaults
  const getSampleRate = (): number => {
    if (process.env.SENTRY_TRACES_SAMPLE_RATE) {
      const rate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE);
      return isNaN(rate) ? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0) : rate;
    }
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
  };

  Sentry.init({
    dsn,

    // Environment name
    environment: process.env.NODE_ENV,

    // Release tracking for better error grouping and deploy tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,

    // Adjust this value in production, or use tracesSampler for greater control
    // Configurable via SENTRY_TRACES_SAMPLE_RATE environment variable
    // Default: 0.1 (10%) in production, 1.0 (100%) in development
    tracesSampleRate: getSampleRate(),

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Filter edge runtime errors using shared filtering logic
    beforeSend: createBeforeSend({
      includeEdgeFilters: true,
    }),
  });
}
