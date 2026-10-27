'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCameraPermission, isMobileDevice } from '@/hooks/useCameraPermission';
import {
  compressImage,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
  generatePODFilename,
  POD_PHOTO_TOO_LARGE_ERROR,
} from '@/lib/utils/image-compression';
import {
  PODMetadata,
  POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES,
  ProofOfDeliveryCaptureProps,
} from '@/types/proof-of-delivery';
import { POD_PHOTO_LIMIT_CODE } from '@/lib/driver/stage-photos';
import { usePODOfflineQueue } from '@/hooks/tracking/usePODOfflineQueue';
import { withBearerAuth } from '@/lib/auth/bearer-session';

interface CapturedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  /** Server URL once this photo's POST succeeded. */
  uploadedUrl: string | null;
}

type MultiCaptureStatus = 'collecting' | 'compressing' | 'uploading' | 'complete' | 'queued' | 'error';

/** An upload the server refused on purpose (vs. a network failure). */
class UploadRejectedError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'UploadRejectedError';
  }
}

let photoSeq = 0;
const nextPhotoId = () => `pod-photo-${Date.now()}-${++photoSeq}`;

/**
 * Multi-photo proof of delivery (card `delivery-finalize-multi-photo`).
 *
 * The driver collects 1..maxPhotos photos as thumbnails (count shown as
 * "2 of 3 photos"), can remove any photo not yet uploaded, then submits. Each
 * photo is POSTed on its own — the same request shape the offline queue
 * replays — and the server caps the order (409 POD_PHOTO_LIMIT). A failed
 * upload never traps the driver: network failures queue the remaining photos
 * for background sync, server errors offer "Try again" (only the photos not
 * yet stored) or "Complete anyway".
 *
 * Rendered by ProofOfDeliveryCapture when `maxPhotos > 1`.
 */
export function ProofOfDeliveryMultiCapture({
  deliveryId,
  orderNumber,
  isRequired = false,
  onUploadComplete,
  onCancel,
  onError,
  className,
  uploadEndpoint,
  hideTitle = false,
  requirementHint,
  maxPhotos = 3,
}: ProofOfDeliveryCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { permission, error: permissionError, isCameraSupported } = useCameraPermission();
  const { offlineStatus, queuePODUpload } = usePODOfflineQueue();

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [status, setStatus] = useState<MultiCaptureStatus>('collecting');
  const [error, setError] = useState<string | null>(null);
  /** The server already holds the maximum — retrying or queueing is pointless. */
  const [limitReached, setLimitReached] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(0);

  const endpoint = uploadEndpoint || `/api/tracking/deliveries/${deliveryId}/pod`;
  const busy = status === 'uploading' || status === 'compressing';
  const finished = status === 'complete' || status === 'queued';
  const canAdd = photos.length < maxPhotos && !busy && !finished;
  const minPhotos = isRequired ? 1 : 0;

  // Revoke every preview URL on unmount.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => revokeImagePreviewUrl(photo.previewUrl));
    },
    [],
  );

  /**
   * Must stay fully synchronous: iOS WKWebView only honors a programmatic
   * file-input click inside the tap's transient user activation (see the
   * matching note in ProofOfDeliveryCapture). No await before the click.
   */
  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || photosRef.current.length >= maxPhotos) return;

      setStatus('compressing');
      setError(null);
      try {
        const result = await compressImage(file);
        const previewUrl = createImagePreviewUrl(result.file);
        setPhotos((prev) => {
          if (prev.length >= maxPhotos) {
            revokeImagePreviewUrl(previewUrl);
            return prev;
          }
          return [...prev, { id: nextPhotoId(), file: result.file, previewUrl, uploadedUrl: null }];
        });
        setStatus('collecting');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process image';
        setStatus('collecting');
        setError(message);
        onError?.(message);
      }
    },
    [maxPhotos, onError],
  );

  const handleRemove = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (!target || target.uploadedUrl) return prev;
      revokeImagePreviewUrl(target.previewUrl);
      return prev.filter((photo) => photo.id !== id);
    });
    setError(null);
  }, []);

  const buildMetadata = useCallback(
    (file: File | undefined): PODMetadata => ({
      deliveryId,
      capturedAt: new Date(),
      uploadedAt: new Date(),
      compressionApplied: true,
      compressedSize: file?.size,
      originalFilename: file?.name,
    }),
    [deliveryId],
  );

  /** Report completion with every stored URL (local previews stand in for queued ones). */
  const finish = useCallback(
    (current: CapturedPhoto[], nextStatus: 'complete' | 'queued') => {
      setStatus(nextStatus);
      const urls = current.map((photo) => photo.uploadedUrl ?? photo.previewUrl);
      onUploadComplete(urls[0] ?? '', buildMetadata(current[0]?.file), urls);
    },
    [onUploadComplete, buildMetadata],
  );

  const queuePending = useCallback(
    async (current: CapturedPhoto[]) => {
      try {
        for (const photo of current) {
          if (photo.uploadedUrl) continue;
          await queuePODUpload(deliveryId, orderNumber, photo.file, endpoint, {
            capturedAt: new Date(),
            compressionApplied: true,
            originalSize: photo.file.size,
          });
        }
        finish(current, 'queued');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to queue upload';
        setStatus('error');
        setError(message);
        onError?.(message);
      }
    },
    [deliveryId, orderNumber, endpoint, queuePODUpload, finish, onError],
  );

  const postPhoto = useCallback(
    async (photo: CapturedPhoto): Promise<string> => {
      const formData = new FormData();
      formData.append('file', photo.file, generatePODFilename(deliveryId));
      formData.append('deliveryId', deliveryId);
      // Bearer token survives stale auth cookies; no manual Content-Type so
      // the browser sets the multipart boundary.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: await withBearerAuth(),
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const serverMessage = body.error || body.message || response.statusText || '';
        console.error('POD upload failed:', response.status, body);
        throw new UploadRejectedError(
          body.code === POD_PHOTO_LIMIT_CODE
            ? serverMessage
            : `Failed to upload proof of delivery (${response.status}${serverMessage ? ` — ${serverMessage}` : ''})`,
          typeof body.code === 'string' ? body.code : null,
        );
      }
      const result = await response.json();
      return typeof result.url === 'string' ? result.url : '';
    },
    [deliveryId, endpoint],
  );

  const handleSubmit = useCallback(async () => {
    const current = photosRef.current;
    if (current.length < Math.max(minPhotos, 1)) return;

    // Never send (or queue) a file the server would always reject.
    if (current.some((photo) => photo.file.size > POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES)) {
      setPhotos((prev) =>
        prev.filter((photo) => {
          const tooLarge = photo.file.size > POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES;
          if (tooLarge) revokeImagePreviewUrl(photo.previewUrl);
          return !tooLarge;
        }),
      );
      setError(POD_PHOTO_TOO_LARGE_ERROR);
      onError?.(POD_PHOTO_TOO_LARGE_ERROR);
      return;
    }

    setError(null);
    setLimitReached(false);

    if (!offlineStatus.isOnline) {
      await queuePending(current);
      return;
    }

    setStatus('uploading');
    const working = [...current];
    for (let i = 0; i < working.length; i++) {
      const photo = working[i]!;
      if (photo.uploadedUrl) continue;
      setUploadingIndex(i + 1);
      try {
        const url = await postPhoto(photo);
        working[i] = { ...photo, uploadedUrl: url };
        setPhotos([...working]);
      } catch (err) {
        console.error('POD upload error:', err);
        // Network-level failure → queue what is left and let completion proceed.
        if (!navigator.onLine || err instanceof TypeError) {
          await queuePending(working);
          return;
        }
        const message = err instanceof Error ? err.message : 'Upload failed';
        setLimitReached(err instanceof UploadRejectedError && err.code === POD_PHOTO_LIMIT_CODE);
        setStatus('error');
        setError(message);
        onError?.(message);
        return;
      }
    }
    finish(working, 'complete');
  }, [minPhotos, offlineStatus.isOnline, queuePending, postPhoto, finish, onError]);

  /** Server already holds the maximum: continue with what it has. */
  const handleContinueAtLimit = useCallback(() => {
    const stored = photosRef.current.filter((photo) => photo.uploadedUrl);
    finish(stored, 'complete');
  }, [finish]);

  const handleRetry = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const handleCompleteAnyway = useCallback(() => {
    void queuePending(photosRef.current);
  }, [queuePending]);

  const countLabel = `${photos.length} of ${maxPhotos} photos`;
  const hint =
    requirementHint ??
    (isRequired
      ? `Add up to ${maxPhotos} photos of the setup — at least 1 is required`
      : `Optionally add up to ${maxPhotos} photos of the delivery`);

  const renderGrid = () => (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="relative aspect-square overflow-hidden rounded-lg bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */}
          <img
            src={photo.previewUrl}
            alt={`Proof of delivery photo ${index + 1}`}
            className={cn('h-full w-full object-cover', status === 'uploading' && !photo.uploadedUrl && 'opacity-50')}
          />
          {photo.uploadedUrl ? (
            <span className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
            </span>
          ) : !busy && !finished ? (
            <button
              type="button"
              onClick={() => handleRemove(photo.id)}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
      {canAdd ? (
        <button
          type="button"
          onClick={handleAddClick}
          aria-label="Add photo"
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground"
        >
          {photos.length === 0 ? <Camera className="h-6 w-6" aria-hidden /> : <Plus className="h-6 w-6" aria-hidden />}
          <span className="text-xs font-medium">
            {photos.length === 0 && isMobileDevice() ? 'Take photo' : 'Add photo'}
          </span>
        </button>
      ) : null}
      {status === 'compressing' ? (
        <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Processing image" />
        </div>
      ) : null}
    </div>
  );

  const renderFinished = () =>
    status === 'complete' ? (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-green-600">
            {photos.length === 1 ? 'Photo uploaded' : 'Photos uploaded'}
          </h3>
          <p className="text-sm text-muted-foreground">Proof of delivery has been saved</p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="rounded-full bg-amber-100 p-4">
          <CloudOff className="h-8 w-8 text-amber-600" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-amber-600">Photos queued</h3>
          <p className="text-sm text-muted-foreground">Will upload automatically when back online</p>
        </div>
      </div>
    );

  const renderError = () =>
    error ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null;

  const renderFooter = () => {
    if (finished || status === 'uploading') return null;

    if (status === 'error') {
      if (limitReached) {
        return (
          <Button onClick={handleContinueAtLimit} className="w-full gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Continue
          </Button>
        );
      }
      return (
        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" onClick={handleRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          {/* A failed upload must never trap the driver. */}
          <Button onClick={handleCompleteAnyway} className="gap-2">
            <CloudUpload className="h-4 w-4" />
            Complete anyway — upload photos later
          </Button>
        </div>
      );
    }

    if (!isRequired && photos.length === 0) {
      return (
        <Button variant="ghost" onClick={onCancel} className="w-full">
          Skip Photo
        </Button>
      );
    }

    return (
      <Button
        onClick={() => void handleSubmit()}
        disabled={photos.length < Math.max(minPhotos, 1) || busy}
        className="w-full gap-2"
      >
        <Upload className="h-4 w-4" />
        {`Upload ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
      </Button>
    );
  };

  const footer = renderFooter();

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          {!hideTitle && <CardTitle className="text-lg">Proof of Delivery</CardTitle>}
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
        {!finished && status !== 'uploading' && (
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Capture photo"
        />

        {permission === 'denied' ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {permissionError ||
                'Camera access is required to take a photo. Please enable camera permissions in your browser settings.'}
            </AlertDescription>
          </Alert>
        ) : finished ? (
          renderFinished()
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">{hint}</p>
              <span className="shrink-0 text-sm font-semibold tabular-nums" aria-live="polite">
                {countLabel}
              </span>
            </div>
            {renderGrid()}
            {status === 'uploading' ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {`Uploading photo ${uploadingIndex} of ${photos.length}…`}
              </p>
            ) : null}
            {!isCameraSupported && photos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Camera not available. You can select an existing photo instead.
              </p>
            ) : null}
            {renderError()}
          </>
        )}
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

export default ProofOfDeliveryMultiCapture;
