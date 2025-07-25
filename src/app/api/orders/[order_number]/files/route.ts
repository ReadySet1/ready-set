// src/app/api/orders/[orderNumber]/files/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { UserType } from "@/types/prisma";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  // Add debug logging to see what parameters we're receiving
  console.log("Order files API endpoint called with params:", params);
  
  // Await params before accessing its properties
  const { order_number } = await params;
  
  // Check if order_number exists
  if (!order_number) {
    console.log("Missing order number in params");
    return NextResponse.json(
      { error: "Missing order number parameter" },
      { status: 400 }
    );
  }
  
  const orderNumber = order_number;
  console.log("Processing files request for order:", orderNumber);
  
  try {
    // Initialize Supabase client for auth check
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user || !user.id) {
      console.log("Unauthorized access attempt to files API");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's role from profiles table
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!userProfile) {
      console.log("User profile not found");
      return NextResponse.json({ error: "User profile not found" }, { status: 401 });
    }

    // Allow access for admin, super_admin, and helpdesk roles
    const allowedRoles = [UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HELPDESK] as const;
    const hasAccess = allowedRoles.includes(userProfile.type as typeof allowedRoles[number]);
    
    // Try to fetch the catering request
    console.log("Fetching catering request for", orderNumber);
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
    } else {
      // Try to fetch the on-demand request if catering request not found
      console.log("Catering request not found, trying on_demand");
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
      console.log("Order not found:", orderNumber);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Check if user has access to the files
    if (!hasAccess && user.id !== orderUserId) {
      console.log("User does not have permission to access these files");
      return NextResponse.json(
        { error: "You do not have permission to access these files" },
        { status: 403 }
      );
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
    
    console.log(`Found ${files.length} files for order ${orderNumber}`);
    return NextResponse.json(files);

  } catch (error) {
    console.error("Error processing files request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}