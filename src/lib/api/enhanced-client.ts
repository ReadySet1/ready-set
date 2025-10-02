// src/lib/api/enhanced-client.ts
// Enhanced API client with automatic token refresh and retry logic

import { getAuthenticatedFetch, handleApiResponse } from '@/lib/auth/api-interceptor';
import { getTokenRefreshService } from '@/lib/auth/token-refresh-service';
import { AuthError, AuthErrorType } from '@/types/auth';
import { authLogger } from '@/utils/logger';

// API client configuration
export interface EnhancedApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableAuth?: boolean;
  enableRetry?: boolean;
  headers?: Record<string, string>;
}

// Default configuration
const DEFAULT_CONFIG: EnhancedApiClientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000,
  enableAuth: true,
  enableRetry: true,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Enhanced API client class
export class EnhancedApiClient {
  private config: EnhancedApiClientConfig;
  private authFetch: ReturnType<typeof getAuthenticatedFetch>;

  constructor(config: Partial<EnhancedApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize authenticated fetch
    this.authFetch = getAuthenticatedFetch({
      enabled: this.config.enableAuth,
      retryAttempts: this.config.retries,
      retryDelay: this.config.retryDelay,
      retryOnAuthErrors: this.config.enableRetry,
    });
  }

  // Generic request method
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const requestOptions = this.buildRequestOptions(options);

    try {
      const response = await this.authFetch.fetch(url, requestOptions);
      return await handleApiResponse(response);
    } catch (error) {
      authLogger.error('EnhancedApiClient: Request failed', { endpoint, error });

      // Handle authentication errors specifically
      if (error instanceof AuthError) {
        throw error;
      }

      // Re-throw other errors
      throw error;
    }
  }

  // HTTP method shortcuts
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params ? `${endpoint}?${new URLSearchParams(params).toString()}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // File upload support
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData - let browser set it with boundary
      },
    });
  }

  // Batch requests
  async batch<T = any>(requests: Array<{
    endpoint: string;
    options?: RequestInit;
    id?: string;
  }>): Promise<Array<{ id?: string; data: T; error?: any }>> {
    const promises = requests.map(async ({ endpoint, options, id }) => {
      try {
        const data = await this.request<T>(endpoint, options);
        return { id, data };
      } catch (error) {
        return { id, data: null as T, error };
      }
    });

    return Promise.all(promises);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.get('/health');
  }

  // Update configuration
  updateConfig(config: Partial<EnhancedApiClientConfig>): void {
    this.config = { ...this.config, ...config };

    // Update authenticated fetch config
    this.authFetch.updateConfig({
      enabled: this.config.enableAuth,
      retryAttempts: this.config.retries,
      retryDelay: this.config.retryDelay,
      retryOnAuthErrors: this.config.enableRetry,
    });
  }

  // Build full URL
  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    const baseUrl = this.config.baseURL || '';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${cleanEndpoint}`;
  }

  // Build request options with default headers and auth
  private buildRequestOptions(options: RequestInit = {}): RequestInit {
    const headers = new Headers({
      ...this.config.headers,
      ...options.headers,
    });

    return {
      ...options,
      headers,
      // Set timeout if AbortController is available
      signal: options.signal || (AbortSignal.timeout ? AbortSignal.timeout(this.config.timeout!) : undefined),
    };
  }
}

// API client instances for different services
export const apiClient = new EnhancedApiClient();

// Authenticated API client (requires authentication)
export const authApiClient = new EnhancedApiClient({
  enableAuth: true,
  enableRetry: true,
});

// Public API client (no authentication required)
export const publicApiClient = new EnhancedApiClient({
  enableAuth: false,
  enableRetry: true,
});

// Specific service clients
export const userApiClient = new EnhancedApiClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/user`,
  enableAuth: true,
});

export const adminApiClient = new EnhancedApiClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/admin`,
  enableAuth: true,
});

export const orderApiClient = new EnhancedApiClient({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/order`,
  enableAuth: true,
});

// Helper function to create custom API client
export function createApiClient(config: Partial<EnhancedApiClientConfig>): EnhancedApiClient {
  return new EnhancedApiClient(config);
}

// Global error handler for API errors
export function handleApiError(error: any): never {
  authLogger.error('API Error:', error);

  // Handle specific error types
  if (error instanceof AuthError) {
    // Authentication errors are handled by the auth system
    throw error;
  }

  if (error.name === 'AbortError') {
    throw new Error('Request timeout - please try again');
  }

  if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
    throw new Error('Network error - please check your connection and try again');
  }

  // Re-throw with enhanced message
  throw new Error(error.message || 'An unexpected error occurred');
}

// Export default client
export default apiClient;
