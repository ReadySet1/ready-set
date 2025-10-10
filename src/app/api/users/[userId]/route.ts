// src/app/api/users/[userId]/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET: Fetch a user by ID, with authorization.
 * - Allows users to fetch their own profile.
 * - Allows admin/super_admin to fetch any profile.
 * - Returns all fields expected by UserFormValues.
 * - Returns 404 if not found, 403 if forbidden.
 */
import { prisma } from '@/utils/prismaDB';
import { Prisma } from '@prisma/client';
import { UserType } from '@/types/prisma';
import { PrismaTransaction } from '@/types/prisma-types';

export async function GET(request: NextRequest) {
  try {
    // Get userId from URL path
    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop();
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // SECURITY FIX: Remove dangerous admin panel bypass
    // All requests must go through proper authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[GET /api/users/[userId]] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    

    // Check permissions for all requests
    let requesterProfile;
    let isAdminOrHelpdesk = false;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      
      isAdminOrHelpdesk =
        requesterProfile?.type === UserType.ADMIN ||
        requesterProfile?.type === UserType.SUPER_ADMIN ||
        requesterProfile?.type === UserType.HELPDESK;
        
      // Only allow if requesting own profile or admin/super_admin
      const isSelf = user.id === userId;


      if (!isSelf && !isAdminOrHelpdesk) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[GET /api/users/[userId]] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }

    // Fetch the target user profile
    let profile;
    try {
      profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumber: true,
          type: true,
          companyName: true,
          website: true,
          street1: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          locationNumber: true,
          parkingLoading: true,
          counties: true,
          timeNeeded: true,
          cateringBrokerage: true,
          provide: true,
          frequency: true,
          headCount: true,
          status: true,
          contactName: true,
        }
      });
    } catch (targetProfileError) {
      console.error(`[GET /api/users/[userId]] Error fetching target profile (ID: ${userId}):`, targetProfileError);
      return NextResponse.json({ error: 'Failed to fetch target user profile' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    
    // Helper to parse comma-separated strings, potentially with extra quotes
    const parseCommaSeparatedString = (value: unknown): string[] => {
      // Ensure the input is a string before processing
      if (typeof value !== 'string' || !value) return [];
      
      // Remove leading/trailing quotes if present (e.g., ""value1, value2"" -> "value1, value2")
      const cleanedStr = value.replace(/^""|""$/g, '');
      return cleanedStr.split(',').map(s => s.trim()).filter(s => s !== ''); // Filter out empty strings
    };

    // Transform the response to match frontend expectations (snake_case)
    const transformedProfile = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      contact_number: profile.contactNumber,
      company_name: profile.companyName,
      website: profile.website,
      street1: profile.street1,
      street2: profile.street2,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      type: profile.type,
      status: profile.status,
      location_number: profile.locationNumber,
      parking_loading: profile.parkingLoading,
      contact_name: profile.contactName,
      counties: profile.counties,
      timeNeeded: profile.timeNeeded,
      cateringBrokerage: profile.cateringBrokerage,
      provide: profile.provide,
      frequency: profile.frequency,
      headCount: profile.headCount,
      // Use the helper function to parse counties and provisions
      countiesServed: parseCommaSeparatedString(profile.counties),
      provisions: parseCommaSeparatedString(profile.provide)
    };

    return NextResponse.json(transformedProfile);
  } catch (error) {
    console.error('[GET /api/users/[userId]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


// PUT: Update a user by ID
export async function PUT(
  request: NextRequest
) {
  try {
    // Get userId from URL path
    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop();
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // SECURITY FIX: Remove dangerous admin panel bypass
    // All requests must go through proper authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[PUT /api/users/[userId]] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    

    // Check permissions for all requests
    let requesterProfile;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      
      const isAdminOrHelpdesk =
        requesterProfile?.type === UserType.ADMIN ||
        requesterProfile?.type === UserType.SUPER_ADMIN ||
        requesterProfile?.type === UserType.HELPDESK;
        
      // Only allow if requesting own profile or admin/super_admin
      const isSelf = user.id === userId;


      if (!isSelf && !isAdminOrHelpdesk) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[PUT /api/users/[userId]] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }
    
    // Parse request body
    const requestBody = await request.json();
    
    // Validate required fields
    if (!requestBody) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }
    
    // Prepare data for update
    let userTypeEnum: UserType | undefined = undefined;
    
    // Convert string type to UserType enum with validation
    if (requestBody.type) {
      try {
        const typeKey = requestBody.type.toUpperCase();
        
        if (Object.keys(UserType).includes(typeKey)) {
          userTypeEnum = UserType[typeKey as keyof typeof UserType];
        } else {
          return NextResponse.json(
            { error: `Invalid user type: ${requestBody.type}. Valid types are: ${Object.keys(UserType).map(k => k.toLowerCase()).join(', ')}` },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('[PUT /api/users/[userId]] Error converting user type:', error);
        return NextResponse.json(
          { error: `Invalid user type: ${requestBody.type}` },
          { status: 400 }
        );
      }
    }
    
    const updateData: any = {
      // Basic information
      email: requestBody.email,
      contactNumber: requestBody.contact_number,
      // Use the validated enum value
      type: userTypeEnum,
      
      // Name handling based on user type - Fix field mapping
      name: requestBody.name,
      contactName: requestBody.contact_name, // Fix: use contactName (camelCase) for Prisma
      
      // Company information
      companyName: requestBody.company_name,
      website: requestBody.website,
      
      // Address information
      street1: requestBody.street1,
      street2: requestBody.street2,
      city: requestBody.city,
      state: requestBody.state,
      zip: requestBody.zip,
      
      // Location details
      locationNumber: requestBody.location_number,
      parkingLoading: requestBody.parking_loading,
      
      // Service details
      counties: requestBody.counties,
      timeNeeded: Array.isArray(requestBody.timeNeeded) 
        ? requestBody.timeNeeded.join(',') 
        : requestBody.timeNeeded,
      cateringBrokerage: Array.isArray(requestBody.cateringBrokerage) 
        ? requestBody.cateringBrokerage.join(',') 
        : requestBody.cateringBrokerage,
      provide: Array.isArray(requestBody.provisions) 
        ? requestBody.provisions.join(',') 
        : requestBody.provisions,
      
      // Operational details
      frequency: requestBody.frequency,
      headCount: requestBody.headCount,
      
      // Side notes
      sideNotes: requestBody.sideNotes,
    };
    
    // Remove undefined values from updateData
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });
    

    // Update user profile
    const updatedProfile = await prisma.profile.update({
      where: { id: userId },
      data: updateData,
    });
    

    // Transform the response to match frontend expectations (snake_case)
    const transformedProfile = {
      id: updatedProfile.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
      contact_number: updatedProfile.contactNumber,
      company_name: updatedProfile.companyName,
      website: updatedProfile.website,
      street1: updatedProfile.street1,
      street2: updatedProfile.street2,
      city: updatedProfile.city,
      state: updatedProfile.state,
      zip: updatedProfile.zip,
      type: updatedProfile.type,
      status: updatedProfile.status,
      location_number: updatedProfile.locationNumber,
      parking_loading: updatedProfile.parkingLoading,
      counties: updatedProfile.counties,
      timeNeeded: updatedProfile.timeNeeded,
      cateringBrokerage: updatedProfile.cateringBrokerage,
      provide: updatedProfile.provide,
      frequency: updatedProfile.frequency,
      headCount: updatedProfile.headCount,
      sideNotes: updatedProfile.sideNotes,
      contact_name: updatedProfile.contactName,
    };

    return NextResponse.json({
      message: 'User profile updated successfully',
      user: transformedProfile,
      // Also return the profile data directly for easier frontend consumption
      ...transformedProfile
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Check for Prisma-specific errors
    if ((error as any)?.code && (error as any)?.message) {
      if ((error as any).code === 'P2025') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH: Partially update a user by ID (same as PUT for partial updates)
export async function PATCH(
  request: NextRequest
) {
  try {
    // Get userId from URL path
    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop();
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // SECURITY FIX: Remove dangerous admin panel bypass
    // All requests must go through proper authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[PATCH /api/users/[userId]] Authentication required:", authError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    

    // Check permissions for all requests
    let requesterProfile;
    
    try {
      requesterProfile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { type: true }
      });
      
      const isAdminOrHelpdesk =
        requesterProfile?.type === UserType.ADMIN ||
        requesterProfile?.type === UserType.SUPER_ADMIN ||
        requesterProfile?.type === UserType.HELPDESK;
        
      // Only allow if requesting own profile or admin/super_admin
      const isSelf = user.id === userId;


      if (!isSelf && !isAdminOrHelpdesk) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }
    } catch (profileError) {
      console.error(`[PATCH /api/users/[userId]] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }
    
    // Parse request body
    const requestBody = await request.json();
    
    // Validate required fields
    if (!requestBody) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }
    
    // Prepare data for update
    let userTypeEnum: UserType | undefined = undefined;
    
    // Convert string type to UserType enum with validation
    if (requestBody.type) {
      try {
        const typeKey = requestBody.type.toUpperCase();
        
        if (Object.keys(UserType).includes(typeKey)) {
          userTypeEnum = UserType[typeKey as keyof typeof UserType];
        } else {
          return NextResponse.json(
            { error: `Invalid user type: ${requestBody.type}. Valid types are: ${Object.keys(UserType).map(k => k.toLowerCase()).join(', ')}` },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('[PATCH /api/users/[userId]] Error converting user type:', error);
        return NextResponse.json(
          { error: `Invalid user type: ${requestBody.type}` },
          { status: 400 }
        );
      }
    }
    
    const updateData: any = {
      // Basic information
      email: requestBody.email,
      contactNumber: requestBody.contact_number,
      // Use the validated enum value
      type: userTypeEnum,
      
      // Name handling based on user type - Fix field mapping
      name: requestBody.name,
      contactName: requestBody.contact_name, // Fix: use contactName (camelCase) for Prisma
      
      // Company information
      companyName: requestBody.company_name,
      website: requestBody.website,
      
      // Address information
      street1: requestBody.street1,
      street2: requestBody.street2,
      city: requestBody.city,
      state: requestBody.state,
      zip: requestBody.zip,
      
      // Location details
      locationNumber: requestBody.location_number,
      parkingLoading: requestBody.parking_loading,
      
      // Service details
      counties: requestBody.counties,
      timeNeeded: Array.isArray(requestBody.timeNeeded) 
        ? requestBody.timeNeeded.join(',') 
        : requestBody.timeNeeded,
      cateringBrokerage: Array.isArray(requestBody.cateringBrokerage) 
        ? requestBody.cateringBrokerage.join(',') 
        : requestBody.cateringBrokerage,
      provide: Array.isArray(requestBody.provisions) 
        ? requestBody.provisions.join(',') 
        : requestBody.provisions,
      
      // Operational details
      frequency: requestBody.frequency,
      headCount: requestBody.headCount,
      
      // Side notes
      sideNotes: requestBody.sideNotes,
    };
    
    // Remove undefined values from updateData
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });
    

    // Update user profile
    const updatedProfile = await prisma.profile.update({
      where: { id: userId },
      data: updateData,
    });
    

    // Transform the response to match frontend expectations (snake_case)
    const transformedProfile = {
      id: updatedProfile.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
      contact_number: updatedProfile.contactNumber,
      company_name: updatedProfile.companyName,
      website: updatedProfile.website,
      street1: updatedProfile.street1,
      street2: updatedProfile.street2,
      city: updatedProfile.city,
      state: updatedProfile.state,
      zip: updatedProfile.zip,
      type: updatedProfile.type,
      status: updatedProfile.status,
      location_number: updatedProfile.locationNumber,
      parking_loading: updatedProfile.parkingLoading,
      counties: updatedProfile.counties,
      timeNeeded: updatedProfile.timeNeeded,
      cateringBrokerage: updatedProfile.cateringBrokerage,
      provide: updatedProfile.provide,
      frequency: updatedProfile.frequency,
      headCount: updatedProfile.headCount,
      sideNotes: updatedProfile.sideNotes,
      contact_name: updatedProfile.contactName,
    };

    return NextResponse.json({
      message: 'User profile updated successfully',
      user: transformedProfile,
      // Also return the profile data directly for easier frontend consumption
      ...transformedProfile
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Check for Prisma-specific errors
    if ((error as any)?.code && (error as any)?.message) {
      if ((error as any).code === 'P2025') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a user by ID
export async function DELETE(
  request: NextRequest
) {
  const startTime = Date.now();
  let userId: string | undefined;
  let user: any;
  let requesterProfile: any;
  let userToDelete: any;

  try {
    // Get userId from URL path
    const url = new URL(request.url);
    userId = url.pathname.split('/').pop();
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    user = authUser;
    requesterProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });
    
    // Only allow ADMIN and SUPER_ADMIN to delete users (not HELPDESK)
    if (requesterProfile?.type !== UserType.SUPER_ADMIN && requesterProfile?.type !== UserType.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin or Super Admin can delete users' },
        { status: 403 }
      );
    }
    
    // Prevent deletion of SUPER_ADMIN users and get user details
    userToDelete = await prisma.profile.findUnique({
      where: { id: userId },
      select: { type: true, email: true }
    });
    
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (userToDelete.type === UserType.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin users cannot be deleted' },
        { status: 403 }
      );
    }
    
    // Prevent self-deletion
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot delete your own account' },
        { status: 403 }
      );
    }
    
    
    // Step 1: Pre-deletion validation - Check for active orders
    const activeOrders = await Promise.all([
      prisma.cateringRequest.count({
        where: { 
          userId, 
          status: { in: ['ACTIVE', 'ASSIGNED', 'PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
        }
      }),
      prisma.onDemand.count({
        where: { 
          userId, 
          status: { in: ['ACTIVE', 'ASSIGNED', 'PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
        }
      })
    ]);
    
    const totalActiveOrders = activeOrders[0] + activeOrders[1];
    
    if (totalActiveOrders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete user with active orders. Complete or cancel orders first.',
          details: { 
            activeCateringOrders: activeOrders[0],
            activeOnDemandOrders: activeOrders[1],
            totalActiveOrders 
          }
        },
        { status: 409 }
      );
    }
    
    // Step 2: Execute deletion transaction
    const transactionResult = await prisma.$transaction(async (tx: PrismaTransaction) => {
      // Step 2a: Delete Dispatch records (no CASCADE defined)
      const deletedDispatches = await tx.dispatch.deleteMany({
        where: {
          OR: [{ driverId: userId }, { userId }],
        },
      });
      
      // Step 2b: Update FileUpload records to null out userId (preserve files)
      const updatedFileUploads = await tx.fileUpload.updateMany({
        where: { userId },
        data: { userId: null },
      });
      
      // Step 2c: Handle Address ownership logic
      const createdAddresses = await tx.address.findMany({
        where: { createdBy: userId },
        include: {
          userAddresses: true,
          cateringPickupRequests: true,
          cateringDeliveryRequests: true,
          onDemandPickupRequests: true,
          onDemandDeliveryRequests: true,
        }
      });
      
      let deletedAddresses = 0;
      let updatedAddresses = 0;
      
      for (const address of createdAddresses) {
        const isUsedByOthers = 
          address.userAddresses.some((ua: { userId: string }) => ua.userId !== userId) ||
          address.cateringPickupRequests.length > 0 ||
          address.cateringDeliveryRequests.length > 0 ||
          address.onDemandPickupRequests.length > 0 ||
          address.onDemandDeliveryRequests.length > 0;
        
        if (!isUsedByOthers) {
          // Delete unused addresses
          await tx.address.delete({
            where: { id: address.id }
          });
          deletedAddresses++;
        } else {
          // Null out the createdBy field for addresses used by others
          await tx.address.update({
            where: { id: address.id },
            data: { createdBy: null }
          });
          updatedAddresses++;
        }
      }
      
      
      // Step 2d: Delete the Profile (triggers CASCADE deletes)
      const deletedProfile = await tx.profile.delete({
        where: { id: userId },
      });
      
      return {
        deletedProfile,
        deletedDispatches: deletedDispatches.count,
        updatedFileUploads: updatedFileUploads.count,
        deletedAddresses,
        updatedAddresses,
        totalAddressesProcessed: createdAddresses.length
      };
    }, {
      timeout: 10000, // 10 second timeout for complex deletions
    });
    
    const duration = Date.now() - startTime;
    
    // Step 3: Create audit log entry
    const auditEntry = {
      action: 'USER_DELETION',
      performedBy: user.id,
      performedByType: requesterProfile?.type,
      targetUserId: userId,
      targetUserEmail: userToDelete.email,
      targetUserType: userToDelete.type,
      timestamp: new Date(),
      affectedRecords: {
        dispatchesDeleted: transactionResult.deletedDispatches,
        fileUploadsUpdated: transactionResult.updatedFileUploads,
        addressesDeleted: transactionResult.deletedAddresses,
        addressesUpdated: transactionResult.updatedAddresses
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
      duration: `${duration}ms`
    };
    
    
    return NextResponse.json({
      message: 'User and associated data deleted successfully',
      summary: {
        deletedUser: {
          id: userId,
          email: userToDelete.email,
          type: userToDelete.type
        },
        deletedDispatches: transactionResult.deletedDispatches,
        updatedFileUploads: transactionResult.updatedFileUploads,
        processedAddresses: transactionResult.totalAddressesProcessed,
        deletedAddresses: transactionResult.deletedAddresses,
        updatedAddresses: transactionResult.updatedAddresses,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DELETE] Transaction failed after ${duration}ms:`, error);
    
    // Create failure audit log entry
    const failureAuditEntry = {
      action: 'USER_DELETION_FAILED',
      performedBy: user?.id || 'unknown',
      performedByType: requesterProfile?.type || 'unknown',
      targetUserId: userId || 'unknown',
      targetUserEmail: userToDelete?.email || 'unknown',
      targetUserType: userToDelete?.type || 'unknown',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: false,
      duration: `${duration}ms`
    };
    
    
    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2025': // Record not found
          return NextResponse.json(
            { 
              error: 'User not found or already deleted',
              code: 'USER_NOT_FOUND',
              details: error.meta
            },
            { status: 404 }
          );
        
        case 'P2003': // Foreign key constraint violation  
          return NextResponse.json(
            { 
              error: 'Cannot delete user: referenced by other records',
              code: 'FOREIGN_KEY_VIOLATION',
              details: error.meta
            },
            { status: 409 }
          );
        
        case 'P2002': // Unique constraint violation
          return NextResponse.json(
            { 
              error: 'Data integrity constraint violation',
              code: 'CONSTRAINT_VIOLATION',
              details: error.meta
            },
            { status: 409 }
          );
          
        case 'P1001': // Database connection failed
          return NextResponse.json(
            { 
              error: 'Database connection failed. Please try again.',
              code: 'CONNECTION_FAILED'
            },
            { status: 503 }
          );
          
        case 'P2024': // Connection timeout
          return NextResponse.json(
            { 
              error: 'Operation timed out. Please try again.',
              code: 'OPERATION_TIMEOUT'
            },
            { status: 408 }
          );
          
        default:
          console.error('Unknown Prisma error:', error.code, error.message);
          return NextResponse.json(
            { 
              error: 'Database operation failed',
              code: 'DATABASE_ERROR',
              details: { 
                prismaCode: error.code,
                message: error.message 
              }
            },
            { status: 500 }
          );
      }
    }
    
    // Handle transaction timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { 
          error: 'Deletion operation timed out. The operation may have been too complex.',
          code: 'TRANSACTION_TIMEOUT',
          details: { duration: `${duration}ms` }
        },
        { status: 408 }
      );
    }
    
    // Handle business logic errors (thrown by our validation)
    if (error instanceof Error && error.message.includes('Cannot delete user with active orders')) {
      return NextResponse.json(
        { 
          error: error.message,
          code: 'ACTIVE_ORDERS_EXIST'
        },
        { status: 409 }
      );
    }
    
    // Handle general errors
    return NextResponse.json(
      { 
        error: 'Failed to delete user',
        code: 'DELETION_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}