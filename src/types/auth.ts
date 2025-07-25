// src/types/auth.ts
// Enhanced authentication type definitions for the master plan implementation

export enum AuthErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ROLE_FETCH_FAILED = 'ROLE_FETCH_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  retryable: boolean;
  timestamp: Date;
  details?: any;
}

export interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  retryCount: number;
  lastAuthCheck: Date | null;
}

export interface ProfileState {
  data: UserProfile | null;
  isLoading: boolean;
  error: ProfileError | null;
  lastFetched: Date | null;
  retryCount: number;
}

export interface ProfileError {
  type: 'FETCH_FAILED' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  retryable: boolean;
  timestamp: Date;
  details?: any;
}

export interface UserProfile {
  id: string;
  type: string;
  email: string;
  name?: string;
  contactName?: string;
  contactNumber?: string;
  companyName?: string;
  image?: string;
  status: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  // Core auth state
  session: any | null;
  user: any | null;
  userRole: string | null;
  isLoading: boolean;
  error: AuthError | null;
  
  // Enhanced state tracking
  authState: AuthState;
  profileState: ProfileState;
  
  // Methods
  refreshUserData: () => Promise<void>;
  retryAuth: () => Promise<void>;
  clearError: () => void;

  // New methods for master plan
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  forceAuthRefresh: (reason?: string) => Promise<void>;
  
  // Navigation helpers
  getDashboardPath: () => string;
  getOrderDetailPath: (orderNumber: string) => string;
}

export interface AuthRequestContext {
  requestId: string;
  timestamp: Date;
  userId?: string;
  userRole?: string;
  path: string;
  method: string;
  headers: Record<string, string>;
}

export interface AuthResponse {
  success: boolean;
  data?: any;
  error?: AuthError;
  timestamp: Date;
  requestId: string;
}

// Database connection and query types
export interface DatabaseConnection {
  isConnected: boolean;
  lastHealthCheck: Date | null;
  connectionPoolSize: number;
  activeConnections: number;
}

export interface QueryMetrics {
  queryId: string;
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// Performance monitoring types
export interface AuthMetrics {
  authInitTime: number;
  profileFetchTime: number;
  sessionValidationTime: number;
  errorCount: number;
  retryCount: number;
  lastSuccessfulAuth: Date | null;
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  databaseQueryTime: number;
  cacheHitRate: number;
  errorRate: number;
} 