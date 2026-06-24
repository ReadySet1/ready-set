/**
 * useVendorQuote — TanStack Query hook for the vendor delivery cost estimator.
 *
 * Calls POST /api/vendor/calculator/quote when a non-null input is provided.
 * Returns customer-safe fields only; never exposes driver pay, margin, or RS fee.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendorQuoteRequest {
  headcount: number;
  foodCost: number;
  totalMileage: number;
  numberOfDrives?: number;
  numberOfStops?: number;
  requiresBridge?: boolean;
}

export interface VendorQuoteResponse {
  deliveryCost: number;
  mileageSurcharge: number;
  multiDriveDiscount: number;
  extraStopsCharge: number;
  bridgeToll: number;
  totalDeliveryFee: number;
  pricingProfileLabel: string;
  isFallbackPricing: boolean;
  requiresCustomQuote: boolean;
}

export interface VendorQuoteError {
  error: string;
  details?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

async function fetchVendorQuote(
  input: VendorQuoteRequest,
  accessToken: string,
): Promise<VendorQuoteResponse> {
  const res = await fetch('/api/vendor/calculator/quote', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as VendorQuoteError;
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<VendorQuoteResponse>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVendorQuote(input: VendorQuoteRequest | null) {
  const { session } = useUser();
  const accessToken = session?.access_token;

  const queryKey = ['vendor-quote', input] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!input || !accessToken) {
        throw new Error('Missing input or auth token');
      }
      return fetchVendorQuote(input, accessToken);
    },
    // Only fire when we have both a valid input and a token
    enabled: input !== null && !!accessToken,
    staleTime: 30_000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
