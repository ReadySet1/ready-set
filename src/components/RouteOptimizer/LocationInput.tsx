'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeocodeSuggestion {
  placeName: string;
  lat: number;
  lng: number;
}

interface LocationInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (address: string) => void;
  onCoordinatesResolved?: (lat: number, lng: number) => void;
  icon?: 'pickup' | 'dropoff' | 'waypoint';
  disabled?: boolean;
  error?: string;
}

const ICON_COLORS = {
  pickup: 'text-emerald-600',
  dropoff: 'text-red-500',
  waypoint: 'text-blue-500',
} as const;

export default function LocationInput({
  label,
  placeholder = 'Enter an address...',
  value,
  onChange,
  onCoordinatesResolved,
  icon = 'waypoint',
  disabled = false,
  error,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const geocodeAddress = useCallback(
    async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!mapboxToken) return;

        const encoded = encodeURIComponent(query.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=5&country=US&types=address,poi`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        const results: GeocodeSuggestion[] = (data.features ?? []).map(
          (f: { place_name: string; center: [number, number] }) => ({
            placeName: f.place_name,
            lng: f.center[0],
            lat: f.center[1],
          }),
        );

        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => geocodeAddress(val), 350);
  };

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    onChange(suggestion.placeName);
    onCoordinatesResolved?.(suggestion.lat, suggestion.lng);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <MapPin className={cn('h-3.5 w-3.5', ICON_COLORS[icon])} />
        {label}
      </Label>

      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pr-10',
            error && 'border-red-400 focus-visible:ring-red-400',
          )}
        />

        {/* Right-side icon: loading spinner, clear button, or nothing */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : value ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-0.5 hover:bg-gray-100"
              aria-label="Clear address"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          ) : null}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Suggestions dropdown */}
      {showDropdown && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s, idx) => (
            <li key={`${s.placeName}-${idx}`}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="line-clamp-2">{s.placeName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
