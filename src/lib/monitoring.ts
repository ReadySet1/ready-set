import { NextRequest } from 'next/server';
import { CONSTANTS } from '../constants';

/**
 * Initializes monitoring for server components in a Node.js environment
 * This function handles compatibility with the server environment
 */
export function initializeMonitoring() {
  // Only initialize in server environment, not Edge
  if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    // Dynamic import to avoid TypeScript errors
    import('@highlight-run/next/server').then(({ registerHighlight }) => {
      registerHighlight({
        projectID: CONSTANTS.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID || '',
        serviceName: 'ready-set-backend',
        // Simple config to avoid TypeScript errors
        networkRecording: {
          enabled: true,
        }
      });
    }).catch(error => {
      console.error('Failed to initialize Highlight monitoring:', error);
    });
  }
}

/**
 * Initializes monitoring for Edge Runtime components
 * Uses a more compatible configuration for Edge
 */
export function initializeEdgeMonitoring() {
  // Use the Edge-compatible version
  if (process.env.NEXT_RUNTIME === 'edge') {
    import('@highlight-run/next/server').then(({ registerHighlight }) => {
      registerHighlight({
        projectID: CONSTANTS.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID || '',
        serviceName: 'ready-set-edge',
        // Minimal configuration for Edge runtime
      });
    }).catch(error => {
      console.error('Failed to initialize Highlight in Edge runtime:', error);
    });
  }
}

/**
 * Client-side Highlight initialization for browser environments
 * 
 * Note: In the browser, Highlight will be initialized by the @highlight-run/next client integration
 * which is automatically set up by the next.js framework. This function is mainly for reference
 * and manual initialization if needed.
 */
export function initializeClientMonitoring() {
  // This is intentionally simplified to avoid TypeScript errors
  // The actual initialization will be handled by Next.js integration
  console.log('Client-side monitoring is handled by Next.js Highlight integration');
} 