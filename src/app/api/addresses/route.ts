// src/app/api/addresses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma-client";
import { withDatabaseRetry } from "@/utils/prismaDB";
import { AddressFormData } from "@/types/address";
import { createClient } from "@/utils/supabase/server";
// Simple in-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, {
    count: number;
    resetTime: number;
}>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute
function checkRateLimit(userId: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
} {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);
    if (!userLimit || now > userLimit.resetTime) {
        // Reset or create new limit
        rateLimitMap.set(userId, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW,
        });
        return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetTime: now + RATE_LIMIT_WINDOW };
    }
    if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0, resetTime: userLimit.resetTime };
    }
    // Increment count
    userLimit.count++;
    rateLimitMap.set(userId, userLimit);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - userLimit.count, resetTime: userLimit.resetTime };
}
// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, limit] of rateLimitMap.entries()) {
        if (now > limit.resetTime) {
            rateLimitMap.delete(userId);
        }
    }
}, RATE_LIMIT_WINDOW);
// Helper function to authenticate user via multiple methods
async function authenticateUser(request: NextRequest) {
    // Try bearer token authentication first (for backward compatibility)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user?.id) {
            return { user, error: null };
        }
    }
    // Fallback to cookie-based authentication (more secure)
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user?.id) {
            return { user, error: null };
        }
        return { user: null, error: error || new Error('No valid authentication found') };
    }
    catch (err) {
        return { user: null, error: err as Error };
    }
}
/**
 * GET handler for fetching addresses
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate user using multiple methods
        const { user: currentUser, error: authError } = await authenticateUser(request);
        if (authError || !currentUser?.id) {
            console.error("Auth error:", authError);
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }
        // Check rate limit
        const rateLimit = checkRateLimit(currentUser.id);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                error: "Rate limit exceeded",
                retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
            }, {
                status: 429,
                headers: {
                    'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
                    'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
                }
            });
        }
        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get("id");
        const filterParam = searchParams.get("filter") || "all"; // Options: all, shared, private
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "5", 10);
        const skip = (page - 1) * limit;
        // If requesting a specific address by ID
        if (id) {
            const address = await withDatabaseRetry(async () => {
                return await prisma.address.findUnique({
                    where: { id },
                    // Optimize query by selecting only needed fields
                    select: {
                        id: true,
                        name: true,
                        street1: true,
                        street2: true,
                        city: true,
                        state: true,
                        zip: true,
                        county: true,
                        isRestaurant: true,
                        isShared: true,
                        locationNumber: true,
                        parkingLoading: true,
                        createdAt: true,
                        createdBy: true,
                        updatedAt: true,
                    },
                });
            });
            // Check if address exists
            if (!address) {
                return NextResponse.json({ error: "Address not found" }, { status: 404 });
            }
            // Check if user has access to this address
            if (!address.isShared && address.createdBy !== currentUser.id) {
                return NextResponse.json({ error: "Unauthorized to access this address" }, { status: 403 });
            }
            // Add cache headers for individual address requests
            const response = NextResponse.json(address);
            response.headers.set('Cache-Control', 'private, max-age=300'); // 5 minutes
            response.headers.set('ETag', `"${currentUser.id}-${id}"`);
            // Add rate limit headers
            response.headers.set('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
            response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
            response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());
            return response;
        }
        // Different query strategies based on filter parameter
        const addressesQuery = {
            where: {},
            orderBy: { createdAt: "desc" as const },
            skip,
            take: limit,
            // Optimize query by selecting only needed fields
            select: {
                id: true,
                name: true,
                street1: true,
                street2: true,
                city: true,
                state: true,
                zip: true,
                county: true,
                isRestaurant: true,
                isShared: true,
                locationNumber: true,
                parkingLoading: true,
                createdAt: true,
                createdBy: true,
                updatedAt: true,
            },
        };
        // Build the query based on the filter
        switch (filterParam) {
            case "shared":
                // Only fetch shared addresses
                addressesQuery.where = { isShared: true };
                break;
            case "private":
                // Only fetch user's private addresses
                addressesQuery.where = {
                    createdBy: currentUser.id,
                    isShared: false,
                };
                break;
            case "all":
            default:
                // Fetch both shared addresses and user's private addresses
                addressesQuery.where = {
                    OR: [{ isShared: true }, { createdBy: currentUser.id }],
                };
                break;
        }
        // Execute the query with pagination using withDatabaseRetry to handle prepared statement conflicts
        const [addresses, totalCount] = await withDatabaseRetry(async () => {
            return await Promise.all([
                prisma.address.findMany(addressesQuery),
                prisma.address.count({ where: addressesQuery.where }),
            ]);
        });
        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        // Return paginated response with cache headers
        const response = NextResponse.json({
            addresses,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                hasNextPage,
                hasPrevPage,
                limit,
            },
        });
        // Add cache headers to prevent unnecessary refetches
        // Short cache for paginated results to allow for real-time updates
        response.headers.set('Cache-Control', 'private, max-age=60'); // 1 minute
        response.headers.set('ETag', `"${currentUser.id}-${filterParam}-${page}-${limit}"`);
        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
        response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
        response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());
        return response;
    }
    catch (error) {
        console.error("Error fetching addresses:", error);
        return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
    }
}
/**
 * POST handler for creating a new address
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate user using multiple methods
        const { user: currentUser, error: authError } = await authenticateUser(request);
        if (authError || !currentUser?.id) {
            console.error("POST /api/addresses: Auth error:", authError);
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }
        const formData: AddressFormData = await request.json();
        // Enhanced validation with detailed error messages
        const validationErrors: string[] = [];
        if (!formData.street1?.trim()) {
            validationErrors.push("Street address is required");
        }
        if (!formData.city?.trim()) {
            validationErrors.push("City is required");
        }
        if (!formData.state?.trim()) {
            validationErrors.push("State is required");
        }
        if (!formData.zip?.trim()) {
            validationErrors.push("ZIP code is required");
        }
        if (!formData.county?.trim()) {
            validationErrors.push("County is required");
        }
        if (validationErrors.length > 0) {
            console.error("POST /api/addresses: Validation failed:", validationErrors);
            return NextResponse.json({ error: "Validation failed", details: validationErrors }, { status: 400 });
        }
        // Use database transaction with retry mechanism to ensure data consistency
        const result = await withDatabaseRetry(async () => {
            return await prisma.$transaction(async (tx) => {
                // Create a new address
                const newAddress = {
                    ...formData,
                    createdBy: currentUser.id,
                    // Ensure boolean fields are properly set
                    isRestaurant: Boolean(formData.isRestaurant),
                    isShared: Boolean(formData.isShared),
                    // Normalize state to uppercase
                    state: formData.state.trim().toUpperCase(),
                    // Normalize ZIP code
                    zip: formData.zip.trim(),
                    // Normalize city and street
                    city: formData.city.trim(),
                    street1: formData.street1.trim(),
                    street2: formData.street2?.trim() || null,
                    county: formData.county.trim(),
                    locationNumber: formData.locationNumber?.trim() || null,
                    parkingLoading: formData.parkingLoading?.trim() || null,
                    name: formData.name?.trim() || null,
                };
                const createdAddress = await tx.address.create({
                    data: newAddress,
                });
                // Create userAddress relation to track ownership if it's not shared
                if (!formData.isShared) {
                    await tx.userAddress.create({
                        data: {
                            userId: currentUser.id,
                            addressId: createdAddress.id,
                            isDefault: false, // Could be set based on user preferences
                        },
                    });
                }
                return createdAddress;
            });
        });
        return NextResponse.json(result, { status: 201 });
    }
    catch (error) {
        console.error("POST /api/addresses: Critical error:", error);
        // Provide more specific error messages based on error type
        if (error instanceof Error) {
            if (error.message.includes('Unique constraint')) {
                return NextResponse.json({ error: "An address with these details already exists" }, { status: 409 });
            }
            if (error.message.includes('Foreign key constraint')) {
                return NextResponse.json({ error: "Invalid user reference" }, { status: 400 });
            }
        }
        return NextResponse.json({ error: "Failed to create address. Please try again." }, { status: 500 });
    }
}
/**
 * PUT handler for updating an address
 */
export async function PUT(request: NextRequest) {
    try {
        // Authenticate user using multiple methods
        const { user: currentUser, error: authError } = await authenticateUser(request);
        if (authError || !currentUser?.id) {
            console.error("Auth error:", authError);
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Address ID is required" }, { status: 400 });
        }
        // Fetch the address to check ownership
        const existingAddress = await prisma.address.findUnique({
            where: { id },
        });
        if (!existingAddress) {
            return NextResponse.json({ error: "Address not found" }, { status: 404 });
        }
        // Only allow creator or admin to update
        if (existingAddress.createdBy !== currentUser.id) {
            // Check if user is admin (you need to implement this check)
            const isAdmin = await checkIfUserIsAdmin(currentUser.id);
            if (!isAdmin) {
                return NextResponse.json({ error: "Unauthorized to update this address" }, { status: 403 });
            }
        }
        const formData: Partial<AddressFormData> = await request.json();
        // Update the address
        const updatedAddress = await prisma.address.update({
            where: { id },
            data: formData,
        });
        // If the isShared status has changed, update userAddress relations
        if (formData.isShared !== undefined &&
            formData.isShared !== existingAddress.isShared) {
            if (formData.isShared) {
                // If now shared, we could remove userAddress relations if desired
            }
            else {
                // If no longer shared, ensure there's a userAddress relation for the creator
                const userAddressExists = await prisma.userAddress.findFirst({
                    where: {
                        userId: currentUser.id,
                        addressId: id,
                    },
                });
                if (!userAddressExists) {
                    await prisma.userAddress.create({
                        data: {
                            userId: currentUser.id,
                            addressId: id,
                            isDefault: false,
                        },
                    });
                }
            }
        }
        return NextResponse.json(updatedAddress);
    }
    catch (error) {
        console.error("Error updating address:", error);
        return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
    }
}
/**
 * DELETE handler for removing an address
 */
export async function DELETE(request: NextRequest) {
    try {
        // Authenticate user using multiple methods
        const { user: currentUser, error: authError } = await authenticateUser(request);
        if (authError || !currentUser?.id) {
            console.error("Auth error:", authError);
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Address ID is required" }, { status: 400 });
        }
        // Fetch the address to check ownership
        const existingAddress = await prisma.address.findUnique({
            where: { id },
        });
        if (!existingAddress) {
            return NextResponse.json({ error: "Address not found" }, { status: 404 });
        }
        // Only allow creator or admin to delete
        if (existingAddress.createdBy !== currentUser.id) {
            // Check if user is admin
            const isAdmin = await checkIfUserIsAdmin(currentUser.id);
            if (!isAdmin) {
                return NextResponse.json({ error: "Unauthorized to delete this address" }, { status: 403 });
            }
        }
        // Delete any userAddress relations
        await prisma.userAddress.deleteMany({
            where: { addressId: id },
        });
        // Delete the address
        await prisma.address.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting address:", error);
        return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
    }
}
/**
 * Helper function to check if a user has admin privileges
 */
async function checkIfUserIsAdmin(userId: string): Promise<boolean> {
    try {
        const user = await prisma.profile.findUnique({
            where: { id: userId },
        });
        // Compare against the uppercase string literals from Prisma schema
        return user ? (user.type === "ADMIN" || user.type === "SUPER_ADMIN") : false;
    }
    catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}
