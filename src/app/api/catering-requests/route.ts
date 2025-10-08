import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Decimal } from "@/types/prisma";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { CateringNeedHost } from "@/types/order";
import { localTimeToUtc } from "@/lib/utils/timezone";
import { randomUUID } from "crypto";
import { Resend } from "resend";

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

  const body = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Order Confirmed!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Thank you for your order</p>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #667eea; margin-top: 0;">Hello ${customerName}! 👋</h2>

          <p style="font-size: 16px;">Your catering order has been successfully created and is being processed.</p>

          <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Order Number:</td>
                <td style="padding: 8px 0; color: #333;">${orderDetails.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Order Date:</td>
                <td style="padding: 8px 0; color: #333;">${orderDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Headcount:</td>
                <td style="padding: 8px 0; color: #333;">${orderDetails.headcount} people</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Order Total:</td>
                <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">$${orderDetails.orderTotal}</td>
              </tr>
            </table>
          </div>

          <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Pickup & Delivery Schedule</h3>
            <div style="margin-bottom: 15px;">
              <p style="margin: 5px 0; font-weight: bold; color: #666;">📍 Pickup Location:</p>
              <p style="margin: 5px 0; color: #333;">${orderDetails.pickupAddress}</p>
              <p style="margin: 5px 0; color: #667eea; font-weight: bold;">Pickup Time: ${pickupTimeStr}</p>
            </div>
            <div>
              <p style="margin: 5px 0; font-weight: bold; color: #666;">📍 Delivery Location:</p>
              <p style="margin: 5px 0; color: #333;">${orderDetails.deliveryAddress}</p>
              <p style="margin: 5px 0; color: #667eea; font-weight: bold;">Arrival Time: ${arrivalTimeStr}</p>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}/client/orders/${orderDetails.orderNumber}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View Order Details</a>
          </div>

          <div style="background: #e8f4fd; border: 1px solid #90cdf4; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #2c5282;"><strong>📧 Questions?</strong> Our team is here to help! If you have any questions about your order, please don't hesitate to contact us.</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
            <p>Need help? Contact us at <a href="mailto:support@readysetllc.com" style="color: #667eea;">support@readysetllc.com</a></p>
            <p style="margin: 10px 0;">&copy; ${new Date().getFullYear()} Ready Set LLC. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

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