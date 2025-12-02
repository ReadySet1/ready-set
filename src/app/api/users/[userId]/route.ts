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
import { UserType, PrismaClientKnownRequestError } from '@/types/prisma';
import { PrismaTransaction } from '@/types/prisma-types';
import { UserAuditService } from '@/services/userAuditService';
import { AuditAction } from '@/types/audit';

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

    // Handle "new" as a special case - it's not a valid UUID
    if (userId === 'new') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
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

    // Fetch the target user profile (exclude soft-deleted users)
    let profile;
    try {
      profile = await prisma.profile.findUnique({
        where: { 
          id: userId,
          deletedAt: null // Exclude soft-deleted users
        },
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
      // Parse comma-separated strings to arrays for form consumption
      timeNeeded: parseCommaSeparatedString(profile.timeNeeded),
      cateringBrokerage: parseCommaSeparatedString(profile.cateringBrokerage),
      provide: profile.provide,
      frequency: profile.frequency,
      headCount: profile.headCount,
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


// PUT: Update a user by ID, or create a new user if userId is "new"
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

    // Parse request body early to check if this is a create operation
    const requestBody = await request.json();

    // Determine if this is a create operation
    // Create if: userId is "new" OR requestBody.id is empty/undefined
    const isCreateOperation = userId === 'new' || !requestBody.id || requestBody.id === '';

    if (!isCreateOperation) {
      // For update operations, validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return NextResponse.json(
          { error: 'Invalid user ID format' },
          { status: 400 }
        );
      }
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

      // For create operations, require admin privileges
      if (isCreateOperation) {
        if (!isAdminOrHelpdesk) {
          return NextResponse.json(
            { error: 'Forbidden: Only admins can create users' },
            { status: 403 }
          );
        }
      } else {
        // For update operations, allow if requesting own profile or admin/super_admin
        const isSelf = user.id === userId;

        if (!isSelf && !isAdminOrHelpdesk) {
          return NextResponse.json(
            { error: 'Forbidden: Insufficient permissions' },
            { status: 403 }
          );
        }
      }
    } catch (profileError) {
      console.error(`[PUT /api/users/[userId]] Error fetching requester profile (ID: ${user.id}):`, profileError);
      return NextResponse.json({ error: 'Failed to fetch requester profile' }, { status: 500 });
    }

    // Validate required fields
    if (!requestBody) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // For create operations, validate required fields
    if (isCreateOperation) {
      if (!requestBody.email || !requestBody.type) {
        return NextResponse.json(
          { error: 'Missing required fields: email and type are required for new users' },
          { status: 400 }
        );
      }
    }

    // Prepare data for create/update
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

    const profileData: any = {
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

    // For create operations, add status field (default to 'ACTIVE' if not provided)
    if (isCreateOperation) {
      // Normalize status to uppercase to match UserStatus enum
      const statusValue = requestBody.status ? requestBody.status.toUpperCase() : 'ACTIVE';
      profileData.status = statusValue;
    }

    // Remove undefined values from profileData
    Object.keys(profileData).forEach(key => {
      if (profileData[key as keyof typeof profileData] === undefined) {
        delete profileData[key as keyof typeof profileData];
      }
    });

    let profile;

    if (isCreateOperation) {
      // Create new user profile
      // Check if email already exists
      const existingUser = await prisma.profile.findUnique({
        where: { email: requestBody.email }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }

      // Use transaction for create + audit logging
      profile = await prisma.$transaction(async (tx) => {
        const newProfile = await tx.profile.create({
          data: profileData,
        });

        // Create audit entry for user creation
        const auditService = new UserAuditService();
        await auditService.createAuditEntry(tx, {
          userId: newProfile.id,
          action: AuditAction.CREATE,
          performedBy: user.id,
          after: UserAuditService.sanitizeForAudit(profileData),
          reason: 'User created',
        });

        return newProfile;
      });
    } else {
      // Update existing user profile

      // Check if user exists and is not soft-deleted, and get current state for audit
      const existingUser = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          deletedAt: true,
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
          sideNotes: true,
        }
      });

      if (!existingUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      if (existingUser.deletedAt) {
        return NextResponse.json(
          { error: 'Cannot update soft-deleted user' },
          { status: 409 }
        );
      }

      // Use transaction for update + audit logging
      profile = await prisma.$transaction(async (tx) => {
        const updatedProfile = await tx.profile.update({
          where: { id: userId },
          data: profileData,
        });

        // Prepare before/after states for audit (only include changed fields)
        const beforeState = UserAuditService.sanitizeForAudit({
          name: existingUser.name,
          email: existingUser.email,
          contactNumber: existingUser.contactNumber,
          type: existingUser.type,
          companyName: existingUser.companyName,
          website: existingUser.website,
          street1: existingUser.street1,
          street2: existingUser.street2,
          city: existingUser.city,
          state: existingUser.state,
          zip: existingUser.zip,
          locationNumber: existingUser.locationNumber,
          parkingLoading: existingUser.parkingLoading,
          counties: existingUser.counties,
          timeNeeded: existingUser.timeNeeded,
          cateringBrokerage: existingUser.cateringBrokerage,
          provide: existingUser.provide,
          frequency: existingUser.frequency,
          headCount: existingUser.headCount,
          status: existingUser.status,
          contactName: existingUser.contactName,
          sideNotes: existingUser.sideNotes,
        });

        const afterState = UserAuditService.sanitizeForAudit(profileData);

        // Get only the changed fields
        const changes = UserAuditService.getChangedFields(
          beforeState as Record<string, unknown>,
          afterState as Record<string, unknown>
        );

        // Only create audit entry if there are actual changes
        if (Object.keys(changes.before).length > 0 || Object.keys(changes.after).length > 0) {
          const auditService = new UserAuditService();
          await auditService.createAuditEntry(tx, {
            userId,
            action: AuditAction.UPDATE,
            performedBy: user.id,
            before: changes.before,
            after: changes.after,
            reason: 'User profile updated',
          });
        }

        return updatedProfile;
      });
    }


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
      counties: profile.counties,
      timeNeeded: profile.timeNeeded,
      cateringBrokerage: profile.cateringBrokerage,
      provide: profile.provide,
      frequency: profile.frequency,
      headCount: profile.headCount,
      sideNotes: profile.sideNotes,
      contact_name: profile.contactName,
    };

    return NextResponse.json({
      message: isCreateOperation ? 'User profile created successfully' : 'User profile updated successfully',
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

    // Handle "new" as a special case - it's not a valid UUID
    if (userId === 'new') {
      return NextResponse.json(
        { error: 'Cannot update a non-existent user' },
        { status: 404 }
      );
    }

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
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

    // Check if user exists and is not soft-deleted before updating
    const existingUser = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (existingUser.deletedAt) {
      return NextResponse.json(
        { error: 'Cannot update soft-deleted user' },
        { status: 409 }
      );
    }

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

// DELETE: Soft delete a user by ID
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

    // Handle "new" as a special case - it's not a valid UUID
    if (userId === 'new') {
      return NextResponse.json(
        { error: 'Cannot delete a non-existent user' },
        { status: 404 }
      );
    }

    // Validate UUID format before querying database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Parse request body for deletion reason
    let deletionReason: string | undefined;
    try {
      const body = await request.json();
      deletionReason = body.reason;
    } catch {
      // No body provided, deletionReason remains undefined
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
      select: { type: true, email: true, deletedAt: true }
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

    if (userToDelete.deletedAt) {
      return NextResponse.json(
        { error: 'User is already soft deleted' },
        { status: 409 }
      );
    }
    
    // Prevent self-deletion
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot delete your own account' },
        { status: 403 }
      );
    }

    // Import the soft delete service
    const { userSoftDeleteService } = await import('@/services/userSoftDeleteService');

    // Perform soft delete
    const result = await userSoftDeleteService.softDeleteUser(
      userId,
      user.id,
      deletionReason
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      message: 'User soft deleted successfully',
      summary: {
        deletedUser: {
          id: result.userId,
          email: userToDelete.email,
          type: userToDelete.type
        },
        deletedAt: result.deletedAt,
        deletedBy: result.deletedBy,
        deletionReason: result.deletionReason,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DELETE] Soft delete failed after ${duration}ms:`, error);

    // Handle Prisma-specific errors (use directly imported class)
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2025': // Record not found
          return NextResponse.json(
            { 
              error: 'User not found',
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
    
    // Handle business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Cannot delete user with active orders')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'ACTIVE_ORDERS_EXIST'
          },
          { status: 409 }
        );
      }
      
      if (error.message.includes('User is already soft deleted')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'ALREADY_DELETED'
          },
          { status: 409 }
        );
      }
    }
    
    // Handle general errors
    return NextResponse.json(
      { 
        error: 'Failed to soft delete user',
        code: 'SOFT_DELETE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}