import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prismaDB';

// Simplified session endpoint - replace with your actual auth implementation
export async function GET(request: NextRequest) {
  try {
    // Temporary dev session: fetch a real driver UUID to avoid invalid-UUID errors
    const driver = await prisma.$queryRawUnsafe<{ id: string; employee_id: string }[]>(
      `SELECT id, employee_id FROM drivers ORDER BY created_at DESC LIMIT 1`
    );

    const driverId = driver[0]?.id ?? null;

    const session = {
      user: {
        id: 'user-123',
        email: 'driver@readyset.com',
        type: 'DRIVER',
        driverId,
        name: 'John Driver'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}