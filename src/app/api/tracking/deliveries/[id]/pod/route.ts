import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { uploadPODImage, deletePODImage } from '@/utils/supabase/storage';
import { userOwnsDriver } from '@/lib/auth/driver-ownership';
import * as Sentry from '@sentry/nextjs';

/**
 * POST - Upload a Proof of Delivery photo
 *
 * Accepts multipart form data with:
 * - file: The image file
 * - deliveryId: The delivery UUID (in path)
 *
 * Returns the public URL of the uploaded image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliveryId } = await params;

    // Authenticate - only DRIVER, ADMIN, or SUPER_ADMIN can upload POD
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    // Verify delivery exists and user has permission
    const verifyQuery = `
      SELECT d.id, d.driver_id
      FROM deliveries d
      WHERE d.id = $1
    `;

    const verifyResult = await prisma.$queryRawUnsafe<
      {
        id: string;
        driver_id: string | null;
      }[]
    >(verifyQuery, deliveryId);

    if (verifyResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = verifyResult[0]!;

    // If user is DRIVER, verify they own this delivery
    if (authResult.context.user.type === 'DRIVER') {
      const owns = await userOwnsDriver(delivery.driver_id, authResult.context.user.id);
      if (!owns) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB - should be compressed client-side)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 2MB.' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadPODImage(file, deliveryId);

    if (uploadResult.error) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      );
    }

    // Update the delivery record with the photo URL. NOTE: the `deliveries`
    // table has no `proof_of_delivery`/`metadata` columns — the real column is
    // `delivery_photo_url`. Audit details (uploader, timestamp, storage path)
    // are appended to `delivery_notes`, mirroring uploadProofOfDelivery in
    // src/app/actions/tracking/delivery-actions.ts. The storage path is kept in
    // the note so DELETE can recover it without a metadata column.
    await prisma.$executeRawUnsafe(
      `
      UPDATE deliveries
      SET
        delivery_photo_url = $2,
        delivery_notes = COALESCE(delivery_notes, '') || $3,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      deliveryId,
      uploadResult.url,
      ` [POD photo uploaded ${new Date().toISOString()} by ${authResult.context.user.id} | path:${uploadResult.path}]`
    );

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
      message: 'Proof of delivery uploaded successfully',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_upload', route: 'tracking_deliveries' },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload proof of delivery',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get the Proof of Delivery photo URL for a delivery
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliveryId } = await params;

    // Authenticate
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'CLIENT', 'HELPDESK'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    // Get delivery with POD info
    const query = `
      SELECT
        d.id,
        d.delivery_photo_url,
        d.driver_id
      FROM deliveries d
      WHERE d.id = $1
    `;

    const result = await prisma.$queryRawUnsafe<
      {
        id: string;
        delivery_photo_url: string | null;
        driver_id: string | null;
      }[]
    >(query, deliveryId);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = result[0]!;

    // If user is DRIVER, verify they own this delivery
    if (authResult.context.user.type === 'DRIVER') {
      const owns = await userOwnsDriver(delivery.driver_id, authResult.context.user.id);
      if (!owns) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    if (!delivery.delivery_photo_url) {
      return NextResponse.json({
        success: true,
        hasPhoto: false,
        url: null,
      });
    }

    return NextResponse.json({
      success: true,
      hasPhoto: true,
      url: delivery.delivery_photo_url,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_fetch', route: 'tracking_deliveries' },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch proof of delivery',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove a Proof of Delivery photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deliveryId } = await params;

    // Only ADMIN or SUPER_ADMIN can delete POD photos
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    // Get the current POD URL
    const query = `
      SELECT delivery_photo_url
      FROM deliveries
      WHERE id = $1
    `;

    const result = await prisma.$queryRawUnsafe<
      {
        delivery_photo_url: string | null;
      }[]
    >(query, deliveryId);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = result[0]!;

    if (!delivery.delivery_photo_url) {
      return NextResponse.json(
        { success: false, error: 'No proof of delivery photo to delete' },
        { status: 400 }
      );
    }

    // Delete from storage. Recover the storage path from the public URL
    // (.../delivery-proofs/<path>) since there is no metadata column.
    const storagePath = delivery.delivery_photo_url.split('/delivery-proofs/')[1];
    if (storagePath) {
      const deleteResult = await deletePODImage(storagePath);
      if (deleteResult.error) {
        Sentry.captureMessage('Failed to delete POD from storage', {
          level: 'warning',
          tags: { operation: 'pod_delete_storage', route: 'tracking_deliveries' },
          extra: { error: deleteResult.error },
        });
        // Continue anyway to clear the database reference
      }
    }

    // Clear the POD reference in the database
    await prisma.$executeRawUnsafe(
      `
      UPDATE deliveries
      SET
        delivery_photo_url = NULL,
        delivery_notes = COALESCE(delivery_notes, '') || $2,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      deliveryId,
      ` [POD deleted ${new Date().toISOString()} by ${authResult.context.user.id}]`
    );

    return NextResponse.json({
      success: true,
      message: 'Proof of delivery deleted successfully',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_delete', route: 'tracking_deliveries' },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete proof of delivery',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
