/**
 * Type declarations to handle Next.js Edge Runtime type issues
 * This helps with the params Promise<SegmentParams> type error
 */

import { NextRequest } from 'next/server';

// Override the PageProps interface to make params optional and not a Promise
declare module 'next' {
  interface PageProps {
    params?: { [key: string]: string };
    searchParams?: { [key: string]: string | string[] };
  }
  
  // Helper type for route handlers
  export type RouteHandler<T = any> = (
    req: NextRequest,
    context: { params: { [key: string]: string } }
  ) => Promise<Response> | Response;
}

// For Edge Runtime params compatibility
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SKIP_TYPECHECK?: string;
      NEXT_PUBLIC_SKIP_API_ROUTES_IN_SSG?: string;
    }
  }
} 