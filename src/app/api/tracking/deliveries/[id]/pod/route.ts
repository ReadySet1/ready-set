import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { uploadPODImage, deletePODImage } from '@/utils/supabase/storage';

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
      SELECT d.id, d.proof_of_delivery, dr.user_id
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE d.id = $1
    `;

    const verifyResult = await prisma.$queryRawUnsafe<
      {
        id: string;
        proof_of_delivery: string | null;
        user_id: string | null;
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
    if (
      authResult.context.user.type === 'DRIVER' &&
      delivery.user_id !== authResult.context.user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
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

    // Update the delivery record with the photo URL
    await prisma.$executeRawUnsafe(
      `
      UPDATE deliveries
      SET
        proof_of_delivery = $2,
        metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      deliveryId,
      uploadResult.url,
      JSON.stringify({
        podUploadedAt: new Date().toISOString(),
        podUploadedBy: authResult.context.user.id,
        podStoragePath: uploadResult.path,
      })
    );

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
      message: 'Proof of delivery uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading POD:', error);
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
        d.proof_of_delivery,
        d.metadata,
        dr.user_id
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE d.id = $1
    `;

    const result = await prisma.$queryRawUnsafe<
      {
        id: string;
        proof_of_delivery: string | null;
        metadata: Record<string, unknown> | null;
        user_id: string | null;
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
    if (
      authResult.context.user.type === 'DRIVER' &&
      delivery.user_id !== authResult.context.user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    if (!delivery.proof_of_delivery) {
      return NextResponse.json({
        success: true,
        hasPhoto: false,
        url: null,
      });
    }

    const metadata = delivery.metadata as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      hasPhoto: true,
      url: delivery.proof_of_delivery,
      metadata: {
        uploadedAt: metadata?.podUploadedAt || null,
        storagePath: metadata?.podStoragePath || null,
      },
    });
  } catch (error) {
    console.error('Error fetching POD:', error);
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

    // Get the current POD storage path
    const query = `
      SELECT proof_of_delivery, metadata
      FROM deliveries
      WHERE id = $1
    `;

    const result = await prisma.$queryRawUnsafe<
      {
        proof_of_delivery: string | null;
        metadata: Record<string, unknown> | null;
      }[]
    >(query, deliveryId);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = result[0]!;

    if (!delivery.proof_of_delivery) {
      return NextResponse.json(
        { success: false, error: 'No proof of delivery photo to delete' },
        { status: 400 }
      );
    }

    // Delete from storage if we have the path
    const deliveryMetadata = delivery.metadata as Record<string, unknown> | null;
    const storagePath = deliveryMetadata?.podStoragePath as string | undefined;
    if (storagePath) {
      const deleteResult = await deletePODImage(storagePath);
      if (deleteResult.error) {
        console.warn('Failed to delete POD from storage:', deleteResult.error);
        // Continue anyway to clear the database reference
      }
    }

    // Clear the POD reference in the database
    await prisma.$executeRawUnsafe(
      `
      UPDATE deliveries
      SET
        proof_of_delivery = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      deliveryId,
      JSON.stringify({
        podDeletedAt: new Date().toISOString(),
        podDeletedBy: authResult.context.user.id,
        podStoragePath: null,
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Proof of delivery deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting POD:', error);
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
