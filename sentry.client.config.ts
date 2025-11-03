// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { createBeforeSend, CLIENT_IGNORE_ERRORS } from '@/lib/monitoring/sentry-filters';

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

    // Session Replay configuration
    replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions where an error occurred
    replaysSessionSampleRate: 0.1, // Capture 10% of all sessions for replay

    // Enable session replay
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content for privacy
        maskAllText: true,
        // Block all media elements (images, videos, audio)
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Filter out known non-critical errors using shared filtering logic
    beforeSend: createBeforeSend({
      includeClientFilters: true,
    }),

    // Ignore specific errors using shared error list
    ignoreErrors: CLIENT_IGNORE_ERRORS,
  });
}
