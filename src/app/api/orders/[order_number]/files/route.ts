// src/app/api/orders/[orderNumber]/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from "@/types/prisma";
export async function GET(request: NextRequest, { params }: {
    params: Promise<{
        order_number: string;
    }>;
}) {
    // Await params before accessing its properties and decode the order number
    const { order_number: encodedOrderNumber } = await params;
    const order_number = decodeURIComponent(encodedOrderNumber);
    // Check if order_number exists
    if (!order_number) {
        return NextResponse.json({ error: "Missing order number parameter" }, { status: 400 });
    }
    const orderNumber = order_number;
    try {
        // Initialize Supabase client for auth check
        const supabase = await createClient();
        // Get user session from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        // Check if user is authenticated
        if (!user || !user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Get user's role from profiles table
        const userProfile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { type: true }
        });
        if (!userProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 401 });
        }
        // Allow access for admin, super_admin, and helpdesk roles
        const allowedRoles = [UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HELPDESK] as const;
        const hasAccess = allowedRoles.includes(userProfile.type as typeof allowedRoles[number]);
        const cateringRequest = await prisma.cateringRequest.findFirst({
            where: {
                orderNumber: {
                    equals: orderNumber,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                userId: true
            }
        });
        let orderId: string | null = null;
        let orderUserId: string | null = null;
        if (cateringRequest) {
            orderId = cateringRequest.id;
            orderUserId = cateringRequest.userId;
        }
        else {
            const onDemandRequest = await prisma.onDemand.findFirst({
                where: {
                    orderNumber: {
                        equals: orderNumber,
                        mode: 'insensitive'
                    }
                },
                select: {
                    id: true,
                    userId: true
                }
            });
            if (onDemandRequest) {
                orderId = onDemandRequest.id;
                orderUserId = onDemandRequest.userId;
            }
        }
        if (!orderId) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // Check if user has access to the files
        if (!hasAccess && user.id !== orderUserId) {
            return NextResponse.json({ error: "You do not have permission to access these files" }, { status: 403 });
        }
        // Fetch files for the order
        const files = await prisma.fileUpload.findMany({
            where: {
                OR: [
                    { cateringRequestId: orderId },
                    { onDemandId: orderId },
                    {
                        OR: [
                            {
                                category: "catering-order",
                                cateringRequestId: orderId
                            },
                            {
                                category: "on-demand",
                                onDemandId: orderId
                            }
                        ]
                    }
                ]
            },
            orderBy: {
                uploadedAt: 'desc'
            }
        });
        return NextResponse.json(files);
    }
    catch (error) {
        console.error("Error processing files request:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
