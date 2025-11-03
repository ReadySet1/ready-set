// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

  // Enable performance monitoring
  integrations: [
    // Database instrumentation
    Sentry.prismaIntegration(),
    // HTTP instrumentation
    Sentry.httpIntegration(),
  ],

  // Filter server-side errors
  beforeSend(event, hint) {
    // Ignore specific Prisma errors that are handled
    if (
      event.exception?.values?.[0]?.value?.includes('P2002') || // Unique constraint
      event.exception?.values?.[0]?.value?.includes('P2025')    // Record not found
    ) {
      // These are handled business logic errors, not system errors
      return null;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Next.js specific errors
    'ECONNRESET',
    'EPIPE',
    'aborted',
  ],
});
