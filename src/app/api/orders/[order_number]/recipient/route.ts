import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { uploadPickupSignatureImage } from '@/utils/supabase/storage';
import { DELIVERY_SIGNATURE_CATEGORY } from '@/lib/driver/stage-photos';

/**
 * POST - Record who received the order at the client (completion stage).
 *
 * Business rule (Gary, 2026-06-01 / 06-22): at completion the driver captures
 * the recipient's signature OR, if the recipient refuses to sign, their name.
 * Form fields: `file` (signature image, optional) and `receivedBy` (name,
 * optional) — at least one is required.
 *
 *   - name      → `deliveries.delivery_received_by`
 *   - signature → FileUpload (category 'delivery_signature'), mirrored onto
 *                 `deliveries.delivery_signature_url`
 *
 * The orders PATCH gate (422 RECIPIENT_REQUIRED) reads those before allowing
 * COMPLETED. Mirrors the pickup confirmation route (../signature).
 */
const ALLOWED_ROLES = ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'];
const ALLOWED_SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  const auth = await withAuth(request, { allowedRoles: ALLOWED_ROLES });
  if (!auth.success) return auth.response!;
  const { user } = auth.context;

  try {
    const { order_number: encodedOrderNumber } = await params;
    const orderNumber = decodeURIComponent(encodedOrderNumber);

    // Find the order (catering first, then on-demand). The delivery street is
    // selected for the deliveries upsert's create branch (NOT NULL column).
    let orderId: string | null = null;
    let orderType: 'catering' | 'on_demand' | null = null;
    let dbOrderNumber: string | null = null;
    let deliveryStreet: string | null = null;

    const orderSelect = {
      id: true,
      orderNumber: true,
      deliveryAddress: { select: { street1: true } },
    } as const;
    const where = {
      orderNumber: { equals: orderNumber, mode: 'insensitive' as const },
      deletedAt: null,
    };

    const cateringRequest = await prisma.cateringRequest.findFirst({ where, select: orderSelect });
    if (cateringRequest) {
      orderId = cateringRequest.id;
      orderType = 'catering';
      dbOrderNumber = cateringRequest.orderNumber;
      deliveryStreet = cateringRequest.deliveryAddress?.street1 ?? null;
    } else {
      const onDemandOrder = await prisma.onDemand.findFirst({ where, select: orderSelect });
      if (onDemandOrder) {
        orderId = onDemandOrder.id;
        orderType = 'on_demand';
        dbOrderNumber = onDemandOrder.orderNumber;
        deliveryStreet = onDemandOrder.deliveryAddress?.street1 ?? null;
      }
    }

    if (!orderId || !orderType || !dbOrderNumber) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderLink =
      orderType === 'catering' ? { cateringRequestId: orderId } : { onDemandId: orderId };

    // A driver may only confirm an order dispatched to them (dispatch.driverId
    // is the driver's profile id, the same id space as the auth user).
    if (user.type === 'DRIVER') {
      const dispatch = await prisma.dispatch.findFirst({
        where: { driverId: user.id, ...orderLink },
        select: { id: true },
      });
      if (!dispatch) {
        return NextResponse.json(
          { success: false, error: 'Access denied - not assigned to this order' },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const file = fileEntry && typeof fileEntry !== 'string' ? (fileEntry as File) : null;
    const receivedByRaw = formData.get('receivedBy');
    const receivedBy = typeof receivedByRaw === 'string' ? receivedByRaw.trim() : '';

    if (!file && !receivedBy) {
      return NextResponse.json(
        {
          success: false,
          error: "Capture the recipient's signature, or enter their name if they refuse to sign.",
        },
        { status: 400 }
      );
    }
    if (receivedBy.length > 255) {
      return NextResponse.json(
        { success: false, error: 'Recipient name is too long (max 255 characters).' },
        { status: 400 }
      );
    }

    let signatureUrl: string | null = null;
    let signaturePath: string | null = null;
    let fileUploadId: string | null = null;

    if (file) {
      if (!ALLOWED_SIGNATURE_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid file type. Only PNG, JPEG, and WebP images are allowed.',
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIGNATURE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'File too large. Maximum size is 2MB.' },
          { status: 400 }
        );
      }

      const uploadResult = await uploadPickupSignatureImage(file, orderId, { stage: 'delivery' });
      if (uploadResult.error) {
        return NextResponse.json({ success: false, error: uploadResult.error }, { status: 500 });
      }
      signatureUrl = uploadResult.url;
      signaturePath = uploadResult.path ?? null;

      // Replace any earlier recipient signature for this order.
      await prisma.fileUpload.deleteMany({
        where: { category: DELIVERY_SIGNATURE_CATEGORY, ...orderLink },
      });
      const fileUpload = await prisma.fileUpload.create({
        data: {
          userId: user.id,
          fileName: file.name || 'delivery-signature.png',
          fileType: file.type,
          fileSize: file.size,
          fileUrl: signatureUrl,
          filePath: signaturePath,
          category: DELIVERY_SIGNATURE_CATEGORY,
          isTemporary: false,
          ...orderLink,
        },
      });
      fileUploadId = fileUpload.id;
    }

    // Persist the name (and signature URL) on the standalone deliveries row.
    // Upsert: the row normally exists by now but may not. Without a signature
    // this write IS the gating artifact, so a failure must surface (the driver
    // would otherwise hit an unexplained 422 at completion); with a signature
    // the gate passes via file_uploads, so the mirror stays non-fatal.
    const deliveryFields = {
      ...(receivedBy ? { deliveryReceivedBy: receivedBy } : {}),
      ...(signatureUrl ? { deliverySignatureUrl: signatureUrl } : {}),
    };
    try {
      await prisma.delivery.upsert({
        where: { orderNumber: dbOrderNumber },
        update: deliveryFields,
        create: {
          orderNumber: dbOrderNumber,
          deliveryAddress: deliveryStreet ?? '',
          ...deliveryFields,
        },
      });
    } catch (mirrorErr) {
      Sentry.captureException(mirrorErr, {
        tags: { operation: 'recipient_confirmation_deliveries_upsert', route: 'orders' },
        extra: { orderNumber, hasSignature: !!signatureUrl },
      });
      if (!signatureUrl) {
        return NextResponse.json(
          { success: false, error: 'Failed to record the recipient. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      receivedBy: receivedBy || null,
      url: signatureUrl,
      path: signaturePath,
      fileUploadId,
      message: 'Recipient recorded',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'recipient_confirmation', route: 'orders' },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to record the recipient' },
      { status: 500 }
    );
  }
}
