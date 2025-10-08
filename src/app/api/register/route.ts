import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from '@prisma/client';
import { UserStatus, UserType, PrismaClientKnownRequestError, PrismaClientInitializationError, PrismaClientValidationError } from '@/types/prisma';
import { randomUUID } from 'crypto';
import { Resend } from "resend";
import { generateUnifiedEmailTemplate, generateDetailsTable, BRAND_COLORS } from "@/utils/email-templates";

// Map between our form input types and the Prisma enum values
const userTypeMap: Record<string, string> = {
  'vendor': 'VENDOR',
  'client': 'CLIENT',
  'driver': 'DRIVER',
  'admin': 'ADMIN',
  'helpdesk': 'HELPDESK',
  'super_admin': 'SUPER_ADMIN'
};

interface BaseFormData {
  email: string;
  password: string;  // Required for registration
  phoneNumber: string;
  userType: string;  // We'll map this to the enum ourselves
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  location_number?: string;
}

interface VendorFormData extends BaseFormData {
  company: string;
  contact_name: string;
  timeNeeded: string[];
  frequency: string;
  parking?: string;
  countiesServed?: string[];
  website?: string;
  cateringBrokerage?: string[];
  provisions?: string[];
}

interface ClientFormData extends BaseFormData {
  company: string;
  contact_name: string;
  timeNeeded: string[];
  frequency: string;
  countiesServed: string[];
  head_count: string;
  parking?: string;
  website?: string;
}

interface DriverFormData extends BaseFormData {
  name: string;
}

interface HelpDeskFormData extends BaseFormData {
  name: string;
}

type RequestBody = VendorFormData | ClientFormData | DriverFormData | HelpDeskFormData;

const resend = new Resend(process.env.RESEND_API_KEY);

const sendWelcomeEmail = async (
  email: string,
  name: string,
  userType: string,
) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const userTypeLabel = userType.charAt(0).toUpperCase() + userType.slice(1);

  // Generate account details table
  const accountDetails = generateDetailsTable([
    { label: 'Email', value: email },
    { label: 'Account Type', value: userTypeLabel },
  ]);

  // Generate content
  const content = `
    <p style="font-size: 16px; color: ${BRAND_COLORS.dark};">Thank you for registering as a <strong>${userTypeLabel}</strong> with Ready Set Platform.</p>

    <h3 style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-top: 25px;">Your account has been created successfully!</h3>
    ${accountDetails}

    <h3 style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-top: 25px;">Next Steps:</h3>
    <ol style="padding-left: 20px; color: ${BRAND_COLORS.dark};">
      <li style="margin-bottom: 10px;">Check your email for the confirmation link from Supabase</li>
      <li style="margin-bottom: 10px;">Click the confirmation link to verify your email address</li>
      <li style="margin-bottom: 10px;">Once verified, you can log in to your account</li>
    </ol>
  `;

  const body = generateUnifiedEmailTemplate({
    title: 'Welcome to Ready Set!',
    greeting: `Hello ${name}! 👋`,
    content,
    ctaUrl: `${siteUrl}/sign-in`,
    ctaText: 'Go to Login Page',
    infoMessage: '<strong>⚠️ Important:</strong> If you didn\'t create this account, please ignore this email or contact our support team.',
    infoType: 'warning',
  });

  try {
    await resend.emails.send({
      to: email,
      from: process.env.EMAIL_FROM || "solutions@updates.readysetllc.com",
      subject: `Welcome to Ready Set - Your ${userTypeLabel} Account is Ready!`,
      html: body,
    });
    console.log(`✅ Welcome email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return false;
  }
};

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { email, password, phoneNumber, userType } = body;

    // Basic field validation
    if (!email || !password || !phoneNumber || !userType) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          missingFields: ["email", "password", "phoneNumber", "userType"].filter(
            (field) => !body[field as keyof RequestBody]
          ),
        },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Additional required fields based on user type
    const commonFields = ["street1", "city", "state", "zip"];
    let requiredFields: string[] = [...commonFields];

    if (userType === "vendor" || userType === "client") {
      requiredFields = [
        ...requiredFields,
        "company",
        "contact_name",
        "timeNeeded",
        "frequency",
      ];
      if (userType === "client") {
        requiredFields.push("countiesServed", "head_count");
      }
    } else if (userType === "driver" || userType === "helpdesk") {
      requiredFields.push("name");
    }

    const missingFields = requiredFields.filter(
      (field) => !(field in body)
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields for ${userType}`,
          missingFields,
        },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // We'll check for existing users in Prisma first
    // Then we'll handle potential conflicts with Supabase during user creation

    // Check for existing user in Prisma
    const existInPrisma = await prisma.profile.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (existInPrisma) {
      return NextResponse.json(
        { error: "User already exists in our system!" },
        { status: 400 }
      );
    }

    // Create user in Supabase with retry mechanism
    console.log('Attempting to create Supabase user with email:', email.toLowerCase());
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    let authData: { user: any } | null = null;
    let authError;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 15000; // 15 seconds base delay
    
    while (retryCount < maxRetries) {
      console.log(`Attempt ${retryCount + 1}: Signing up with email ${email.toLowerCase()}`);
      const result = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          data: {
            userType: userTypeMap[userType] || 'VENDOR',
            name: userType === "driver" || userType === "helpdesk"
              ? (body as DriverFormData | HelpDeskFormData).name
              : (body as VendorFormData | ClientFormData).contact_name,
            company: userType !== "driver" && userType !== "helpdesk"
              ? (body as VendorFormData | ClientFormData).company
              : "",
          }
        }
      });
      
      authData = result.data;
      authError = result.error;
      
      if (!authError) break;
      
      console.log(`Retry attempt ${retryCount + 1} of ${maxRetries}`);
      console.log('Auth error details:', {
        message: authError.message,
        status: authError.status,
        name: authError.name
      });

      // If we get a rate limit error, wait longer
      if (authError.status === 429) {
        const delay = baseDelay + (retryCount * 5000); // Add 5 seconds for each retry
        console.log(`Rate limit hit. Waiting ${delay/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For other errors, wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      retryCount++;
    }

    if (authError) {
      console.error('Supabase auth error after retries:', {
        message: authError.message,
        status: authError.status,
        name: authError.name
      });

      // Check if user already exists
      if (authError.message?.includes('User already registered') || authError.status === 422) {
        return NextResponse.json(
          { error: "Account found", details: "An account with this email already exists. Please try signing in instead." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create user in authentication system", details: authError.message },
        { status: 500 }
      );
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: "Failed to create user account", details: "No user data returned" },
        { status: 500 }
      );
    }

    // Get the Supabase user ID
    const supabaseUserId = authData.user.id;

    // Helper function to safely convert head_count to number
    const parseHeadCount = (value: string | undefined): number | null | undefined => {
      if (value === undefined) return undefined;
      const num = parseInt(value, 10);
      return isNaN(num) ? null : num;
    };

          // Prepare user data for Prisma
    const userData: any = {
      id: supabaseUserId,
      email: email.toLowerCase(),
      contactNumber: phoneNumber,
      type: userType === 'vendor' ? UserType.VENDOR : 
            userType === 'client' ? UserType.CLIENT :
            userType === 'driver' ? UserType.DRIVER :
            userType === 'admin' ? UserType.ADMIN :
            userType === 'helpdesk' ? UserType.HELPDESK :
            userType === 'super_admin' ? UserType.SUPER_ADMIN : 
            UserType.VENDOR,
      name: userType === "driver" || userType === "helpdesk"
          ? (body as DriverFormData | HelpDeskFormData).name
          : (body as VendorFormData | ClientFormData).contact_name,
      companyName: userType !== "driver" && userType !== "helpdesk"
          ? (body as VendorFormData | ClientFormData).company
          : undefined,
      status: UserStatus.PENDING,
      headCount: userType === "client" 
        ? parseInt((body as ClientFormData).head_count) || null
        : undefined,
      street1: body.street1,
      street2: body.street2,
      city: body.city,
      state: body.state,
      zip: body.zip,
      isTemporaryPassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),

      // Conditional fields for vendor and client
      ...(userType !== "driver" && userType !== "helpdesk" && {
        parkingLoading: "parking" in body ? body.parking : undefined,
        counties:
          "countiesServed" in body
            ? ((body as VendorFormData | ClientFormData)?.countiesServed?.join(", ") ?? "")
            : undefined,
        timeNeeded:
          "timeNeeded" in body
            ? (body as VendorFormData | ClientFormData).timeNeeded.join(", ")
            : undefined,
        frequency:
          "frequency" in body
            ? (body as VendorFormData | ClientFormData).frequency
            : undefined,
        website:
          "website" in body
            ? (body as VendorFormData | ClientFormData).website
            : undefined,
        cateringBrokerage:
          "cateringBrokerage" in body
            ? (body as VendorFormData).cateringBrokerage?.join(", ")
            : undefined,
        provide:
          "provisions" in body
            ? (body as VendorFormData).provisions?.join(", ")
            : undefined,
      }),
    };

    // Create the user in Prisma
    const newUser = await prisma.profile.create({
      data: userData,
    });

    // Create default address with explicit ID to avoid null constraint violation
    const addressId = randomUUID();
    const address = await prisma.address.create({
      data: {
        id: addressId,
        name: "Main Address",
        street1: body.street1,
        street2: body.street2,
        city: body.city,
        state: body.state,
        zip: body.zip,
        county:
          userType === UserType.VENDOR || userType === UserType.CLIENT
            ? (body as VendorFormData | ClientFormData).countiesServed?.[0]
            : undefined,
        locationNumber: "location_number" in body ? body.location_number : undefined,
        parkingLoading:
          "parking" in body
            ? (body as VendorFormData | ClientFormData).parking
            : undefined,
        isRestaurant: userType === UserType.VENDOR,
        isShared: false,
        createdBy: newUser.id,
      },
    });

    // Create user-address relation
    await prisma.userAddress.create({
      data: {
        userId: newUser.id,
        addressId: address.id,
        alias: "Main Address",
        isDefault: true,
      },
    });

    // No need to update user metadata here since we included it in the signUp options

    // Send welcome email to the new user
    const userName = userType === "driver" || userType === "helpdesk"
      ? (body as DriverFormData | HelpDeskFormData).name
      : (body as VendorFormData | ClientFormData).contact_name;

    const emailSent = await sendWelcomeEmail(
      email.toLowerCase(),
      userName,
      userType
    );

    console.log(`📧 User registration complete. Email sent: ${emailSent}`);

    return NextResponse.json(
      {
        message: "User created successfully! Please check your email for next steps.",
        userId: newUser.id,
        emailSent: emailSent,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error: "A unique constraint would be violated on the User model. (Duplicate email)",
        },
        { status: 400 }
      );
    }
    
    if (error?.code && error?.message) {
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}