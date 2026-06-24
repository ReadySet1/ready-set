import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { uploadPickupSignatureImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';

/**
 * POST - Upload a pickup-stage signature for an order.
 *
 * Mirrors the POD route (`../pod/route.ts`): a manual capture of the restaurant
 * staff member's signature when the driver picks up the food (NOT DocuSign).
 * Creates a FileUpload (category = 'pickup_signature') linked to the catering /
 * on-demand order, then mirrors the URL onto the standalone `deliveries` row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  try {
    const { order_number: encodedOrderNumber } = await params;
    const orderNumber = decodeURIComponent(encodedOrderNumber);

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    // Replace any existing pickup signature for this order
    await prisma.fileUpload.deleteMany({
      where: {
        category: 'pickup_signature',
        ...(orderType === 'catering'
          ? { cateringRequestId: orderId }
          : { onDemandId: orderId }),
      },
    });

    // Create FileUpload record (the canonical store)
    const fileUpload = await prisma.fileUpload.create({
      data: {
        userId: user.id,
        fileName: file.name || 'pickup-signature.png',
        fileType: file.type,
        fileSize: file.size,
        fileUrl: uploadResult.url,
        filePath: uploadResult.path,
        category: 'pickup_signature',
        isTemporary: false,
        ...(orderType === 'catering'
          ? { cateringRequestId: orderId }
          : { onDemandId: orderId }),
      },
    });

    // Mirror the signature URL onto the standalone `deliveries` row so the admin
    // tracking surface (which reads pickup_signature_url) sees it too. Non-fatal:
    // a missing deliveries row (created on the first stage advance) must not fail
    // the capture — the FileUpload above is the source of truth.
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE deliveries
           SET pickup_signature_url = $1, updated_at = NOW()
         WHERE LOWER(order_number) = LOWER($2) AND deleted_at IS NULL`,
        uploadResult.url,
        orderNumber,
      );
    } catch (mirrorErr) {
      Sentry.captureException(mirrorErr, {
        tags: { operation: 'pickup_signature_mirror_deliveries', route: 'orders' },
        extra: { orderNumber },
      });
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
      fileUploadId: fileUpload.id,
      message: 'Pickup signature uploaded successfully',
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
