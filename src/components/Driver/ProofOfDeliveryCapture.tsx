'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  RotateCcw,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Loader2,
  WifiOff,
  CloudOff,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCameraPermission, isMobileDevice } from '@/hooks/useCameraPermission';
import {
  compressImage,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
  formatFileSize,
  generatePODFilename,
} from '@/lib/utils/image-compression';
import {
  ProofOfDeliveryCaptureProps,
  PODCaptureState,
  PODMetadata,
  POD_STORAGE_CONFIG,
} from '@/types/proof-of-delivery';
import { usePODOfflineQueue } from '@/hooks/tracking/usePODOfflineQueue';
import { Badge } from '@/components/ui/badge';

/**
 * ProofOfDeliveryCapture Component
 *
 * Mobile-optimized photo capture component for drivers to take
 * proof of delivery photos during delivery completion.
 *
 * Features:
 * - Native camera access with back camera preferred
 * - Image compression before upload
 * - Preview with retake option
 * - Upload progress indicator
 * - Graceful permission handling
 */
export function ProofOfDeliveryCapture({
  deliveryId,
  orderNumber,
  isRequired = false,
  onUploadComplete,
  onCancel,
  onError,
  className,
  uploadEndpoint,
}: ProofOfDeliveryCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { permission, requestPermission, error: permissionError, isCameraSupported } = useCameraPermission();
  const { offlineStatus, queuePODUpload, syncPendingUploads } = usePODOfflineQueue();

  const [state, setState] = useState<PODCaptureState>({
    status: 'idle',
    previewUrl: null,
    uploadProgress: 0,
    error: null,
    file: null,
  });

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (state.previewUrl) {
        revokeImagePreviewUrl(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input for same file selection
    event.target.value = '';

    setState((prev) => ({
      ...prev,
      status: 'compressing',
      error: null,
    }));

    try {
      // Compress the image
      const result = await compressImage(file);
      const previewUrl = createImagePreviewUrl(result.file);

      setState({
        status: 'previewing',
        previewUrl,
        uploadProgress: 0,
        error: null,
        file: result.file,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [onError]);

  /**
   * Trigger the file input click
   */
  const handleCaptureClick = useCallback(async () => {
    // Request permission if needed (this will trigger browser dialog)
    if (permission === 'prompt' || permission === 'denied') {
      await requestPermission();
    }

    // Open file picker / camera
    fileInputRef.current?.click();
  }, [permission, requestPermission]);

  /**
   * Handle retake - clear current preview
   */
  const handleRetake = useCallback(() => {
    if (state.previewUrl) {
      revokeImagePreviewUrl(state.previewUrl);
    }
    setState({
      status: 'idle',
      previewUrl: null,
      uploadProgress: 0,
      error: null,
      file: null,
    });
  }, [state.previewUrl]);

  /**
   * Upload the captured photo (with offline support)
   */
  const handleUpload = useCallback(async () => {
    if (!state.file) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'No image to upload',
      }));
      return;
    }

    const apiEndpoint = uploadEndpoint || `/api/tracking/deliveries/${deliveryId}/pod`;

    // Check if we're offline - queue for later
    if (!offlineStatus.isOnline) {
      try {
        await queuePODUpload(
          deliveryId,
          orderNumber,
          state.file,
          apiEndpoint,
          {
            capturedAt: new Date(),
            compressionApplied: true,
            originalSize: state.file.size,
          }
        );

        setState((prev) => ({
          ...prev,
          status: 'queued',
        }));

        // Create metadata for parent callback
        const metadata: PODMetadata = {
          deliveryId,
          capturedAt: new Date(),
          uploadedAt: new Date(),
          compressionApplied: true,
          compressedSize: state.file.size,
          originalFilename: state.file.name,
        };

        // Notify parent - use preview URL as temporary URL
        onUploadComplete(state.previewUrl || '', metadata);
        return;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to queue upload';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
        }));
        onError?.(errorMessage);
        return;
      }
    }

    // Online - proceed with direct upload
    setState((prev) => ({
      ...prev,
      status: 'uploading',
      uploadProgress: 0,
    }));

    try {
      // Create form data for upload
      const formData = new FormData();
      const filename = generatePODFilename(deliveryId);
      formData.append('file', state.file, filename);
      formData.append('deliveryId', deliveryId);

      // Upload to API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      // Create metadata
      const metadata: PODMetadata = {
        deliveryId,
        capturedAt: new Date(),
        uploadedAt: new Date(),
        compressionApplied: true,
        compressedSize: state.file.size,
        originalFilename: state.file.name,
      };

      setState((prev) => ({
        ...prev,
        status: 'complete',
        uploadProgress: 100,
      }));

      // Notify parent of successful upload
      onUploadComplete(result.url, metadata);
    } catch (err) {
      // Check if this is a network error - queue for later
      if (!navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))) {
        try {
          await queuePODUpload(
            deliveryId,
            orderNumber,
            state.file,
            apiEndpoint,
            {
              capturedAt: new Date(),
              compressionApplied: true,
              originalSize: state.file.size,
            }
          );

          setState((prev) => ({
            ...prev,
            status: 'queued',
          }));

          const metadata: PODMetadata = {
            deliveryId,
            capturedAt: new Date(),
            uploadedAt: new Date(),
            compressionApplied: true,
            compressedSize: state.file.size,
            originalFilename: state.file.name,
          };

          onUploadComplete(state.previewUrl || '', metadata);
          return;
        } catch (queueErr) {
          // If queuing also fails, show error
        }
      }

      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [state.file, state.previewUrl, deliveryId, orderNumber, uploadEndpoint, offlineStatus.isOnline, queuePODUpload, onUploadComplete, onError]);

  /**
   * Render camera permission error state
   */
  const renderPermissionError = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {permissionError || 'Camera access is required to take a photo. Please enable camera permissions in your browser settings.'}
      </AlertDescription>
    </Alert>
  );

  /**
   * Render the idle/capture state
   */
  const renderCaptureState = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-muted p-6">
        <Camera className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="font-medium">Take a Photo</h3>
        <p className="text-sm text-muted-foreground">
          {isRequired
            ? 'A photo is required to complete this delivery'
            : 'Optionally add a proof of delivery photo'}
        </p>
      </div>
      <Button onClick={handleCaptureClick} size="lg" className="gap-2">
        <Camera className="h-5 w-5" />
        {isMobileDevice() ? 'Take Photo' : 'Choose Photo'}
      </Button>
      {!isCameraSupported && (
        <p className="text-xs text-muted-foreground">
          Camera not available. You can select an existing photo instead.
        </p>
      )}
    </div>
  );

  /**
   * Render compression in progress
   */
  const renderCompressing = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Processing image...</p>
    </div>
  );

  /**
   * Render the preview state
   */
  const renderPreview = () => (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {state.previewUrl ? (
          <img
            src={state.previewUrl}
            alt="Proof of delivery preview"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      {state.file && (
        <p className="text-center text-sm text-muted-foreground">
          Size: {formatFileSize(state.file.size)}
        </p>
      )}
    </div>
  );

  /**
   * Render upload progress
   */
  const renderUploading = () => (
    <div className="flex flex-col gap-4 py-4">
      {state.previewUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted opacity-50">
          <img
            src={state.previewUrl}
            alt="Uploading..."
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Uploading...</span>
          <span>{state.uploadProgress}%</span>
        </div>
        <Progress value={state.uploadProgress} />
      </div>
    </div>
  );

  /**
   * Render success state
   */
  const renderComplete = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-green-100 p-4">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div className="text-center">
        <h3 className="font-medium text-green-600">Photo Uploaded</h3>
        <p className="text-sm text-muted-foreground">
          Proof of delivery has been saved
        </p>
      </div>
    </div>
  );

  /**
   * Render queued state (offline)
   */
  const renderQueued = () => (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-amber-100 p-4">
        <CloudOff className="h-8 w-8 text-amber-600" />
      </div>
      <div className="text-center">
        <h3 className="font-medium text-amber-600">Photo Queued</h3>
        <p className="text-sm text-muted-foreground">
          Will upload automatically when back online
        </p>
      </div>
      {offlineStatus.pendingUploads > 0 && (
        <Badge variant="secondary" className="mt-2">
          {offlineStatus.pendingUploads} pending upload{offlineStatus.pendingUploads > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <div className="flex flex-col items-center gap-4 py-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={handleRetake} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );

  /**
   * Render content based on current state
   */
  const renderContent = () => {
    // Show permission error if camera is denied
    if (permission === 'denied') {
      return renderPermissionError();
    }

    switch (state.status) {
      case 'idle':
      case 'requesting_permission':
        return renderCaptureState();
      case 'capturing':
      case 'compressing':
        return renderCompressing();
      case 'previewing':
        return renderPreview();
      case 'uploading':
        return renderUploading();
      case 'queued':
        return renderQueued();
      case 'complete':
        return renderComplete();
      case 'error':
        return renderError();
      default:
        return renderCaptureState();
    }
  };

  /**
   * Render footer buttons based on state
   */
  const renderFooter = () => {
    if (state.status === 'complete' || state.status === 'queued') {
      return null; // Parent will handle completion
    }

    if (state.status === 'previewing') {
      return (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRetake} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
          <Button onClick={handleUpload} className="flex-1 gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      );
    }

    if (state.status === 'uploading') {
      return null; // No actions during upload
    }

    if (state.status === 'error') {
      return null; // Error state has its own retry button
    }

    // Idle state - show skip option if not required
    if (!isRequired) {
      return (
        <Button variant="ghost" onClick={onCancel} className="w-full">
          Skip Photo
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Proof of Delivery</CardTitle>
          {!offlineStatus.isOnline && (
            <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
              <WifiOff className="h-3 w-3" />
              Offline
            </Badge>
          )}
          {offlineStatus.isOnline && offlineStatus.pendingUploads > 0 && (
            <Badge variant="secondary" className="gap-1">
              <CloudUpload className="h-3 w-3" />
              {offlineStatus.pendingUploads} pending
            </Badge>
          )}
        </div>
        {state.status !== 'uploading' && state.status !== 'complete' && state.status !== 'queued' && (
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Hidden file input for camera capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Capture photo"
        />

        {renderContent()}
      </CardContent>

      {renderFooter() && <CardFooter>{renderFooter()}</CardFooter>}
    </Card>
  );
}

export default ProofOfDeliveryCapture;
