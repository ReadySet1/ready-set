/**
 * Type declarations for graphql-request
 * 
 * These declarations help TypeScript resolve the module when using
 * moduleResolution: "bundler" which may not properly resolve the
 * package's type exports.
 */

declare module 'graphql-request' {
  export interface GraphQLResponse<T = unknown> {
    data?: T;
    errors?: Array<{
      message: string;
      locations?: Array<{ line: number; column: number }>;
      path?: Array<string | number>;
      extensions?: Record<string, unknown>;
    }>;
    extensions?: Record<string, unknown>;
    status: number;
    headers: Headers;
  }

  export class ClientError extends Error {
    response: GraphQLResponse;
    request: {
      query: string;
      variables?: Record<string, unknown>;
    };
    
    constructor(response: GraphQLResponse, request: { query: string; variables?: Record<string, unknown> });
  }

  export interface RequestConfig {
    headers?: HeadersInit | Record<string, string>;
    credentials?: RequestCredentials;
    mode?: RequestMode;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;
    keepalive?: boolean;
    signal?: AbortSignal | null;
    fetch?: typeof fetch;
  }

  export class GraphQLClient {
    constructor(url: string, options?: RequestConfig);
    
    request<T = unknown>(
      document: string,
      variables?: Record<string, unknown>,
      requestHeaders?: HeadersInit
    ): Promise<T>;
    
    rawRequest<T = unknown>(
      document: string,
      variables?: Record<string, unknown>,
      requestHeaders?: HeadersInit
    ): Promise<GraphQLResponse<T>>;
    
    setHeader(key: string, value: string): GraphQLClient;
    setHeaders(headers: HeadersInit): GraphQLClient;
    setEndpoint(url: string): GraphQLClient;
  }

  export function request<T = unknown>(
    url: string,
    document: string,
    variables?: Record<string, unknown>,
    requestHeaders?: HeadersInit
  ): Promise<T>;

  export function rawRequest<T = unknown>(
    url: string,
    document: string,
    variables?: Record<string, unknown>,
    requestHeaders?: HeadersInit
  ): Promise<GraphQLResponse<T>>;

  export function gql(strings: TemplateStringsArray, ...values: unknown[]): string;
}

