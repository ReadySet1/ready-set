import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Decimal } from "@/types/prisma";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { CateringNeedHost } from "@/types/order";
import { localTimeToUtc } from "@/lib/utils/timezone";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { generateUnifiedEmailTemplate, generateDetailsTable, BRAND_COLORS } from "@/utils/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOrderConfirmationEmail = async (
  customerEmail: string,
  customerName: string,
  orderDetails: {
    orderNumber: string;
    orderDate: Date;
    pickupTime: Date;
    arrivalTime: Date;
    pickupAddress: string;
    deliveryAddress: string;
    headcount: number;
    orderTotal: string;
    orderId: string;
  }
) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // Format dates
  const orderDateStr = orderDetails.orderDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pickupTimeStr = orderDetails.pickupTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const arrivalTimeStr = orderDetails.arrivalTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Generate order details table
  const orderDetailsTable = generateDetailsTable([
    { label: 'Order Number', value: orderDetails.orderNumber },
    { label: 'Order Date', value: orderDateStr },
    { label: 'Headcount', value: `${orderDetails.headcount} people` },
    { label: 'Order Total', value: `$${orderDetails.orderTotal}` },
  ]);

  // Generate content
  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.dark};">Your catering order has been successfully created and is being processed by our team.</p>

    <h3 style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-top: 25px;">Order Details</h3>
    ${orderDetailsTable}

    <h3 style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-top: 25px;">Pickup & Delivery Schedule</h3>

    <div style="background: ${BRAND_COLORS.lightGray}; padding: 20px; border-left: 4px solid ${BRAND_COLORS.primary}; border-radius: 6px; margin: 20px 0;">
      <div style="margin-bottom: 20px;">
        <p style="margin: 5px 0; font-weight: bold; color: ${BRAND_COLORS.mediumGray};">📍 Pickup Location:</p>
        <p style="margin: 5px 0; color: ${BRAND_COLORS.dark};">${orderDetails.pickupAddress}</p>
        <p style="margin: 10px 0 0 0; color: ${BRAND_COLORS.dark}; font-weight: bold; background: ${BRAND_COLORS.primary}; display: inline-block; padding: 5px 12px; border-radius: 4px;">⏰ Pickup Time: ${pickupTimeStr}</p>
      </div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${BRAND_COLORS.mediumGray}40;">
        <p style="margin: 5px 0; font-weight: bold; color: ${BRAND_COLORS.mediumGray};">📍 Delivery Location:</p>
        <p style="margin: 5px 0; color: ${BRAND_COLORS.dark};">${orderDetails.deliveryAddress}</p>
        <p style="margin: 10px 0 0 0; color: ${BRAND_COLORS.dark}; font-weight: bold; background: ${BRAND_COLORS.primary}; display: inline-block; padding: 5px 12px; border-radius: 4px;">⏰ Arrival Time: ${arrivalTimeStr}</p>
      </div>
    </div>

    <h3 style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-top: 25px;">What Happens Next?</h3>
    <ol style="padding-left: 20px; color: ${BRAND_COLORS.dark};">
      <li style="margin-bottom: 10px;">Our team will confirm your order and finalize delivery details</li>
      <li style="margin-bottom: 10px;">You'll receive updates on your order status via email</li>
      <li style="margin-bottom: 10px;">Your order will be picked up and delivered on schedule</li>
      <li style="margin-bottom: 10px;">You can track your order anytime in your dashboard</li>
    </ol>
  `;

  const body = generateUnifiedEmailTemplate({
    title: 'Order Confirmed!',
    greeting: `Hello ${customerName}! 👋`,
    content,
    ctaUrl: `${siteUrl}/order-status/${orderDetails.orderNumber}`,
    ctaText: 'View Order Details',
  });

  try {
    await resend.emails.send({
      to: customerEmail,
      from: process.env.EMAIL_FROM || "solutions@updates.readysetllc.com",
      subject: `Order Confirmed - ${orderDetails.orderNumber}`,
      html: body,
    });
    console.log(`✅ Order confirmation email sent successfully to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending order confirmation email:", error);
    return false;
  }
};

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
        id: randomUUID(), // Explicitly generate UUID to fix null constraint violation
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

    // Send order confirmation email to customer
    let emailSent = false;
    try {
      // Fetch customer profile for email and name
      const customerProfile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (customerProfile?.email) {
        // Format address strings
        const pickupAddressStr = `${pickupAddr.street1}${pickupAddr.street2 ? ', ' + pickupAddr.street2 : ''}, ${pickupAddr.city}, ${pickupAddr.state} ${pickupAddr.zip}`;
        const deliveryAddressStr = `${deliveryAddr.street1}${deliveryAddr.street2 ? ', ' + deliveryAddr.street2 : ''}, ${deliveryAddr.city}, ${deliveryAddr.state} ${deliveryAddr.zip}`;

        emailSent = await sendOrderConfirmationEmail(
          customerProfile.email,
          customerProfile.name || 'Customer',
          {
            orderNumber: cateringRequest.orderNumber,
            orderDate: pickupDateTime,
            pickupTime: pickupDateTime,
            arrivalTime: arrivalDateTime,
            pickupAddress: pickupAddressStr,
            deliveryAddress: deliveryAddressStr,
            headcount: cateringRequest.headcount ?? 0,
            orderTotal: cateringRequest.orderTotal?.toString() ?? '0.00',
            orderId: cateringRequest.id,
          }
        );
      }
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
      // Don't fail the request if email fails
      emailSent = false;
    }

    console.log(`📧 Order created successfully. Confirmation email sent: ${emailSent}`);

    return NextResponse.json({
      message: "Catering request created successfully",
      orderId: cateringRequest.id,
      emailSent: emailSent,
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error processing catering request:", error);
    
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to process catering request" },
      { status: 500 }
    );
  }
} 