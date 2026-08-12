// Proof of Delivery Types
// Types for the POD photo capture and display feature

import { Coordinates } from './tracking';

/**
 * Capture state machine states for POD photo capture UI
 */
export type PODCaptureStatus =
  | 'idle'
  | 'requesting_permission'
  | 'capturing'
  | 'previewing'
  | 'compressing'
  | 'uploading'
  | 'queued' // Photo queued for offline upload
  | 'complete'
  | 'error';

/**
 * Camera permission states
 */
export type CameraPermissionState =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unavailable';

/**
 * State for the POD capture component
 */
export interface PODCaptureState {
  status: PODCaptureStatus;
  previewUrl: string | null;
  uploadProgress: number;
  error: string | null;
  file: File | null;
}

/**
 * Result from POD upload operation
 */
export interface PODUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  metadata?: PODMetadata;
}

/**
 * Metadata stored with POD photo
 */
export interface PODMetadata {
  deliveryId: string;
  capturedAt: Date;
  uploadedAt: Date;
  location?: Coordinates;
  deviceInfo?: string;
  compressionApplied: boolean;
  originalSize?: number;
  compressedSize?: number;
  originalFilename?: string;
}

/**
 * Full proof of delivery data for display
 */
export interface ProofOfDeliveryData {
  id: string;
  deliveryId: string;
  photoUrl: string;
  thumbnailUrl?: string;
  capturedAt: Date;
  uploadedAt: Date;
  location?: Coordinates;
  metadata?: PODMetadata;
}

/**
 * Props for the ProofOfDeliveryCapture component
 */
export interface ProofOfDeliveryCaptureProps {
  deliveryId: string;
  orderNumber: string;
  isRequired?: boolean;
  onUploadComplete: (url: string, metadata?: PODMetadata) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
  className?: string;
  /** Custom upload endpoint - defaults to tracking API if not provided */
  uploadEndpoint?: string;
  /** Hide the card's own "Proof of Delivery" title — for hosts (sheets/dialogs)
   *  that already render a title above this component. */
  hideTitle?: boolean;
}

/**
 * Props for the ProofOfDeliveryViewer component
 */
export interface ProofOfDeliveryViewerProps {
  photoUrl: string | null;
  deliveryId: string;
  orderNumber: string;
  capturedAt?: Date;
  location?: Coordinates;
  className?: string;
  showDownload?: boolean;
  showLocation?: boolean;
}

/**
 * Props for the DeliveryCompletionFlow component
 */
export interface DeliveryCompletionFlowProps {
  deliveryId: string;
  orderNumber: string;
  currentStatus: string;
  photoRequired?: boolean;
  existingPhotoUrl?: string | null;
  onComplete: (photoUrl?: string, notes?: string) => void;
  onCancel: () => void;
}

/**
 * Completion flow steps
 */
export type CompletionFlowStep =
  | 'confirm_arrival'
  | 'capture_photo'
  | 'add_notes'
  | 'confirm_complete';

/**
 * State for the delivery completion flow
 */
export interface CompletionFlowState {
  step: CompletionFlowStep;
  photoUrl: string | null;
  notes: string;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Image compression options
 */
export interface ImageCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  fileType?: 'image/jpeg' | 'image/png' | 'image/webp';
  useWebWorker?: boolean;
}

/**
 * Server-side upload cap for POD photos — single source of truth shared by the
 * POD API route, the storage helper, and the client-side pre-upload guard.
 *
 * 4MB keeps a multipart POST safely under Vercel's ~4.5MB platform body limit
 * while leaving generous headroom over the client compression target, because
 * browser-image-compression's maxSizeMB is best-effort: a phone photo
 * "compressed to about 2MB" used to straddle the old exact 2MB cap.
 */
export const POD_MAX_UPLOAD_SIZE_MB = 4;
export const POD_MAX_UPLOAD_SIZE_BYTES = POD_MAX_UPLOAD_SIZE_MB * 1024 * 1024;

/**
 * Safety margin between what the client will send and what the server accepts,
 * so a compressed result can never straddle the server cap.
 */
export const POD_UPLOAD_SAFETY_MARGIN_MB = 0.5;

/**
 * Client-side hard limit: a compressed photo over this size is never POSTed —
 * the capture UI surfaces an error instead of sending a doomed request.
 */
export const POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES =
  (POD_MAX_UPLOAD_SIZE_MB - POD_UPLOAD_SAFETY_MARGIN_MB) * 1024 * 1024;

/**
 * Default compression options for POD photos.
 *
 * The target is deliberately well under POD_MAX_UPLOAD_SIZE_MB: maxSizeMB is a
 * best-effort hint to browser-image-compression, so the target must leave room
 * for overshoot (compressImage additionally retries and enforces
 * POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES as a hard ceiling).
 */
export const DEFAULT_POD_COMPRESSION_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1600,
  quality: 0.85,
  fileType: 'image/jpeg',
  useWebWorker: true,
};

/**
 * POD photo validation constraints
 */
export const POD_VALIDATION_CONSTRAINTS = {
  maxFileSizeMB: 10, // Max size before compression
  minFileSizeMB: 0.001, // 1KB minimum
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  maxCompressedSizeMB: POD_MAX_UPLOAD_SIZE_MB,
  maxWidthOrHeight: 4096, // Max input dimensions
} as const;

/**
 * POD storage configuration
 */
export const POD_STORAGE_CONFIG = {
  bucketName: 'delivery-proofs',
  pathPrefix: 'deliveries',
  filenamePattern: 'delivery-{deliveryId}-{timestamp}.jpg',
} as const;

/**
 * Admin POD gallery filter options
 */
export interface PODGalleryFilters {
  dateFrom?: Date;
  dateTo?: Date;
  driverId?: string;
  deliveryStatus?: string;
  searchQuery?: string;
}

/**
 * POD gallery item for admin view
 */
export interface PODGalleryItem {
  id: string;
  deliveryId: string;
  orderNumber: string;
  photoUrl: string;
  thumbnailUrl?: string;
  capturedAt: Date;
  driverName: string;
  driverId: string;
  customerName?: string;
  deliveryAddress?: string;
  deliveryStatus: string;
}

/**
 * POD gallery pagination
 */
export interface PODGalleryPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
