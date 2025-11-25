import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';

import { initializeMonitoring, initializeEdgeMonitoring } from './src/lib/monitoring';
import { createBeforeSend, SERVER_IGNORE_ERRORS } from '@/lib/monitoring/sentry-filters';

function initSentryForCurrentRuntime(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  const getSampleRate = (): number => {
    if (process.env.SENTRY_TRACES_SAMPLE_RATE) {
      const rate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE);
      return isNaN(rate) ? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0) : rate;
    }
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
  };

  const baseConfig = {
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: getSampleRate(),
    debug: false,
  };

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      ...baseConfig,
      beforeSend: createBeforeSend({
        includeEdgeFilters: true,
      }),
    });
  } else {
    Sentry.init({
      ...baseConfig,
      // Server-side integrations
      integrations: [
        Sentry.prismaIntegration(),
        Sentry.httpIntegration(),
      ],
      beforeSend: createBeforeSend({
        includeServerFilters: true,
      }),
      ignoreErrors: SERVER_IGNORE_ERRORS,
    });
  }
}

export async function register() {
  try {
    // Initialize Sentry first so that any subsequent monitoring hooks
    // and application code run with error tracking enabled.
    initSentryForCurrentRuntime();

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Use the edge-compatible monitoring
      initializeEdgeMonitoring();
    } else {
      // Use the Node.js server monitoring
      initializeMonitoring();
    }
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
  }
} 

/**
 * Next.js App Router hook for capturing errors from nested React Server Components
 * and request handling. This keeps Sentry aligned with the latest Next.js
 * instrumentation lifecycle.
 */
export async function onRequestError(
  err: unknown,
  request: NextRequest,
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  }
) {
  Sentry.captureException(err, {
    contexts: {
      nextjs: {
        request: {
          path: request.nextUrl.pathname,
          method: request.method,
        },
        router: context.routerKind,
        route: context.routePath,
        type: context.routeType,
      },
    },
  });
}