import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { validateAdminRole } from "@/middleware/authMiddleware";
import { Resend } from "resend";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from '@prisma/client';
import { UserStatus, UserType, PrismaClientKnownRequestError } from '@/types/prisma';

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

const resend = new Resend(process.env.RESEND_API_KEY);

const sendRegistrationEmail = async (
  email: string,
  temporaryPassword: string,
) => {
  const body = `
      <h1>Welcome to Ready Set Platform</h1>
      <p>Your account has been successfully created. Here are your login details:</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      <p>For security reasons, you will be required to change your password upon your first login.</p>
      <p>Please click on the following link to log in:</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login">Login</a>
      <p>If you did not request this account, please ignore this email.</p>
    `;

  try {
    await resend.emails.send({
      to: email,
      from: process.env.EMAIL_FROM || "solutions@updates.readysetllc.com",
      subject: "Welcome to Our Platform - Account Created",
      html: body,
    });
    console.log("Registration email sent successfully");
  } catch (error) {
    console.error("Error sending registration email:", error);
    throw new Error("Failed to send registration email");
  }
};

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

    // Check if email exists before sending registration email
    if (newUser.email && body.generateTemporaryPassword) {
      // Only send email with password if using temporary password
      await sendRegistrationEmail(
        newUser.email,
        password as string
      );
    }

    return NextResponse.json(
      {
        message: "User created successfully! Login instructions sent via email.",
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
  } finally {
    await prisma.$disconnect();
  }
}