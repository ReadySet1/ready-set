import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Decimal } from "@/types/prisma";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { CateringNeedHost } from "@/types/order";
import { localTimeToUtc } from "@/lib/utils/timezone";

// Validates and processes a catering request submission
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const data = await request.json();
    console.log("Received catering request:", {
      ...data,
      attachments: data.attachments?.length || 0,
    });

    // Use the client ID from the request if in admin mode, otherwise use the authenticated user's ID
    const userId = data.clientId || user.id;

    // Validate required fields
    const requiredFields = [
      "orderNumber",
      "brokerage",
      "date",
      "pickupTime",
      "arrivalTime",
      "headcount",
      "needHost",
      "clientAttention",
      "orderTotal",
      "pickupAddress.id",
      "deliveryAddress.id",
    ];

    // Add host-specific required fields if needHost is YES
    if (data.needHost === CateringNeedHost.YES) {
      requiredFields.push("hoursNeeded", "numberOfHosts");
    }

    // Check for missing fields
    const missingFields: string[] = [];
    requiredFields.forEach((field) => {
      // Handle nested fields like pickupAddress.id
      if (field.includes('.')) {
        const parts = field.split('.');
        const parent = parts[0];
        const child = parts[1];
        
        if (
          parent === undefined || 
          child === undefined || 
          !data[parent] || 
          typeof data[parent] !== 'object' || 
          data[parent] === null || 
          !(child in data[parent])
        ) {
          missingFields.push(field);
        }
      } else if (data[field] === undefined || data[field] === null || data[field] === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { message: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Check for existing order number
    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { orderNumber: data.orderNumber },
    });

    if (existingOrder) {
      return NextResponse.json(
        { message: "This order number already exists" },
        { status: 409 }
      );
    }

    // Validate address IDs
    const pickupAddr = await prisma.address.findUnique({
      where: { id: data.pickupAddress.id },
    });
    
    if (!pickupAddr) {
      return NextResponse.json(
        { message: `Pickup address with ID ${data.pickupAddress.id} not found` },
        { status: 400 }
      );
    }
    
    const deliveryAddr = await prisma.address.findUnique({
      where: { id: data.deliveryAddress.id },
    });
    
    if (!deliveryAddr) {
      return NextResponse.json(
        { message: `Delivery address with ID ${data.deliveryAddress.id} not found` },
        { status: 400 }
      );
    }

    // Parse date and time fields with proper timezone conversion
    const pickupDateTime = new Date(localTimeToUtc(data.date, data.pickupTime));
    const arrivalDateTime = new Date(localTimeToUtc(data.date, data.arrivalTime));
    const completeDateTime = data.completeTime
      ? new Date(localTimeToUtc(data.date, data.completeTime))
      : null;

    // Convert numeric values
    const headcount = parseInt(data.headcount, 10);
    const orderTotal = new Decimal(data.orderTotal);
    const tip = data.tip ? new Decimal(data.tip) : new Decimal(0);
    
    let hoursNeeded = null;
    let numberOfHosts = null;
    
    if (data.needHost === CateringNeedHost.YES) {
      hoursNeeded = parseFloat(data.hoursNeeded);
      numberOfHosts = parseInt(data.numberOfHosts, 10);
    }

    // Create catering request in the database
    const cateringRequest = await prisma.cateringRequest.create({
      data: {
        userId,
        brokerage: data.brokerage,
        orderNumber: data.orderNumber,
        pickupAddressId: data.pickupAddress.id,
        deliveryAddressId: data.deliveryAddress.id,
        pickupDateTime,
        arrivalDateTime,
        completeDateTime,
        headcount,
        needHost: data.needHost,
        hoursNeeded,
        numberOfHosts,
        clientAttention: data.clientAttention,
        pickupNotes: data.pickupNotes,
        specialNotes: data.specialNotes,
        orderTotal,
        tip,
        status: "ACTIVE",
      },
    });

    // Process file attachments if present
    if (data.attachments?.length > 0) {
      console.log(`Processing ${data.attachments.length} file attachments`);
      
      // Create file upload records for each attachment
      for (const attachment of data.attachments) {
        await prisma.fileUpload.create({
          data: {
            cateringRequestId: cateringRequest.id,
            userId,
            fileName: attachment.name,
            fileUrl: attachment.url || attachment.key,
            fileSize: attachment.size,
            fileType: attachment.type,
            category: "catering",
            isTemporary: false,
          },
        });
      }
    }

    return NextResponse.json({ 
      message: "Catering request created successfully", 
      orderId: cateringRequest.id,
      orderNumber: cateringRequest.orderNumber
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error processing catering request:", error);
    
    // Handle different types of errors with user-friendly messages
    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('required') || error.message.includes('invalid')) {
        return NextResponse.json(
          { 
            message: "Please check your form data and try again.",
            details: error.message,
            type: "validation_error"
          },
          { status: 400 }
        );
      }
      
      // Handle authentication errors
      if (error.message.includes('authenticate') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { 
            message: "Please sign in to submit a catering request.",
            type: "auth_error"
          },
          { status: 401 }
        );
      }
      
      // Handle duplicate order number
      if (error.message.includes('unique constraint') || error.message.includes('duplicate')) {
        return NextResponse.json(
          { 
            message: "This order number already exists. Please use a different order number.",
            type: "duplicate_error"
          },
          { status: 409 }
        );
      }
      
      // Handle database connection errors
      if (error.message.includes('connect') || error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            message: "We're experiencing technical difficulties. Please try again in a moment.",
            type: "connection_error"
          },
          { status: 503 }
        );
      }
    }
    
    // Generic error fallback
    return NextResponse.json(
      { 
        message: "We encountered an unexpected error. Please try again or contact support if the problem persists.",
        type: "server_error"
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 