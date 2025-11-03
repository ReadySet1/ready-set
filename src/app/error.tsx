'use client' // Error components must be Client Components

import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

// Standard error props interface that follows Next.js pattern
interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  // Capture the error to Sentry for monitoring
  useEffect(() => {
    captureException(error, {
      component: 'App Router Error Boundary',
      metadata: {
        digest: error.digest,
        type: 'error.tsx'
      }
    })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <div className="bg-red-50 border border-red-100 rounded-lg p-8 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-red-800 mb-4">Something went wrong!</h2>
        <div className="text-red-600 mb-6">
          {error?.message || 'An unexpected error occurred'}
        </div>
        <Button
          onClick={() => reset()} // Attempt to recover by trying to re-render the segment
          variant="outline"
          className="bg-white hover:bg-red-50"
        >
          Try again
        </Button>
      </div>
    </div>
  )
} 