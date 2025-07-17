// app/api/storage/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '@/utils/file-service';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';

export async function DELETE(request: NextRequest) {
  try {
    // Use standardized authentication
    const authResult = await withAuth(request, {
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const { context } = authResult;
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('key');
    const bucketName = searchParams.get('bucket');

    if (!fileKey || !bucketName) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'File key and bucket name are required' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Implement proper file ownership check
    const isAdmin = context.isAdmin || context.isSuperAdmin || context.isHelpdesk;

    // For non-admin users, verify they own the file or it's associated with their entities
    if (!isAdmin) {
      // Check if file belongs to user's orders, applications, or profile
      const userFiles = await prisma.$queryRaw`
        SELECT 1 FROM (
          -- Check catering orders
          SELECT co.user_id FROM catering_orders co 
          JOIN json_array_elements(co.attachments::json) AS att(value) ON att.value->>'key' = ${fileKey}
          WHERE co.user_id = ${user.id}
          
          UNION
          
          -- Check on-demand orders  
          SELECT odo.user_id FROM on_demand_orders odo
          JOIN json_array_elements(odo.attachments::json) AS att(value) ON att.value->>'key' = ${fileKey}
          WHERE odo.user_id = ${user.id}
          
          UNION
          
          -- Check job applications
          SELECT ja.user_id FROM job_applications ja
          WHERE (ja.resume_file->>'key' = ${fileKey} OR ja.cover_letter_file->>'key' = ${fileKey})
          AND ja.user_id = ${user.id}
        ) AS user_files
        LIMIT 1
      `;

      if (!userFiles || (Array.isArray(userFiles) && userFiles.length === 0)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not have permission to delete this file' },
          { status: 403 }
        );
      }
    }

    // Delete the file
    await deleteFile(fileKey, bucketName);

    return NextResponse.json({
      message: 'File deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}