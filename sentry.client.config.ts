// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment name
  environment: process.env.NODE_ENV,

  // Adjust this value in production, or use tracesSampler for greater control
  // 0.1 = 10% of transactions will be sent to Sentry
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

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

  // Filter out known non-critical errors
  beforeSend(event, hint) {
    // Ignore ResizeObserver errors (common browser noise)
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }

    // Ignore network errors (often client connectivity issues)
    if (
      event.exception?.values?.[0]?.value?.includes('NetworkError') ||
      event.exception?.values?.[0]?.value?.includes('Failed to fetch')
    ) {
      return null;
    }

    // Ignore non-Error rejections (often from third-party libraries)
    if (hint.originalException && typeof hint.originalException !== 'object') {
      return null;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',
    // Random plugins/extensions
    'Can\'t find variable: ZiteReader',
    'jigsaw is not defined',
    'ComboSearch is not defined',
    // Facebook blocked
    'fb_xd_fragment',
    // ISP optimizing proxy
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    // Generic error messages that are usually noise
    'Non-Error promise rejection captured',
  ],
});
