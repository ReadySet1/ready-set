// src/app/api/users/route.ts

import { NextResponse, NextRequest } from "next/server";
import { prisma, withDatabaseRetry } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from '@prisma/client';
import { UserStatus, UserType, PrismaClientKnownRequestError, PrismaClientValidationError } from '@/types/prisma';
import { ApiTypeUtils, ApiValidationError, ApiError } from '@/types/api-shared';
import { withRateLimit, RateLimitConfigs } from '@/lib/rate-limiting';
import { addSecurityHeaders } from '@/lib/auth-middleware';

// Rate limiting for admin operations
const adminRateLimit = withRateLimit(RateLimitConfigs.admin);

// Helper function to check if user has admin privileges
function hasAdminPrivileges(userType: string): boolean {
  // Handle both lowercase and uppercase user types
  const normalizedType = userType?.toUpperCase();
  return normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
}

// Use shared utility functions for type normalization to ensure consistency

// Enhanced error handling utility for Prisma and validation errors
function handlePrismaError(error: unknown): { error: ApiError; status: number } {
  console.error('Prisma error occurred:', error);
  
  // Handle Prisma validation errors
  if (error instanceof PrismaClientValidationError) {
    const validationError: ApiValidationError = {
      error: "Invalid data provided",
      code: "VALIDATION_ERROR",
      details: "The data provided does not match the expected format.",
    };
    return { error: validationError, status: 400 };
  }
  
  // Handle Prisma known request errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        const constraintError: ApiValidationError = {
          error: "A user with this email already exists",
          code: "DUPLICATE_EMAIL",
          field: "email",
          details: error.meta,
        };
        return { error: constraintError, status: 409 };
        
      case 'P2025': // Record not found
        const notFoundError: ApiError = {
          error: "User not found",
          code: "USER_NOT_FOUND",
          details: error.meta,
        };
        return { error: notFoundError, status: 404 };
        
      case 'P2003': // Foreign key constraint violation
        const foreignKeyError: ApiError = {
          error: "Invalid reference to related data",
          code: "FOREIGN_KEY_VIOLATION", 
          details: error.meta,
        };
        return { error: foreignKeyError, status: 400 };
        
      case 'P2004': // Constraint violation
        const constraintViolationError: ApiError = {
          error: "Data constraint violation",
          code: "CONSTRAINT_VIOLATION",
          details: error.meta,
        };
        return { error: constraintViolationError, status: 400 };
        
      default:
        const unknownPrismaError: ApiError = {
          error: "Database operation failed",
          code: error.code,
          details: error.meta,
        };
        return { error: unknownPrismaError, status: 500 };
    }
  }
  
  // Handle generic Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError: ApiError = {
      error: "Database operation failed",
      code: error.code,
      details: error.meta,
    };
    return { error: prismaError, status: 500 };
  }
  
  // Handle standard errors
  if (error instanceof Error) {
    const standardError: ApiError = {
      error: error.message || "An unexpected error occurred",
      code: "INTERNAL_ERROR",
    };
    return { error: standardError, status: 500 };
  }
  
  // Fallback for unknown error types
  const fallbackError: ApiError = {
    error: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    details: String(error),
  };
  return { error: fallbackError, status: 500 };
}

// GET: Fetch users with pagination, search, sort, filter
export async function GET(request: NextRequest) {
  // Declare variables in broader scope for error handling
  let page = 1;
  let limit = 10;
  let search = "";
  let statusFilter = "all";
  let typeFilter = "all";
  let sortField = "createdAt";
  let sortOrder = "desc";

  try {
    // Apply rate limiting for admin operations
    const rateLimitResponse = adminRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json({ error: "Unauthorized - Invalid authorization header" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Auth error:', authError);
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    console.log('🔍 [Users API] Authenticated user ID:', authUser.id);

    // Get user profile from Supabase (same approach as current-user route)
    const { data: dbUser, error: profileError } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', authUser.id)
      .single();

    if (profileError || !dbUser) {
      console.error('Profile error:', profileError);
      const response = NextResponse.json({ error: "User profile not found" }, { status: 404 });
      return addSecurityHeaders(response);
    }

    console.log('🔍 [Users API] Database user type:', dbUser.type);
    console.log('🔍 [Users API] Expected types:', UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HELPDESK);
    console.log('🔍 [Users API] Type comparison:', {
      isAdmin: dbUser.type === UserType.ADMIN,
      isSuperAdmin: dbUser.type === UserType.SUPER_ADMIN,
      isHelpdesk: dbUser.type === UserType.HELPDESK,
      hasType: !!dbUser.type,
      normalizedType: dbUser.type?.toUpperCase(),
      hasAdminPrivileges: hasAdminPrivileges(dbUser.type || '')
    });

    // Check if user has admin privileges using the helper function
    if (!dbUser.type || !hasAdminPrivileges(dbUser.type)) {
      console.log('❌ [Users API] Authorization failed - User type not allowed:', dbUser.type);
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return addSecurityHeaders(response);
    }

    console.log('✅ [Users API] Authorization successful for user type:', dbUser.type);

    // --- Parse Query Parameters ---
    const { searchParams } = new URL(request.url);
    page = parseInt(searchParams.get("page") || "1", 10);
    limit = parseInt(searchParams.get("limit") || "10", 10);
    search = searchParams.get("search") || "";
    const rawStatusFilter = searchParams.get("status") ?? "all";
    statusFilter = ApiTypeUtils.normalizeUserStatus(rawStatusFilter);
    const rawTypeFilter = searchParams.get("type") ?? "all";
    typeFilter = ApiTypeUtils.normalizeUserType(rawTypeFilter); // Use shared utility
    sortField = searchParams.get("sort") || "createdAt";
    sortOrder = searchParams.get("sortOrder") || "desc";

    console.log(`🔍 [Users API] Filter transformations: type "${rawTypeFilter}" -> "${typeFilter}", status "${rawStatusFilter}" -> "${statusFilter}"`);

    // --- Build WHERE Clause ---
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (statusFilter !== "all") {
      where.status = statusFilter;
    }

    if (typeFilter !== "all") {
      where.type = typeFilter;
    }

    // --- Build ORDER BY Clause ---
    const orderBy: any = {};
    if (sortField && (sortOrder === "asc" || sortOrder === "desc")) {
      (orderBy as any)[sortField] = sortOrder;
    }

    // --- Execute Query with retry logic ---
    const [users, totalCount] = await withDatabaseRetry(async () => {
      return Promise.all([
        prisma.profile.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
            status: true,
            contactNumber: true,
            companyName: true,
            contactName: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.profile.count({ where }),
      ]);
    });

    // --- Calculate Pagination ---
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // --- Return Response ---
    const response = NextResponse.json({
      users,
      totalPages,
      totalCount,
      currentPage: page,
      hasNextPage,
      hasPrevPage,
      limit,
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in GET /api/users:", error);
    
    // Use comprehensive error handling
    const { error: apiError, status } = handlePrismaError(error);
    
    // Add additional context for debugging
    const contextualError: ApiError = {
      ...apiError,
      details: {
        ...apiError.details,
        operation: 'fetch_users',
        filters: { statusFilter, typeFilter, search, page, limit, sortField, sortOrder },
      },
    };
    
    const response = NextResponse.json(contextualError, { status });
    return addSecurityHeaders(response);
  }
}

// POST: Create a new user
export async function POST(request: Request) {
  // Declare data variable in broader scope for error handling
  let data: any = {};

  try {
    // Apply rate limiting for admin operations
    const rateLimitResponse = adminRateLimit(request as NextRequest);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json({ error: "Unauthorized - Invalid authorization header" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Auth error:', authError);
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addSecurityHeaders(response);
    }

    // Get user profile from Supabase (same approach as current-user route)
    const { data: dbUser, error: profileError } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', authUser.id)
      .single();

    if (profileError || !dbUser) {
      console.error('Profile error:', profileError);
      const response = NextResponse.json({ error: "User profile not found" }, { status: 404 });
      return addSecurityHeaders(response);
    }

    // Allow admin and super_admin to create users
    if (!hasAdminPrivileges(dbUser.type || '')) {
        const response = NextResponse.json({ error: "Forbidden: Only admins can create users" }, { status: 403 });
        return addSecurityHeaders(response);
    }

    data = await request.json();

    // Basic validation
    if (!data.email || !data.type || !data.status) {
         const response = NextResponse.json({ error: "Missing required fields (email, type, status)" }, { status: 400 });
         return addSecurityHeaders(response);
    }

    // Normalize user type using shared utility
    const normalizedType = ApiTypeUtils.normalizeUserType(data.type);
    if (normalizedType === 'all') {
        const validationError: ApiValidationError = {
            error: "Invalid user type provided",
            field: "type",
            received: data.type,
            expected: ['VENDOR', 'CLIENT', 'DRIVER', 'ADMIN', 'HELPDESK', 'SUPER_ADMIN']
        };
        const response = NextResponse.json(validationError, { status: 400 });
        return addSecurityHeaders(response);
    }

    console.log(`🔍 [Users API] POST type normalization: "${data.type}" -> "${normalizedType}"`);

    // Check if email already exists (with better error handling)
    const existingUser = await prisma.profile.findUnique({ where: { email: data.email } });
    if (existingUser) {
        const duplicateError: ApiValidationError = {
            error: "Email already in use",
            code: "DUPLICATE_EMAIL",
            field: "email",
            received: data.email,
        };
        const response = NextResponse.json(duplicateError, { status: 409 });
        return addSecurityHeaders(response);
    }

    // Create user in database
    const newUser = await prisma.profile.create({
      data: {
        email: data.email,
        type: normalizedType, // Use normalized type instead of raw data.type
        status: data.status,
        name: data.name || null,
        contactName: data.contactName || null,
        contactNumber: data.contactNumber || null,
        companyName: data.companyName || null,
      },
    });

    const response = NextResponse.json(newUser, { status: 201 });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error creating user:", error);
    
    // Use comprehensive error handling
    const { error: apiError, status } = handlePrismaError(error);
    
    // Add additional context for debugging
    const contextualError: ApiError = {
      ...apiError,
      details: {
        ...apiError.details,
        operation: 'create_user',
        input: { email: data?.email, type: data?.type, status: data?.status },
      },
    };
    
    const response = NextResponse.json(contextualError, { status });
    return addSecurityHeaders(response);
  }
}