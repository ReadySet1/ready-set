import { NextRequest, NextResponse } from 'next/server';
import { CONSTANTS } from '@/constants';
import { serverLogger } from '@/utils/server-logger';
import { handleApiError } from '@/utils/error-logging';
import { initializeMonitoring } from '@/lib/monitoring';

// Initialize monitoring only in production
if (process.env.NODE_ENV === 'production') {
  initializeMonitoring();
}

// API route to test Highlight error tracking
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const shouldError = url.searchParams.has('error');
  const isFatal = url.searchParams.has('fatal');
  
  try {
    // Log request
    serverLogger.info(
      'Highlight test API call received', 
      'api',
      { 
        test: true, 
        shouldError, 
        isFatal,
        query: Object.fromEntries(url.searchParams)
      },
      request
    );
    
    // Check if we should generate an error for testing
    if (shouldError) {
      serverLogger.warn('Intentional error about to be thrown', 'api', { test: true }, request);
      
      if (isFatal) {
        // This will crash without being caught by the try/catch
        throw new Error('Fatal test error from /api/highlight-test');
      } else {
        // This will be caught
        throw new Error('Test error from /api/highlight-test');
      }
    }
    
    // Normal successful response
    return NextResponse.json({ 
      message: 'Highlight test endpoint working normally',
      timestamp: new Date().toISOString(),
      path: url.pathname,
      success: true
    });
  } catch (error) {
    // Use our error handling utility to log and format the response
    return handleApiError(error, 'api:other', request, {
      testMode: true,
      path: url.pathname
    });
  }
} 