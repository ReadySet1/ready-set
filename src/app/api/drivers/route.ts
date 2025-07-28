// app/api/drivers/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Use standardized authentication with role-based access
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const { context } = authResult;

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