'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Camera,
  Download,
  MapPin,
  Calendar,
  Maximize2,
  X,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProofOfDeliveryViewerProps } from '@/types/proof-of-delivery';

/**
 * ProofOfDeliveryViewer Component
 *
 * Displays a proof of delivery photo with options to view full-size,
 * download, and see metadata like capture time and location.
 *
 * Features:
 * - Thumbnail preview
 * - Click to expand in full-screen modal
 * - Download option
 * - Location and timestamp display
 */
export function ProofOfDeliveryViewer({
  photoUrl,
  deliveryId,
  orderNumber,
  capturedAt,
  location,
  className,
  showDownload = true,
  showLocation = true,
}: ProofOfDeliveryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  /**
   * Handle image download
   */
  const handleDownload = async () => {
    if (!photoUrl) return;

    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pod-${orderNumber}-${deliveryId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  /**
   * Format the capture date for display
   */
  const formatCaptureDate = (date?: Date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Format location coordinates for display
   */
  const formatLocation = () => {
    if (!location) return null;
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  // No photo available
  if (!photoUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed bg-muted/50 p-4',
          className
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Camera className="h-8 w-8" />
          <span className="text-sm">No photo</span>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'group relative overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            className
          )}
        >
          {imageError ? (
            <div className="flex aspect-[4/3] items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : (
            <>
              <img
                src={photoUrl}
                alt={`Proof of delivery for ${orderNumber}`}
                className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <Maximize2 className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Proof of Delivery - {orderNumber}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {showDownload && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative flex max-h-[calc(90vh-120px)] flex-col">
          {/* Image container */}
          <div className="flex-1 overflow-auto bg-black/95 p-4">
            <img
              src={photoUrl}
              alt={`Proof of delivery for ${orderNumber}`}
              className="mx-auto max-h-full max-w-full object-contain"
            />
          </div>

          {/* Metadata footer */}
          {(capturedAt || (showLocation && location)) && (
            <div className="flex flex-wrap items-center justify-center gap-4 border-t bg-muted/50 p-3 text-sm text-muted-foreground">
              {capturedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatCaptureDate(capturedAt)}</span>
                </div>
              )}
              {showLocation && location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{formatLocation()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact POD indicator for use in lists/tables
 * Shows a camera icon that opens the viewer when clicked
 */
export function PODIndicator({
  photoUrl,
  deliveryId,
  orderNumber,
  size = 'default',
}: {
  photoUrl: string | null;
  deliveryId: string;
  orderNumber: string;
  size?: 'sm' | 'default';
}) {
  if (!photoUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded text-muted-foreground',
          size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
        )}
      >
        <Camera className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4', 'opacity-30')} />
      </div>
    );
  }

  return (
    <ProofOfDeliveryViewer
      photoUrl={photoUrl}
      deliveryId={deliveryId}
      orderNumber={orderNumber}
      className={cn(size === 'sm' ? 'h-6 w-6' : 'h-8 w-8')}
      showDownload={false}
      showLocation={false}
    />
  );
}

export default ProofOfDeliveryViewer;
