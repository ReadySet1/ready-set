'use client';

import { useState, useCallback, useEffect } from 'react';
import { CameraPermissionState } from '@/types/proof-of-delivery';

interface UseCameraPermissionResult {
  permission: CameraPermissionState;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  checkPermission: () => Promise<CameraPermissionState>;
  isCameraSupported: boolean;
}

/**
 * Hook for managing camera permissions
 * Handles the complexity of browser camera access across different platforms
 *
 * @returns Object with permission state and methods to request/check permissions
 */
export function useCameraPermission(): UseCameraPermissionResult {
  const [permission, setPermission] = useState<CameraPermissionState>('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraSupported, setIsCameraSupported] = useState(true);

  /**
   * Check if the browser supports camera access
   */
  const checkCameraSupport = useCallback((): boolean => {
    // Check for mediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    return true;
  }, []);

  /**
   * Check the current permission state without requesting
   */
  const checkPermission = useCallback(async (): Promise<CameraPermissionState> => {
    // Check camera support first
    if (!checkCameraSupport()) {
      setIsCameraSupported(false);
      setPermission('unavailable');
      return 'unavailable';
    }

    try {
      // Try using the Permissions API if available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          // Note: 'camera' permission may not be supported in all browsers
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const state = mapPermissionState(result.state);
          setPermission(state);
          return state;
        } catch {
          // Permissions API not supported for camera, fall through to default
        }
      }

      // Default to 'prompt' if we can't determine the state
      setPermission('prompt');
      return 'prompt';
    } catch (err) {
      // Error checking permissions, assume prompt
      setPermission('prompt');
      return 'prompt';
    }
  }, [checkCameraSupport]);

  /**
   * Request camera permission by attempting to access the camera
   * This will trigger the browser's permission dialog
   *
   * @returns true if permission was granted, false otherwise
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Check support first
    if (!checkCameraSupport()) {
      setIsCameraSupported(false);
      setPermission('unavailable');
      setError('Camera is not supported on this device or browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request camera access with environment-facing camera preferred
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Back camera preferred
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Successfully got access - stop the stream immediately
      // We just needed to trigger the permission dialog
      stream.getTracks().forEach((track) => track.stop());

      setPermission('granted');
      setIsLoading(false);
      return true;
    } catch (err) {
      setIsLoading(false);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermission('denied');
          setError('Camera permission was denied. Please enable camera access in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setPermission('unavailable');
          setError('No camera found on this device.');
          setIsCameraSupported(false);
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setPermission('unavailable');
          setError('Camera is in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
          // Requested camera settings not available, try again with basic settings
          try {
            const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
            basicStream.getTracks().forEach((track) => track.stop());
            setPermission('granted');
            return true;
          } catch {
            setPermission('denied');
            setError('Unable to access camera with current settings.');
          }
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred while accessing the camera.');
      }

      return false;
    }
  }, [checkCameraSupport]);

  /**
   * Map browser permission state to our state type
   */
  const mapPermissionState = (state: PermissionState): CameraPermissionState => {
    switch (state) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'prompt':
      default:
        return 'prompt';
    }
  };

  // Check camera support on mount
  useEffect(() => {
    const supported = checkCameraSupport();
    setIsCameraSupported(supported);
    if (!supported) {
      setPermission('unavailable');
    }
  }, [checkCameraSupport]);

  // Listen for permission changes
  useEffect(() => {
    if (!navigator.permissions || !navigator.permissions.query) {
      return;
    }

    let permissionStatus: PermissionStatus | null = null;

    const setupPermissionListener = async () => {
      try {
        permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });

        const handleChange = () => {
          if (permissionStatus) {
            setPermission(mapPermissionState(permissionStatus.state));
          }
        };

        permissionStatus.addEventListener('change', handleChange);

        return () => {
          permissionStatus?.removeEventListener('change', handleChange);
        };
      } catch {
        // Permissions API not fully supported, ignore
      }
    };

    setupPermissionListener();

    return () => {
      // Cleanup will be handled by the async function
    };
  }, []);

  return {
    permission,
    isLoading,
    error,
    requestPermission,
    checkPermission,
    isCameraSupported,
  };
}

/**
 * Helper to check if we're on a mobile device
 * Useful for determining camera capture behavior
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Helper to check if we're on iOS
 * iOS has specific camera capture requirements
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
