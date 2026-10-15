import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/request-user';
import { prisma } from '@/utils/prismaDB';
import { deletePODImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';
import { handleStagePhotoUpload } from './stage-photo-upload';

/**
 * POST - Upload a Proof of Delivery photo for an order
 *
 * Creates a FileUpload record linked to either a CateringRequest or OnDemand
 * order with category='proof_of_delivery' and mirrors the URL onto the
 * `deliveries` row. The handler is shared with the pickup-photo route; see
 * ./stage-photo-upload.ts.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ order_number: string }> }
) {
  return handleStagePhotoUpload(request, context, 'delivery');
}

/**
 * GET - Get the Proof of Delivery photo URL for an order
 */
export async function GET(
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

    // Find the order and its POD
    let fileUpload = null;

    // Try catering request first
    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        fileUploads: {
          where: { category: 'proof_of_delivery' },
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (cateringRequest) {
      fileUpload = cateringRequest.fileUploads[0] || null;
    } else {
      // Try on-demand order
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          deletedAt: null,
        },
        include: {
          fileUploads: {
            where: { category: 'proof_of_delivery' },
            orderBy: { uploadedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (onDemandOrder) {
        fileUpload = onDemandOrder.fileUploads[0] || null;
      }
    }

    if (!cateringRequest && !fileUpload) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!fileUpload) {
      return NextResponse.json({
        success: true,
        hasPhoto: false,
        url: null,
      });
    }

    return NextResponse.json({
      success: true,
      hasPhoto: true,
      url: fileUpload.fileUrl,
      uploadedAt: fileUpload.uploadedAt,
      fileUploadId: fileUpload.id,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_fetch', route: 'orders' },
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
 * DELETE - Remove a Proof of Delivery photo from an order
 */
export async function DELETE(
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

    // Get user profile to check role - only ADMIN or SUPER_ADMIN can delete
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true },
    });

    if (!userProfile || !['ADMIN', 'SUPER_ADMIN'].includes(userProfile.type)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Find the POD file upload
    let fileUpload = null;

    // Try catering request first
    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        fileUploads: {
          where: { category: 'proof_of_delivery' },
          take: 1,
        },
      },
    });

    if (cateringRequest) {
      fileUpload = cateringRequest.fileUploads[0] || null;
    } else {
      // Try on-demand order
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          deletedAt: null,
        },
        include: {
          fileUploads: {
            where: { category: 'proof_of_delivery' },
            take: 1,
          },
        },
      });

      if (onDemandOrder) {
        fileUpload = onDemandOrder.fileUploads[0] || null;
      }
    }

    if (!fileUpload) {
      return NextResponse.json(
        { success: false, error: 'No proof of delivery photo found' },
        { status: 404 }
      );
    }

    // Delete from storage if we have the path
    if (fileUpload.filePath) {
      const deleteResult = await deletePODImage(fileUpload.filePath);
      if (deleteResult.error) {
        Sentry.captureMessage('Failed to delete POD from storage', {
          level: 'warning',
          tags: { operation: 'pod_delete_storage', route: 'orders' },
          extra: { error: deleteResult.error },
        });
        // Continue anyway to delete the database record
      }
    }

    // Delete the FileUpload record
    await prisma.fileUpload.delete({
      where: { id: fileUpload.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Proof of delivery deleted successfully',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_delete', route: 'orders' },
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
