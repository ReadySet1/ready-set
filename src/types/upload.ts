// types/file.ts
// Updated based on Prisma Schema provided on 2025-04-03
// NOTE: Ideally, import this from a central types file

export interface FileUpload {
  id: string; // Prisma: String @id
  fileName: string; // Prisma: String
  fileType: string; // Prisma: String
  fileSize: number; // Prisma: Int
  fileUrl: string; // Prisma: String
  // entityType: string; // Removed, use specific relation IDs
  // entityId: string; // Removed, use specific relation IDs
  category?: string | null; // Prisma: String? - Made explicitly nullable
  uploadedAt: Date | string; // Prisma: DateTime. Allow string for JSON.
  updatedAt: Date | string; // Prisma: DateTime. Allow string for JSON.
  userId?: string | null; // Prisma: String? @db.Uuid
  // Relation IDs are Strings (UUIDs) in Prisma
  cateringRequestId?: string | null; // Prisma: String? @db.Uuid
  onDemandId?: string | null; // Prisma: String? @db.Uuid
  jobApplicationId?: string | null; // Prisma: String? @db.Uuid (Added from schema)
  isTemporary: boolean; // Prisma: Boolean (Added from schema)
}

// Enhanced error handling for file uploads
export enum UploadErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  QUOTA_ERROR = 'QUOTA_ERROR',
  VIRUS_ERROR = 'VIRUS_ERROR',
  SIZE_ERROR = 'SIZE_ERROR',
  TYPE_ERROR = 'TYPE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface UploadError {
  type: UploadErrorType;
  message: string;
  userMessage: string;
  details?: Record<string, any>;
  retryable: boolean;
  retryAfter?: number; // milliseconds
  correlationId?: string;
  timestamp: Date;
  originalError?: Error;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
  status: 'uploading' | 'paused' | 'error' | 'completed' | 'cancelled';
  error?: UploadError;
  retryCount: number;
  startTime: number;
  lastUpdated: number;
}

export interface UploadSession {
  sessionId: string;
  files: UploadProgress[];
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalProgress: number;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  error?: UploadError;
}

export interface FileValidationConfig {
  maxSize: number;
  allowedTypes: string[];
  blockedTypes: string[];
  allowedExtensions: string[];
  blockedExtensions: string[];
  checkVirus: boolean;
  sanitizeFilename: boolean;
  scanContent: boolean;
}

export interface UploadOptions {
  retryConfig?: Partial<RetryConfig>;
  validationConfig?: Partial<FileValidationConfig>;
  chunkSize?: number;
  concurrentUploads?: number;
  timeout?: number;
  preserveProgress?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onRetry?: (error: UploadError, attempt: number) => void;
  onError?: (error: UploadError) => void;
  onSuccess?: (file: FileUpload) => void;
}

export interface SecurityScanResult {
  isClean: boolean;
  threats: string[];
  score: number;
  details?: Record<string, any>;
}

// API Error Response Types
export interface ErrorResponseDetails {
  bucket?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  originalError?: string;
  [key: string]: any;
}

export interface ErrorResponseDiagnostics {
  operation?: string;
  originalError?: string;
  bucket?: string;
  filePath?: string;
  fileType?: string;
  [key: string]: any;
}

export interface ErrorResponse {
  error: string;
  errorType: string;
  correlationId: string;
  retryable?: boolean;
  retryAfter?: number;
  details?: ErrorResponseDetails;
  diagnostics?: ErrorResponseDiagnostics;
}