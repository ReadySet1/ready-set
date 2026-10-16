import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/request-user';
import { prisma } from '@/utils/prismaDB';
import { uploadPODImage } from '@/utils/supabase/storage';
import {
  POD_MAX_UPLOAD_SIZE_BYTES,
  POD_MAX_UPLOAD_SIZE_MB,
} from '@/types/proof-of-delivery';
import { DELIVERY_PHOTO_CATEGORY, PICKUP_PHOTO_CATEGORY } from '@/lib/driver/stage-photos';
import * as Sentry from '@sentry/nextjs';

/**
 * Shared POST handler for the two mandatory stage photos:
 *
 *   - `delivery` → POST /api/orders/[order_number]/pod
 *     (photo of the setup at completion, category 'proof_of_delivery',
 *     mirrored onto `deliveries.delivery_photo_url` for the admin surfaces)
 *   - `pickup`   → POST /api/orders/[order_number]/pickup-photo
 *     (photo of the order at the vendor, category 'pickup_photo'; no mirror —
 *     the deliveries row has no column for it)
 *
 * Both create a FileUpload row linked to the CateringRequest or OnDemand
 * order; that row is what the orders PATCH gate reads before allowing
 * PICKED_UP / COMPLETED.
 */
export type StagePhoto = 'delivery' | 'pickup';

const STAGE_CONFIG: Record<
  StagePhoto,
  { category: string; label: string; sentryOp: string; mirrorToDeliveries: boolean }
> = {
  delivery: {
    category: DELIVERY_PHOTO_CATEGORY,
    label: 'proof of delivery',
    sentryOp: 'pod_upload',
    mirrorToDeliveries: true,
  },
  pickup: {
    category: PICKUP_PHOTO_CATEGORY,
    label: 'pickup photo',
    sentryOp: 'pickup_photo_upload',
    mirrorToDeliveries: false,
  },
};

export async function handleStagePhotoUpload(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> },
  stage: StagePhoto,
) {
  const config = STAGE_CONFIG[stage];
  try {
    const { order_number: encodedOrderNumber } = await params;
    const orderNumber = decodeURIComponent(encodedOrderNumber);

    // Authenticate user (Bearer token first, cookie session fallback)
    const user = await getRequestUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile to check role
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, type: true },
    });

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Only DRIVER, ADMIN, or SUPER_ADMIN can upload stage photos
    const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(userProfile.type)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Find the order (try catering first, then on-demand)
    let orderId: string | null = null;
    let orderType: 'catering' | 'on_demand' | null = null;

    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true, orderNumber: true },
    });

    if (cateringRequest) {
      orderId = cateringRequest.id;
      orderType = 'catering';
    } else {
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true, orderNumber: true },
      });

      if (onDemandOrder) {
        orderId = onDemandOrder.id;
        orderType = 'on_demand';
      }
    }

    if (!orderId || !orderType) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // If user is DRIVER, verify they are assigned to this order
    if (userProfile.type === 'DRIVER') {
      const dispatch = await prisma.dispatch.findFirst({
        where: {
          driverId: user.id,
          ...(orderType === 'catering'
            ? { cateringRequestId: orderId }
            : { onDemandId: orderId }),
        },
      });

      if (!dispatch) {
        return NextResponse.json(
          { success: false, error: 'Access denied - not assigned to this order' },
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

    // Validate file size — shared cap (client compresses well under this, but
    // compression is best-effort so the server allows generous headroom).
    if (file.size > POD_MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${POD_MAX_UPLOAD_SIZE_MB}MB.`,
        },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadPODImage(file, orderId, { stage });

    if (uploadResult.error) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      );
    }

    // Delete any existing FileUpload of this category for this order
    await prisma.fileUpload.deleteMany({
      where: {
        category: config.category,
        ...(orderType === 'catering'
          ? { cateringRequestId: orderId }
          : { onDemandId: orderId }),
      },
    });

    // Create FileUpload record
    const fileUpload = await prisma.fileUpload.create({
      data: {
        userId: user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: uploadResult.url,
        filePath: uploadResult.path,
        category: config.category,
        isTemporary: false,
        ...(orderType === 'catering'
          ? { cateringRequestId: orderId }
          : { onDemandId: orderId }),
      },
    });

    // Mirror the photo URL onto the standalone `deliveries` row so the admin
    // tracking map + POD gallery (which read delivery_photo_url) see it too.
    // The driver-facing source of truth is the FileUpload above; this keeps the
    // two stores in sync. No-op if no deliveries row exists yet (it is created
    // by the orders status PATCH on the first stage advance). Non-fatal.
    if (config.mirrorToDeliveries) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE deliveries
             SET delivery_photo_url = $1, updated_at = NOW()
           WHERE LOWER(order_number) = LOWER($2) AND deleted_at IS NULL`,
          uploadResult.url,
          orderNumber,
        );
      } catch (mirrorErr) {
        Sentry.captureException(mirrorErr, {
          tags: { operation: 'pod_mirror_deliveries', route: 'orders' },
          extra: { orderNumber },
        });
      }
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
      fileUploadId: fileUpload.id,
      message: `${capitalize(config.label)} uploaded successfully`,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: config.sentryOp, route: 'orders' },
    });
    return NextResponse.json(
      {
        success: false,
        error: `Failed to upload ${config.label}`,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
