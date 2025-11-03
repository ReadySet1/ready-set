'use client' // Error components must be Client Components

import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

// Global error props interface for root layout errors
interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary for Next.js App Router
 * This catches errors that occur in the root layout
 *
 * Note: global-error.tsx is only enabled in production.
 * In development, the error overlay will be shown instead.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  // Capture the error to Sentry for monitoring
  useEffect(() => {
    captureException(error, {
      component: 'Global Error Boundary',
      feature: 'root-layout',
      metadata: {
        digest: error.digest,
        type: 'global-error.tsx',
        location: 'Root Layout'
      }
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-lg mx-auto shadow-lg">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-800 mb-4">
              Application Error
            </h2>
            <p className="text-red-600 mb-2">
              We're sorry, but something went wrong with the application.
            </p>
            <p className="text-sm text-red-500 mb-6">
              {error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => reset()}
                variant="outline"
                className="bg-white hover:bg-red-50 border-red-300"
              >
                Try again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="default"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Go to Home
              </Button>
            </div>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-4">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
