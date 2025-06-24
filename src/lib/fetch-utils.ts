/**
 * Global polyfill for Edge Runtime compatibility
 * Prevents "r.arrayBuffer is not a function" errors
 */
if (typeof global !== 'undefined' && typeof global.Response !== 'undefined') {
  const OriginalResponse = global.Response;
  global.Response = class extends OriginalResponse {
    constructor(...args: any[]) {
      super(...args);
    }
    
    arrayBuffer(): Promise<ArrayBuffer> {
      if (typeof super.arrayBuffer === 'function') {
        return super.arrayBuffer();
      }
      // Fallback for environments where arrayBuffer is not available
      return this.text().then(text => new TextEncoder().encode(text).buffer as ArrayBuffer);
    }
  } as any;
}

/**
 * Safely handles fetch responses with proper type checking for arrayBuffer
 * This resolves issues with arrayBuffer not being a function in some environments
 * 
 * @param url URL to fetch data from
 * @param options Optional fetch options
 * @returns Response data, either as a buffer, JSON, or text based on what's available
 */
export async function safeFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  try {
    // Ensure we have an absolute URL (required for SSG/static build)
    const fetchUrl = url.startsWith('http') 
      ? url 
      : new URL(url, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString();
    
    const response = await fetch(fetchUrl, options);
    
    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`);
    }
    
    // Try JSON for API responses first (most common case)
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        return await response.json() as T;
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        // Fall back to text
      }
    }
    
    // Edge Runtime compatibility check
    // Only try arrayBuffer if it's available as a function (not in Edge Runtime)
    // This helps avoid the "r.arrayBuffer is not a function" error
    if (typeof response.arrayBuffer === 'function' && 
        // Check if we're NOT in Edge Runtime or during build
        process.env.NEXT_RUNTIME !== 'edge' &&
        typeof global !== 'undefined') {
      try {
        const buffer = await response.arrayBuffer();
        // Try to detect if this is text/JSON content that should be parsed
        try {
          const text = new TextDecoder().decode(buffer);
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            return JSON.parse(text) as T;
          }
          return text as unknown as T;
        } catch {
          // If text decoding fails, it's likely binary data
          return buffer as unknown as T;
        }
      } catch (bufferError) {
        console.warn('Error processing arrayBuffer, falling back to text:', bufferError);
        // Fall back to text
      }
    }
    
    // Default fallback to text
    try {
      const text = await response.text();
      
      // Attempt to parse as JSON if it looks like JSON
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          return JSON.parse(text) as T;
        } catch {
          // Not valid JSON, return as text
          return text as unknown as T;
        }
      }
      
      return text as unknown as T;
    } catch (textError) {
      throw new Error(`Failed to read response: ${textError}`);
    }
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    throw error;
  }
}

/**
 * Type-safe wrapper for fetching guide content
 */
export async function fetchGuideContent<T>(slug: string): Promise<T | null> {
  try {
    // Convert to absolute URL to avoid parsing errors during static generation
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = new URL(`/api/guides/${slug}`, baseUrl).toString();
    
    const response = await safeFetch<{data: T}>(url);
    
    // Handle the consistent API response format where data is nested
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data;
    }
    
    // If response doesn't match expected format, return it as is
    return response as unknown as T;
  } catch (error) {
    console.error(`Error fetching guide with slug ${slug}:`, error);
    return null;
  }
} 