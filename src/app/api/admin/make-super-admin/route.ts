import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET;

export async function POST(request: Request) {
  try {
    // Fail fast if SUPER_ADMIN_SECRET is not configured
    if (!SUPER_ADMIN_SECRET) {
      console.warn('⚠️ SUPER_ADMIN_SECRET is not set — make-super-admin endpoint is disabled');
      return NextResponse.json(
        { error: 'Service unavailable — SUPER_ADMIN_SECRET is not configured' },
        { status: 503 }
      );
    }

    // Check if Prisma client is properly initialized
    if (!prisma || typeof prisma.profile === 'undefined') {
      console.error('❌ Prisma client not properly initialized');
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    const { email, secret } = await request.json();

    // Validate secret key
    if (secret !== SUPER_ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update user to super admin
    const updatedUser = await prisma.profile.update({
      where: { email },
      data: { type: 'SUPER_ADMIN' },
    });

    return NextResponse.json({
      success: true,
      message: 'User has been made super admin',
      user: {
        email: updatedUser.email,
        type: updatedUser.type,
      },
    });
  } catch (error) {
    console.error('Error making user super admin:', error);
    return NextResponse.json(
      { error: 'Failed to make user super admin' },
      { status: 500 }
    );
  }
} 