import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProofOfDeliveryCapture } from '../ProofOfDeliveryCapture';

// Mock hooks
const mockRequestPermission = jest.fn();
const mockQueuePODUpload = jest.fn();
const mockSyncPendingUploads = jest.fn();

jest.mock('@/hooks/useCameraPermission', () => ({
  useCameraPermission: jest.fn(() => ({
    permission: 'prompt',
    requestPermission: mockRequestPermission,
    error: null,
    isCameraSupported: true,
  })),
  isMobileDevice: jest.fn(() => true),
}));

jest.mock('@/hooks/tracking/usePODOfflineQueue', () => ({
  usePODOfflineQueue: jest.fn(() => ({
    offlineStatus: { isOnline: true, pendingUploads: 0 },
    queuePODUpload: mockQueuePODUpload,
    syncPendingUploads: mockSyncPendingUploads,
  })),
}));

// Mock image compression utilities
jest.mock('@/lib/utils/image-compression', () => ({
  compressImage: jest.fn().mockResolvedValue({
    file: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
    originalSize: 5000,
    compressedSize: 2000,
    compressionRatio: 0.4,
  }),
  createImagePreviewUrl: jest.fn().mockReturnValue('blob:test-preview-url'),
  revokeImagePreviewUrl: jest.fn(),
  formatFileSize: jest.fn((size: number) => `${(size / 1024).toFixed(1)} KB`),
  generatePODFilename: jest.fn((deliveryId: string) => `pod-${deliveryId}.jpg`),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
  CardFooter: ({ children, className }: any) => (
    <div data-testid="card-footer" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className}>
      Progress: {value}%
    </div>
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant, className }: any) => (
    <div data-testid="alert" data-variant={variant} className={className}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <p data-testid="alert-description">{children}</p>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Camera: () => <span data-testid="camera-icon">Camera</span>,
  RotateCcw: () => <span data-testid="rotate-icon">Rotate</span>,
  Upload: () => <span data-testid="upload-icon">Upload</span>,
  X: () => <span data-testid="x-icon">X</span>,
  CheckCircle2: () => <span data-testid="check-circle-icon">Check</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
  ImageIcon: () => <span data-testid="image-icon">Image</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  WifiOff: () => <span data-testid="wifi-off-icon">WifiOff</span>,
  CloudOff: () => <span data-testid="cloud-off-icon">CloudOff</span>,
  CloudUpload: () => <span data-testid="cloud-upload-icon">CloudUpload</span>,
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock types
jest.mock('@/types/proof-of-delivery', () => ({
  POD_STORAGE_CONFIG: {
    bucketName: 'delivery-proofs',
    pathPrefix: 'deliveries',
    filenamePattern: 'delivery-{deliveryId}-{timestamp}.jpg',
  },
}));

const { useCameraPermission, isMobileDevice } = require('@/hooks/useCameraPermission');
const { usePODOfflineQueue } = require('@/hooks/tracking/usePODOfflineQueue');
const { compressImage, createImagePreviewUrl, revokeImagePreviewUrl } = require('@/lib/utils/image-compression');

describe('ProofOfDeliveryCapture', () => {
  const defaultProps = {
    deliveryId: 'delivery-123',
    orderNumber: 'ORDER-456',
    onUploadComplete: jest.fn(),
    onCancel: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    useCameraPermission.mockReturnValue({
      permission: 'prompt',
      requestPermission: mockRequestPermission,
      error: null,
      isCameraSupported: true,
    });

    usePODOfflineQueue.mockReturnValue({
      offlineStatus: { isOnline: true, pendingUploads: 0 },
      queuePODUpload: mockQueuePODUpload,
      syncPendingUploads: mockSyncPendingUploads,
    });

    isMobileDevice.mockReturnValue(true);

    // Mock fetch
    global.fetch = jest.fn();
  });

  describe('Component Rendering', () => {
    it('should render the capture component with title', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Proof of Delivery')).toBeInTheDocument();
    });

    it('should render the camera icon', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      // Camera icon appears in both the display area and the button
      const cameraIcons = screen.getAllByTestId('camera-icon');
      expect(cameraIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('should apply custom className', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} className="custom-class" />);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
    });

    it('should show close button', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  describe('Idle State', () => {
    it('should display "Take a Photo" prompt', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Take a Photo')).toBeInTheDocument();
    });

    it('should show optional message when not required', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} isRequired={false} />);

      expect(screen.getByText('Optionally add a proof of delivery photo')).toBeInTheDocument();
    });

    it('should show required message when required', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} isRequired={true} />);

      expect(screen.getByText('A photo is required to complete this delivery')).toBeInTheDocument();
    });

    it('should display "Take Photo" button on mobile', () => {
      isMobileDevice.mockReturnValue(true);
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Take Photo')).toBeInTheDocument();
    });

    it('should display "Choose Photo" button on desktop', () => {
      isMobileDevice.mockReturnValue(false);
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Choose Photo')).toBeInTheDocument();
    });

    it('should show Skip Photo button when not required', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} isRequired={false} />);

      expect(screen.getByText('Skip Photo')).toBeInTheDocument();
    });

    it('should not show Skip Photo button when required', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} isRequired={true} />);

      expect(screen.queryByText('Skip Photo')).not.toBeInTheDocument();
    });
  });

  describe('Camera Permission States', () => {
    it('should show error when camera permission is denied', () => {
      useCameraPermission.mockReturnValue({
        permission: 'denied',
        requestPermission: mockRequestPermission,
        error: null,
        isCameraSupported: true,
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText(/Camera access is required/)).toBeInTheDocument();
    });

    it('should show custom permission error message', () => {
      useCameraPermission.mockReturnValue({
        permission: 'denied',
        requestPermission: mockRequestPermission,
        error: 'Custom error message',
        isCameraSupported: true,
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should show message when camera is not supported', () => {
      useCameraPermission.mockReturnValue({
        permission: 'prompt',
        requestPermission: mockRequestPermission,
        error: null,
        isCameraSupported: false,
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('Camera not available. You can select an existing photo instead.')).toBeInTheDocument();
    });

    it('should request permission when Take Photo is clicked', async () => {
      mockRequestPermission.mockResolvedValue(true);

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const takePhotoButton = screen.getByText('Take Photo').closest('button');
      fireEvent.click(takePhotoButton!);

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalled();
      });
    });
  });

  describe('File Selection and Compression', () => {
    it('should process image when file is selected', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(compressImage).toHaveBeenCalledWith(file);
      });
    });

    it('should show preview after compression', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(createImagePreviewUrl).toHaveBeenCalled();
      });
    });

    it('should show error state when compression fails', async () => {
      compressImage.mockRejectedValueOnce(new Error('Compression failed'));

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Compression failed')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('Compression failed');
    });
  });

  describe('Preview State', () => {
    const selectFile = async () => {
      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });
      await waitFor(() => {
        expect(createImagePreviewUrl).toHaveBeenCalled();
      });
    };

    it('should show preview image', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);
      await selectFile();

      const previewImage = document.querySelector('img[alt="Proof of delivery preview"]');
      expect(previewImage).toBeInTheDocument();
    });

    it('should show file size', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);
      await selectFile();

      await waitFor(() => {
        expect(screen.getByText(/Size:/)).toBeInTheDocument();
      });
    });

    it('should show Retake and Upload buttons', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);
      await selectFile();

      expect(screen.getByText('Retake')).toBeInTheDocument();
      // Upload appears both as icon text and button text
      const uploadElements = screen.getAllByText('Upload');
      expect(uploadElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should clear preview when Retake is clicked', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);
      await selectFile();

      const retakeButton = screen.getByText('Retake').closest('button');
      fireEvent.click(retakeButton!);

      expect(revokeImagePreviewUrl).toHaveBeenCalled();
      expect(screen.getByText('Take a Photo')).toBeInTheDocument();
    });
  });

  describe('Upload Flow', () => {
    const selectFileAndGetUploadButton = async (): Promise<HTMLButtonElement> => {
      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      // Wait for preview state - Retake button appears
      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      // Find the upload button (not the icon, not the outline button)
      const buttons = screen.getAllByTestId('button');
      const uploadButton = buttons.find(
        btn => btn.textContent?.includes('Upload') && btn.getAttribute('data-variant') !== 'outline'
      );
      return uploadButton as HTMLButtonElement;
    };

    it('should upload photo when Upload button is clicked', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/photo.jpg' }),
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);
      const uploadButton = await selectFileAndGetUploadButton();
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/tracking/deliveries/delivery-123/pod',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should use custom upload endpoint when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/photo.jpg' }),
      });

      render(<ProofOfDeliveryCapture {...defaultProps} uploadEndpoint="/custom/upload" />);
      const uploadButton = await selectFileAndGetUploadButton();
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/custom/upload',
          expect.anything()
        );
      });
    });

    it('should call onUploadComplete on successful upload', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/photo.jpg' }),
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);
      const uploadButton = await selectFileAndGetUploadButton();
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(defaultProps.onUploadComplete).toHaveBeenCalledWith(
          'https://example.com/photo.jpg',
          expect.objectContaining({
            deliveryId: 'delivery-123',
            compressionApplied: true,
          })
        );
      });
    });

    it('should show error on upload failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);
      const uploadButton = await selectFileAndGetUploadButton();
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });

      expect(defaultProps.onError).toHaveBeenCalledWith('Upload failed');
    });
  });

  describe('Complete State', () => {
    it('should show success message after upload', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/photo.jpg' }),
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      // Find the upload button
      const buttons = screen.getAllByTestId('button');
      const uploadButton = buttons.find(
        btn => btn.textContent?.includes('Upload') && btn.getAttribute('data-variant') !== 'outline'
      );
      fireEvent.click(uploadButton!);

      await waitFor(() => {
        expect(screen.getByText('Photo Uploaded')).toBeInTheDocument();
        expect(screen.getByText('Proof of delivery has been saved')).toBeInTheDocument();
      });
    });
  });

  describe('Offline Mode', () => {
    beforeEach(() => {
      usePODOfflineQueue.mockReturnValue({
        offlineStatus: { isOnline: false, pendingUploads: 0 },
        queuePODUpload: mockQueuePODUpload,
        syncPendingUploads: mockSyncPendingUploads,
      });
    });

    it('should show offline badge when offline', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should queue upload when offline', async () => {
      mockQueuePODUpload.mockResolvedValueOnce(true);

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      // Find the upload button
      const buttons = screen.getAllByTestId('button');
      const uploadButton = buttons.find(
        btn => btn.textContent?.includes('Upload') && btn.getAttribute('data-variant') !== 'outline'
      );
      fireEvent.click(uploadButton!);

      await waitFor(() => {
        expect(mockQueuePODUpload).toHaveBeenCalledWith(
          'delivery-123',
          'ORDER-456',
          expect.any(File),
          expect.any(String),
          expect.objectContaining({
            compressionApplied: true,
          })
        );
      });
    });

    it('should show queued state after queueing', async () => {
      mockQueuePODUpload.mockResolvedValueOnce(true);

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeInTheDocument();
      });

      // Find the upload button
      const buttons = screen.getAllByTestId('button');
      const uploadButton = buttons.find(
        btn => btn.textContent?.includes('Upload') && btn.getAttribute('data-variant') !== 'outline'
      );
      fireEvent.click(uploadButton!);

      await waitFor(() => {
        expect(screen.getByText('Photo Queued')).toBeInTheDocument();
        expect(screen.getByText('Will upload automatically when back online')).toBeInTheDocument();
      });
    });

    it('should show pending uploads count', () => {
      usePODOfflineQueue.mockReturnValue({
        offlineStatus: { isOnline: true, pendingUploads: 3 },
        queuePODUpload: mockQueuePODUpload,
        syncPendingUploads: mockSyncPendingUploads,
      });

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      expect(screen.getByText('3 pending')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message', async () => {
      compressImage.mockRejectedValueOnce(new Error('Test error'));

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
    });

    it('should show Try Again button in error state', async () => {
      compressImage.mockRejectedValueOnce(new Error('Test error'));

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should reset state when Try Again is clicked', async () => {
      compressImage.mockRejectedValueOnce(new Error('Test error'));

      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByText('Try Again').closest('button');
      fireEvent.click(tryAgainButton!);

      expect(screen.getByText('Take a Photo')).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when close button is clicked', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      // Find the button containing the X icon
      const buttons = screen.getAllByTestId('button');
      const closeButton = buttons.find(btn => btn.querySelector('[data-testid="x-icon"]'));

      fireEvent.click(closeButton!);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when Skip Photo is clicked', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} isRequired={false} />);

      const skipButton = screen.getByText('Skip Photo').closest('button');
      fireEvent.click(skipButton!);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should revoke preview URL on unmount', async () => {
      const { unmount } = render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(input!, { target: { files: [file] } });

      await waitFor(() => {
        expect(createImagePreviewUrl).toHaveBeenCalled();
      });

      unmount();

      expect(revokeImagePreviewUrl).toHaveBeenCalled();
    });
  });

  describe('File Input', () => {
    it('should have correct file input attributes', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', 'image/*');
      expect(input).toHaveAttribute('capture', 'environment');
      expect(input).toHaveAttribute('aria-label', 'Capture photo');
      expect(input).toHaveClass('hidden');
    });

    it('should reset input value after file selection', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should handle empty file selection', async () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      fireEvent.change(input!, { target: { files: [] } });

      // Should remain in idle state
      expect(screen.getByText('Take a Photo')).toBeInTheDocument();
      expect(compressImage).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for file input', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('aria-label', 'Capture photo');
    });

    it('should have accessible button text', () => {
      render(<ProofOfDeliveryCapture {...defaultProps} />);

      const takePhotoButton = screen.getByText('Take Photo');
      expect(takePhotoButton).toBeInTheDocument();
    });
  });
});
