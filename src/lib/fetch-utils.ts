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
    // For static generation, we want to completely avoid API routes when possible
    if (process.env.NODE_ENV === 'production' && url.includes('/api/')) {
      throw new Error(`API fetch avoided during static generation: ${url}`);
    }
    
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
    
    // Use text() instead of arrayBuffer for all cases during static generation
    // This helps avoid the "r.arrayBuffer is not a function" error
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