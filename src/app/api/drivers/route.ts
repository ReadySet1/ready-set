// app/api/drivers/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Use standardized authentication with role-based access
    // Allow CLIENT role as well since they need to see drivers for order management
    // Added DRIVER role as per requirements - drivers should be able to view driver data
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'CLIENT', 'DRIVER'],
      requireAuth: true
    });

    if (!authResult.success) {
      console.error('Driver API access denied:', authResult.response);
      console.error('❌ [Driver API] Access denied for user role:', {
        status: authResult.response?.status,
        error: 'Insufficient permissions'
      });
      return authResult.response;
    }

    const { context } = authResult;
    console.log('✅ [Driver API] Access granted to user:', {
      role: context.user?.type,
      email: context.user?.email,
      id: context.user?.id
    });

    // Fetch all drivers - only authorized personnel can see this sensitive data
    const drivers = await prisma.profile.findMany({
      where: {
        type: 'DRIVER'
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return NextResponse.json(
      { error: "Failed to fetch drivers" },
      { status: 500 }
    );
  }
}