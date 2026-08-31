import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/request-user';
import { prisma } from '@/utils/prismaDB';
import { uploadPickupSignatureImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';

/**
 * POST - Record the pickup confirmation for an order.
 *
 * Policy since 2026-07-09 (live-drive feedback): the NAME of the vendor-side
 * person who handed over / confirmed the order is REQUIRED (`receivedBy` form
 * field); the signature image (`file`) is OPTIONAL. When a signature is
 * provided it is stored as a FileUpload (category = 'pickup_signature') exactly
 * as before. The receiver name (and signature URL, when present) are persisted
 * on the standalone `deliveries` row — the orders PATCH gate accepts either
 * artifact before allowing PICKED_UP.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
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

    // Only DRIVER, ADMIN, or SUPER_ADMIN can capture a pickup signature
    const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(userProfile.type)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Find the order (try catering first, then on-demand). The delivery street
    // is selected for the deliveries upsert's create branch (NOT NULL column).
    let orderId: string | null = null;
    let orderType: 'catering' | 'on_demand' | null = null;
    let dbOrderNumber: string | null = null;
    let deliveryStreet: string | null = null;

    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryAddress: { select: { street1: true } },
      },
    });

    if (cateringRequest) {
      orderId = cateringRequest.id;
      orderType = 'catering';
      dbOrderNumber = cateringRequest.orderNumber;
      deliveryStreet = cateringRequest.deliveryAddress?.street1 ?? null;
    } else {
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          deletedAt: null,
        },
        select: {
          id: true,
          orderNumber: true,
          deliveryAddress: { select: { street1: true } },
        },
      });

      if (onDemandOrder) {
        orderId = onDemandOrder.id;
        orderType = 'on_demand';
        dbOrderNumber = onDemandOrder.orderNumber;
        deliveryStreet = onDemandOrder.deliveryAddress?.street1 ?? null;
      }
    }

    if (!orderId || !orderType || !dbOrderNumber) {
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

    // Parse form data: `receivedBy` is required, the signature file is optional.
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const receivedByRaw = formData.get('receivedBy');
    const receivedBy =
      typeof receivedByRaw === 'string' ? receivedByRaw.trim() : '';

    if (!receivedBy) {
      return NextResponse.json(
        { success: false, error: 'Enter the name of the person who handed over the order.' },
        { status: 400 }
      );
    }
    if (receivedBy.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Receiver name is too long (max 255 characters).' },
        { status: 400 }
      );
    }

    let signatureUrl: string | null = null;
    let signaturePath: string | null = null;
    let fileUploadId: string | null = null;

    if (file) {
      // Validate file type (signature pad exports PNG)
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid file type. Only PNG, JPEG, and WebP images are allowed.',
          },
          { status: 400 }
        );
      }

      // Validate file size (max 2MB — a signature PNG is tiny)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: 'File too large. Maximum size is 2MB.' },
          { status: 400 }
        );
      }

      // Upload to Supabase Storage
      const uploadResult = await uploadPickupSignatureImage(file, orderId);

      if (uploadResult.error) {
        return NextResponse.json(
          { success: false, error: uploadResult.error },
          { status: 500 }
        );
      }
      signatureUrl = uploadResult.url;
      signaturePath = uploadResult.path ?? null;

      // Replace any existing pickup signature for this order
      await prisma.fileUpload.deleteMany({
        where: {
          category: 'pickup_signature',
          ...(orderType === 'catering'
            ? { cateringRequestId: orderId }
            : { onDemandId: orderId }),
        },
      });

      // Create FileUpload record (the canonical store for the image)
      const fileUpload = await prisma.fileUpload.create({
        data: {
          userId: user.id,
          fileName: file.name || 'pickup-signature.png',
          fileType: file.type,
          fileSize: file.size,
          fileUrl: signatureUrl,
          filePath: signaturePath,
          category: 'pickup_signature',
          isTemporary: false,
          ...(orderType === 'catering'
            ? { cateringRequestId: orderId }
            : { onDemandId: orderId }),
        },
      });
      fileUploadId = fileUpload.id;
    }

    // Persist the receiver name (and signature URL, when present) on the
    // standalone `deliveries` row — the orders PATCH gate reads
    // pickup_received_by from here before allowing PICKED_UP. Upsert because
    // the row normally appears on the first status advance but may not exist
    // yet. When no signature was stored, this write IS the gating artifact, so
    // a failure here must surface to the driver (they'd otherwise hit an
    // unexplainable 422 at pickup); with a signature stored the gate passes via
    // file_uploads, so the mirror stays non-fatal.
    try {
      await prisma.delivery.upsert({
        where: { orderNumber: dbOrderNumber },
        update: {
          pickupReceivedBy: receivedBy,
          ...(signatureUrl ? { pickupSignatureUrl: signatureUrl } : {}),
        },
        create: {
          orderNumber: dbOrderNumber,
          deliveryAddress: deliveryStreet ?? '',
          pickupReceivedBy: receivedBy,
          ...(signatureUrl ? { pickupSignatureUrl: signatureUrl } : {}),
        },
      });
    } catch (mirrorErr) {
      Sentry.captureException(mirrorErr, {
        tags: { operation: 'pickup_confirmation_deliveries_upsert', route: 'orders' },
        extra: { orderNumber, hasSignature: !!signatureUrl },
      });
      if (!signatureUrl) {
        return NextResponse.json(
          { success: false, error: 'Failed to record the pickup confirmation. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      receivedBy,
      url: signatureUrl,
      path: signaturePath,
      fileUploadId,
      message: signatureUrl
        ? 'Pickup confirmed with signature'
        : 'Pickup confirmed',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pickup_signature_upload', route: 'orders' },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload pickup signature',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
