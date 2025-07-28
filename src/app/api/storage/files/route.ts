// app/api/storage/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFilesForEntity } from '@/utils/file-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/utils/prismaDB';
import { UserType } from '@/types/prisma';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in to view files' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Entity type and ID are required' },
        { status: 400 }
      );
    }

    // SECURITY FIX: Implement proper permission check
    // Check if user has permission to access this entity's files
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user profile to check admin status
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    const isAdmin = userProfile?.type === UserType.ADMIN || 
                   userProfile?.type === UserType.SUPER_ADMIN || 
                   userProfile?.type === UserType.HELPDESK;

    // Check if user has permission to access this entity
    let hasPermission = false;

    if (isAdmin) {
      // Admins can access all files
      hasPermission = true;
    } else {
      // Regular users can only access their own files
      // Check if the entity belongs to the user
      switch (entityType.toLowerCase()) {
        case 'user':
        case 'profile':
          hasPermission = entityId === user.id;
          break;
        case 'catering':
        case 'order':
          // Check if the order belongs to the user
          const order = await prisma.cateringRequest.findFirst({
            where: { 
              id: entityId,
              userId: user.id 
            },
            select: { id: true }
          });
          hasPermission = !!order;
          break;
        case 'on_demand':
        case 'ondemand':
          // Check if the on-demand order belongs to the user
          const onDemandOrder = await prisma.onDemand.findFirst({
            where: { 
              id: entityId,
              userId: user.id 
            },
            select: { id: true }
          });
          hasPermission = !!onDemandOrder;
          break;
        default:
          // For unknown entity types, deny access unless admin
          hasPermission = false;
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to access these files' },
        { status: 403 }
      );
    }

    // Get files for the entity
    const files = await getFilesForEntity(entityType, entityId);
    
    return NextResponse.json({
      files
    });
  } catch (error: any) {
    console.error('Error getting files:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// Helper function to check if a user is an admin - commented out for now
// since we're not using it and it has type issues
/*
async function checkIfUserIsAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    // This would need proper typing based on your database schema
    const { data, error } = await supabase.rpc('is_admin_user', { user_id: userId });
    return data || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
*/