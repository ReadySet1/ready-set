import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { uploadPODImage, deletePODImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';

/**
 * POST - Upload a Proof of Delivery photo for an order
 *
 * This endpoint creates a FileUpload record linked to either a
 * CateringRequest or OnDemand order with category='proof_of_delivery'
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

    // Only DRIVER, ADMIN, or SUPER_ADMIN can upload POD
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

    // Validate file size (max 2MB - should be compressed client-side)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 2MB.' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const uploadResult = await uploadPODImage(file, orderId);

    if (uploadResult.error) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 500 }
      );
    }

    // Delete any existing POD FileUpload for this order
    await prisma.fileUpload.deleteMany({
      where: {
        category: 'proof_of_delivery',
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
        category: 'proof_of_delivery',
        isTemporary: false,
        ...(orderType === 'catering'
          ? { cateringRequestId: orderId }
          : { onDemandId: orderId }),
      },
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
      fileUploadId: fileUpload.id,
      message: 'Proof of delivery uploaded successfully',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'pod_upload', route: 'orders' },
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
 * GET - Get the Proof of Delivery photo URL for an order
 */
export async function GET(
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

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
