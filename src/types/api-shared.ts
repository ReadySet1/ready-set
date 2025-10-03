/**
 * Shared API types and utilities for consistent frontend-backend communication
 * This file prevents case sensitivity mismatches and provides validation utilities
 */

import { UserType, UserStatus } from './prisma';

// API Filter types that support 'all' options
export type ApiUserTypeFilter = UserType | 'all';
export type ApiUserStatusFilter = UserStatus | 'all';

// API parameter validation and transformation utilities
export class ApiTypeUtils {
  /**
   * Normalizes user type filter from any case to uppercase Prisma enum
   * Used by both frontend and backend for consistency
   */
  static normalizeUserType(userType: string | 'all'): ApiUserTypeFilter {
    if (userType === 'all') {
      return 'all';
    }
    
    // Convert to uppercase and validate against enum values
    const normalizedType = userType?.toUpperCase();
    const validTypes: UserType[] = ['VENDOR', 'CLIENT', 'DRIVER', 'ADMIN', 'HELPDESK', 'SUPER_ADMIN'];
    
    if (validTypes.includes(normalizedType as UserType)) {
      return normalizedType as UserType;
    }
    
    // Log warning for invalid types
    console.warn(`[API] Invalid user type received: "${userType}". Falling back to 'all'.`);
    return 'all';
  }

  /**
   * Normalizes user status filter from any case to uppercase Prisma enum
   */
  static normalizeUserStatus(userStatus: string | 'all'): ApiUserStatusFilter {
    if (userStatus === 'all') {
      return 'all';
    }
    
    const normalizedStatus = userStatus?.toUpperCase();
    const validStatuses: UserStatus[] = ['ACTIVE', 'PENDING', 'DELETED'];
    
    if (validStatuses.includes(normalizedStatus as UserStatus)) {
      return normalizedStatus as UserStatus;
    }
    
    console.warn(`[API] Invalid user status received: "${userStatus}". Falling back to 'all'.`);
    return 'all';
  }

  /**
   * Gets user-friendly display labels for UserType enum values
   */
  static getUserTypeDisplayLabel(userType: UserType): string {
    const labels: Record<UserType, string> = {
      'VENDOR': 'Vendor',
      'CLIENT': 'Client', 
      'DRIVER': 'Driver',
      'ADMIN': 'Admin',
      'HELPDESK': 'Help Desk',
      'SUPER_ADMIN': 'Super Admin',
    };
    return labels[userType] || userType;
  }

  /**
   * Gets user-friendly display labels for UserStatus enum values
   */
  static getUserStatusDisplayLabel(userStatus: UserStatus): string {
    const labels: Record<UserStatus, string> = {
      'ACTIVE': 'Active',
      'PENDING': 'Pending',
      'DELETED': 'Deleted',
    };
    return labels[userStatus] || userStatus;
  }

  /**
   * Gets all valid user type options for dropdowns
   */
  static getUserTypeOptions(): Array<{ value: UserType | 'all'; label: string }> {
    return [
      { value: 'all', label: 'All Types' },
      { value: 'VENDOR', label: 'Vendor' },
      { value: 'CLIENT', label: 'Client' },
      { value: 'DRIVER', label: 'Driver' },
      { value: 'ADMIN', label: 'Admin' },
      { value: 'HELPDESK', label: 'Help Desk' },
      { value: 'SUPER_ADMIN', label: 'Super Admin' },
    ];
  }

  /**
   * Gets all valid user status options for dropdowns
   */
  static getUserStatusOptions(): Array<{ value: UserStatus | 'all'; label: string }> {
    return [
      { value: 'all', label: 'All Statuses' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'DELETED', label: 'Deleted' },
    ];
  }
}

// API Error types for better error handling
export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}

export interface ApiValidationError extends ApiError {
  field?: string;
  received?: string;
  expected?: string[];
}

// API Response types
export interface UsersApiResponse {
  users: Array<{
    id: string;
    name?: string | null;
    email: string | null;
    type: UserType;
    contact_name?: string | null;
    contact_number?: string | null;
    companyName?: string | null;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
  }>;
  totalPages: number;
  totalCount: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

// API Request parameters
export interface UsersApiParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ApiUserStatusFilter;
  type?: ApiUserTypeFilter;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
}
