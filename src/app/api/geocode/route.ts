import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResult {
  features: Array<{
    center: [number, number]; // [lng, lat]
    place_name: string;
    relevance: number;
  }>;
}

interface GeocodeResponse {
  lat: number;
  lng: number;
  placeName: string;
}

interface GeocodeErrorResponse {
  error: string;
}

/**
 * POST /api/geocode
 * Geocodes an address using Mapbox Geocoding API
 *
 * Body: { address: string }
 * Returns: { lat, lng, placeName } | { error: string }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GeocodeResponse | GeocodeErrorResponse>> {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not configured');
      return NextResponse.json(
        { error: 'Geocoding service not configured' },
        { status: 500 }
      );
    }

    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=US`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Geocoding service error' },
        { status: 502 }
      );
    }

    const data: GeocodingResult = await response.json();

    const feature = data.features?.[0];

    if (!feature) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    const [lng, lat] = feature.center;

    return NextResponse.json({
      lat,
      lng,
      placeName: feature.place_name,
    });
  } catch (error) {
    console.error('Geocode API error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode address' },
      { status: 500 }
    );
  }
}
