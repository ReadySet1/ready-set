/**
 * Admin-editable driver-tracking settings.
 *
 * GET  — any authenticated tracking participant (drivers read the geofence
 *        radius and GPS throttle client-side).
 * PUT  — ADMIN / SUPER_ADMIN only; validated, audited, upserts the singleton
 *        row (id = 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  getTrackingSettings,
  invalidateTrackingSettingsCache,
} from '@/services/tracking/tracking-settings';
import {
  TrackingSettingsSchema,
  type TrackingSettings,
} from '@/types/tracking-settings';

export async function GET(request: NextRequest) {
  const authResult = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
    requireAuth: true,
  });
  if (!authResult.success) {
    return authResult.response;
  }

  const settings = await getTrackingSettings();
  return NextResponse.json({
    success: true,
    data: settings,
    timestamp: new Date().toISOString(),
  });
}

function computeSettingsChanges(
  previous: TrackingSettings,
  next: TrackingSettings,
): Record<string, { from: number; to: number }> {
  const changes: Record<string, { from: number; to: number }> = {};
  for (const key of Object.keys(next) as Array<keyof TrackingSettings>) {
    if (previous[key] !== next[key]) {
      changes[key] = { from: previous[key], to: next[key] };
    }
  }
  return changes;
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
      requireAuth: true,
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const { user } = authResult.context;

    const body = await request.json().catch(() => null);
    const parsed = TrackingSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tracking settings',
          issues: parsed.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const previous = await getTrackingSettings();

    const saved = await prisma.trackingSettings.upsert({
      where: { id: 1 },
      update: { ...parsed.data, updatedBy: user.id },
      create: { id: 1, ...parsed.data, updatedBy: user.id },
    });

    invalidateTrackingSettingsCache();

    const changes = computeSettingsChanges(previous, parsed.data);
    const auditEntry = {
      action: 'tracking-settings-update',
      userId: user.id,
      userEmail: user.email,
      changedFields: Object.keys(changes),
      changes,
      timestamp: new Date().toISOString(),
    };
    console.log('[AUDIT] Tracking settings change:', JSON.stringify(auditEntry));
    Sentry.addBreadcrumb({
      category: 'tracking-settings-audit',
      message: `Tracking settings updated by ${user.email}`,
      level: 'info',
      data: auditEntry,
    });

    return NextResponse.json({
      success: true,
      data: parsed.data,
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating tracking settings:', error);
    Sentry.captureException(error, { tags: { component: 'tracking-settings' } });
    return NextResponse.json(
      { success: false, error: 'Failed to update tracking settings' },
      { status: 500 },
    );
  }
}
