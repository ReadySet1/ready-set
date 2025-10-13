import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { validateAdminRole } from "@/middleware/authMiddleware";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from '@prisma/client';
import { UserStatus, UserType, PrismaClientKnownRequestError } from '@/types/prisma';
import { sendUserWelcomeEmail } from "@/services/email-notification";

interface AdminRegistrationRequest {
  name: string;
  email: string;
  phoneNumber: string;
  userType: 'driver' | 'helpdesk';
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  password?: string;
  generateTemporaryPassword: boolean;
}

// Email sending is now handled by the unified notification service

export async function POST(request: Request) {
  try {
    // Validate admin role
    const validationError = await validateAdminRole(request);
    if (validationError) return validationError;

    const body: AdminRegistrationRequest = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'email', 'phoneNumber', 'userType', 'street1', 'city', 'state', 'zip'];
    const missingFields = requiredFields.filter(field => !body[field as keyof AdminRegistrationRequest]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", missingFields },
        { status: 400 }
      );
    }

    // Validate password if custom password is provided
    if (!body.generateTemporaryPassword) {
      if (!body.password || body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long" },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await prisma.profile.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists!" },
        { status: 400 }
      );
    }

    // Get password to use
    const password = body.generateTemporaryPassword 
      ? crypto.randomBytes(4).toString("hex") 
      : body.password;
      
    // Create user in Supabase first
    const supabase = await createAdminClient();
    const { data: authData, error: supabaseError } = await supabase.auth.admin.createUser({
      email: body.email.toLowerCase(),
      password: password,
      email_confirm: true
    });

    if (supabaseError) {
      console.error("Error creating user in Supabase:", supabaseError);
      return NextResponse.json(
        { error: "Failed to create user account", details: supabaseError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

          // Create user in your database with the Supabase UUID as the ID
    const userData: any = {
      id: authData.user.id,
      email: body.email.toLowerCase(),
      name: body.name,
      contactNumber: body.phoneNumber,
      type: body.userType.toUpperCase() as UserType,
      status: UserStatus.PENDING,
      street1: body.street1,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      sideNotes: body.notes,
      isTemporaryPassword: body.generateTemporaryPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newUser = await prisma.profile.create({
      data: userData,
    });

    // Create default address
    await prisma.address.create({
      data: {
        name: "Main Address",
        street1: body.street1,
        street2: body.street2,
        city: body.city,
        state: body.state,
        zip: body.zip,
        isRestaurant: false,
        isShared: false,
        createdBy: newUser.id,
      },
    });

    // Create userAddress relation
    const address = await prisma.address.findFirst({
      where: { createdBy: newUser.id },
      select: { id: true },
    });

    if (address) {
      await prisma.userAddress.create({
        data: {
          userId: newUser.id,
          addressId: address.id,
          alias: "Main Address",
          isDefault: true,
        },
      });
    }

    // Send registration email with temporary password if applicable
    let emailSent = false;
    if (newUser.email && body.generateTemporaryPassword) {
      // Only send email with password if using temporary password
      try {
        emailSent = await sendUserWelcomeEmail({
          email: newUser.email,
          name: body.name,
          userType: body.userType as 'driver' | 'helpdesk' | 'admin' | 'super_admin',
          temporaryPassword: password as string,
          isAdminCreated: true,
        });
      } catch (emailError) {
        console.error("Failed to send activation email:", emailError);
        // Don't fail the request if email fails, but log it
        emailSent = false;
      }
    }

    return NextResponse.json(
      {
        message: "User created successfully! Login instructions sent via email.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          type: newUser.type,
        },
        emailSent: emailSent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin registration error:", error);
    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}