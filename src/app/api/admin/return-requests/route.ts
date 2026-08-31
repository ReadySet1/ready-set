import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import * as Sentry from '@sentry/nextjs';
import type { ReturnRequestStatus } from '@prisma/client';

/**
 * GET - List driver return-to-dispatch requests for the helpdesk panel.
 *
 * Query params:
 * - status: PENDING (default) | APPROVED | REJECTED | VOIDED
 *
 * Returns the order + driver context the panel needs (orderNumber, driver
 * name, reason, details, requestedAt). ADMIN / SUPER_ADMIN / HELPDESK only.
 */

const VALID_STATUSES: ReturnRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'VOIDED',
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get('status') ?? 'PENDING').toUpperCase();
    if (!VALID_STATUSES.includes(statusParam as ReturnRequestStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status filter: ${statusParam}` },
        { status: 400 },
      );
    }
    const status = statusParam as ReturnRequestStatus;

    const requests = await prisma.deliveryReturnRequest.findMany({
      where: { status },
      orderBy: { requestedAt: 'asc' },
      take: 100,
    });

    // Batch-resolve driver names (no Prisma relation on the request model —
    // driverId is a profile id).
    const driverIds = [...new Set(requests.map((r) => r.driverId))];
    const profiles = driverIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: driverIds }, deletedAt: null },
          select: { id: true, name: true, email: true },
        })
      : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    return NextResponse.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        orderType: r.orderType,
        orderId: r.orderId,
        driverId: r.driverId,
        driverName: profileById.get(r.driverId)?.name ?? null,
        driverEmail: profileById.get(r.driverId)?.email ?? null,
        reason: r.reason,
        details: r.details,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        resolutionNotes: r.resolutionNotes,
      })),
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'return_requests_list', route: 'admin' },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to load return requests' },
      { status: 500 },
    );
  }
}
