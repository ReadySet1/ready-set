import { NextRequest, NextResponse } from 'next/server';

// Simplified session endpoint - replace with your actual auth implementation
export async function GET(request: NextRequest) {
  try {
    // Mock session data - replace with actual session validation
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'driver@readyset.com',
        type: 'DRIVER',
        driverId: 'driver-456',
        name: 'John Driver'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return NextResponse.json(mockSession);
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}