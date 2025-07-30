// src/app/api/users/route.ts

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { Prisma } from '@prisma/client';
import { UserStatus, UserType } from '@/types/prisma';
import { withRateLimit, RateLimitConfigs } from '@/lib/rate-limiting';
import { addSecurityHeaders } from '@/lib/auth-middleware';

// Rate limiting for admin operations
const adminRateLimit = withRateLimit(RateLimitConfigs.admin);

// GET: Fetch users with pagination, search, sort, filter
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for admin operations
    const rateLimitResponse = adminRateLimit(request);
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse);
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

    const dbUser = await prisma.profile.findUnique({
      where: { id: authUser.id },
      select: { type: true },
    });

    if (!dbUser?.type || (dbUser.type !== UserType.ADMIN && dbUser.type !== UserType.SUPER_ADMIN && dbUser.type !== UserType.HELPDESK)) {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return addSecurityHeaders(response);
    }

    // --- Parse Query Parameters ---
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const statusFilter = (searchParams.get("status") ?? "all") as UserStatus | 'all';
    const typeFilter = (searchParams.get("type") ?? "all") as UserType | 'all';
    const sortField = searchParams.get("sort") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

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

    // --- Execute Query ---
    const [users, totalCount] = await Promise.all([
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

    // --- Response ---
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = NextResponse.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        pageSize: limit,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        search,
        status: statusFilter,
        type: typeFilter,
        sort: sortField,
        sortOrder,
      },
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error fetching users:", error);
    const response = NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
    return addSecurityHeaders(response);
  }
}

// POST: Create a new user
export async function POST(request: Request) {
  try {
    // Apply rate limiting for admin operations
    const rateLimitResponse = adminRateLimit(request as NextRequest);
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse);
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

    const dbUser = await prisma.profile.findUnique({
      where: { id: authUser.id },
      select: { type: true },
    });

    // Allow admin and super_admin to create users
    if (dbUser?.type !== UserType.ADMIN && dbUser?.type !== UserType.SUPER_ADMIN) {
        const response = NextResponse.json({ error: "Forbidden: Only admins can create users" }, { status: 403 });
        return addSecurityHeaders(response);
    }

    const data = await request.json();

    // Basic validation
    if (!data.email || !data.type || !data.status) {
         const response = NextResponse.json({ error: "Missing required fields (email, type, status)" }, { status: 400 });
         return addSecurityHeaders(response);
    }

    // Check if email already exists
    const existingUser = await prisma.profile.findUnique({ where: { email: data.email } });
    if (existingUser) {
        const response = NextResponse.json({ error: "Email already in use" }, { status: 409 });
        return addSecurityHeaders(response);
    }

    // Create user in database
    const newUser = await prisma.profile.create({
      data: {
        email: data.email,
        type: data.type,
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
    const response = NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
    return addSecurityHeaders(response);
  }
}