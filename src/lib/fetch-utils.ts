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
    
    // Use arrayBuffer if available (for binary data like PDFs)
    if (typeof response.arrayBuffer === 'function') {
      try {
        const buffer = await response.arrayBuffer();
        // Return the buffer directly if the caller expects binary data
        // or attempt to parse it as text/JSON if appropriate
        
        // Try to detect if this is text/JSON content that should be parsed
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const text = new TextDecoder().decode(buffer);
          return JSON.parse(text) as T;
        }
        
        return buffer as unknown as T;
      } catch (bufferError) {
        console.error('Error processing arrayBuffer:', bufferError);
        // Fall back to other methods
      }
    }
    
    // Try JSON for API responses
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        return await response.json() as T;
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        // Fall back to text
      }
    }
    
    // Default fallback to text
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
    
    const data = await safeFetch<T>(url);
    return data;
  } catch (error) {
    console.error(`Error fetching guide with slug ${slug}:`, error);
    return null;
  }
} 