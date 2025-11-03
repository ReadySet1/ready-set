// This file configures the initialization of Sentry for edge features (middleware, edge functions, etc.)
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is separate from the Next.js instrumentation config.
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

  // Filter edge runtime errors
  beforeSend(event, hint) {
    // Ignore middleware redirects (these are normal flow, not errors)
    if (event.exception?.values?.[0]?.value?.includes('NEXT_REDIRECT')) {
      return null;
    }

    return event;
  },
});
