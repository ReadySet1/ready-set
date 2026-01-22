'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { type Coordinates } from '@/lib/calculator/distance-calculator';

interface GeocodeResponse {
  lat: number;
  lng: number;
  placeName: string;
}

interface GeocodeErrorResponse {
  error: string;
}

interface AddressInputProps {
  label: string;
  placeholder: string;
  onCoordinatesChange: (coords: Coordinates | null) => void;
}

type GeocodeStatus = 'idle' | 'loading' | 'success' | 'error';

export function AddressInput({
  label,
  placeholder,
  onCoordinatesChange,
}: AddressInputProps) {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<GeocodeStatus>('idle');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGeocode = useCallback(async () => {
    if (!address.trim()) {
      setErrorMessage('Please enter an address');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setResolvedAddress(null);

    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: address.trim() }),
      });

      const data: GeocodeResponse | GeocodeErrorResponse = await response.json();

      if (!response.ok || 'error' in data) {
        const errorMsg = 'error' in data ? data.error : 'Failed to geocode address';
        setErrorMessage(errorMsg);
        setStatus('error');
        onCoordinatesChange(null);
        return;
      }

      setResolvedAddress(data.placeName);
      setStatus('success');
      onCoordinatesChange({ lat: data.lat, lng: data.lng });
    } catch (error) {
      setErrorMessage('Failed to geocode address');
      setStatus('error');
      onCoordinatesChange(null);
    }
  }, [address, onCoordinatesChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGeocode();
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    // Reset status when address changes
    if (status !== 'idle' && status !== 'loading') {
      setStatus('idle');
      setResolvedAddress(null);
      setErrorMessage(null);
      onCoordinatesChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-700 font-medium">{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder={placeholder}
            value={address}
            onChange={handleAddressChange}
            onKeyDown={handleKeyDown}
            className="pl-10 h-11"
            disabled={status === 'loading'}
          />
        </div>
        <Button
          type="button"
          onClick={handleGeocode}
          disabled={status === 'loading' || !address.trim()}
          className="h-11 px-4"
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Check'
          )}
        </Button>
      </div>

      {/* Status feedback */}
      {status === 'success' && resolvedAddress && (
        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-md">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="break-words">{resolvedAddress}</span>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
