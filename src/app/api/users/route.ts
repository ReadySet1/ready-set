// src/app/api/users/route.ts

import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/utils/supabase/server';

// GET: Fetch users with pagination, search, sort, filter
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const typeFilter = searchParams.get('type') || 'all';
    const sortField = searchParams.get('sort') || 'createdAt';
    const sortDirection = searchParams.get('direction') || 'desc';

    console.log('Filter values:', {
      statusFilter,
      typeFilter,
      search,
      sortField,
      sortDirection
    });

    // Build where clause using Profile model
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (statusFilter !== 'all') {
      where.status = statusFilter.toUpperCase();
    }

    if (typeFilter !== 'all') {
      where.type = typeFilter.toUpperCase();
    }

    // Add soft delete filter (deletedAt exists in Profile model)
    where.deletedAt = null;

    console.log('Final where clause:', where);

    // Build orderBy clause
    const orderBy = {
      [sortField]: sortDirection
    };

    const skip = (page - 1) * limit;

    // --- Fetch Data and Count using Profile model ---
    const [users, totalUsers] = await Promise.all([
      prisma.profile.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          contactName: true,
          contactNumber: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.profile.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new user
export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized - Invalid authorization header" }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.profile.findUnique({
      where: { id: authUser.id },
      select: { type: true },
    });

    // Allow admin and super_admin to create users
    if (dbUser?.type !== 'ADMIN' && dbUser?.type !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: "Forbidden: Only admins can create users" }, { status: 403 });
    }

    const data = await request.json();

    // Basic validation
    if (!data.email || !data.type || !data.status) {
         return NextResponse.json({ error: "Missing required fields (email, type, status)" }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.profile.findUnique({ where: { email: data.email } });
    if (existingUser) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const newUser = await prisma.profile.create({
      data: {
        id: data.id || undefined,
        guid: data.guid,
        name: data.name,
        email: data.email,
        type: data.type,
        status: data.status,
        companyName: data.companyName,
        contactName: data.contactName,
        contactNumber: data.contactNumber,
        website: data.website,
        street1: data.street1,
        street2: data.street2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        locationNumber: data.locationNumber,
        parkingLoading: data.parkingLoading,
        counties: data.counties,
        timeNeeded: data.timeNeeded,
        cateringBrokerage: data.cateringBrokerage,
        frequency: data.frequency,
        provide: data.provide,
        headCount: data.headCount,
        sideNotes: data.sideNotes,
        isTemporaryPassword: data.isTemporaryPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
     if ((error as any)?.code && (error as any)?.message) {
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: `Unique constraint failed on field(s): ${(error as any).meta?.target}` }, { status: 409 });
        }
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}