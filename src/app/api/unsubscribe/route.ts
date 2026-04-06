// app/api/unsubscribe/route.ts
import { NextResponse } from 'next/server';
import { z } from "zod";

// Types
interface SendGridSearchResponse {
  result: { id: string; email: string; created_at: string }[];
}

// Schema
const EmailSchema = z
  .string()
  .email({ message: "Please enter a valid email address" })
  .transform((email) => email.toLowerCase().trim());

export async function DELETE(request: Request) {
  try {
    // Input validation
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    const emailValidation = EmailSchema.safeParse(email);
    if (!emailValidation.success) {
      return NextResponse.json({
        error: emailValidation.error.issues[0]?.message || "Invalid email address"
      }, {
        status: 400
      });
    }

    // Environment validation
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key is not configured');
      return NextResponse.json({
        error: "Server configuration error. Please try again later."
      }, {
        status: 500
      });
    }

    // SendGrid API configuration
    const sendGridHeaders = {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Step 1: Search for contact
    const searchUrl = 'https://api.sendgrid.com/v3/marketing/contacts/search';
    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: sendGridHeaders,
      body: JSON.stringify({ query: `email LIKE '${emailValidation.data}'` }),
    });

    if (!searchResponse.ok) {
      const status = searchResponse.status;
      const errorMessages: Record<number, string> = {
        400: "Invalid request format. Please try again.",
        401: "Server authentication failed. Please try again later.",
        404: "Email not found in our mailing list.",
        405: "API method not allowed. Please contact support.",
        429: "Too many requests. Please try again in a few minutes.",
        500: "Server error. Please try again later.",
      };
      return NextResponse.json(
        { error: errorMessages[status] ?? "An unexpected error occurred." },
        { status },
      );
    }

    const searchData: SendGridSearchResponse = await searchResponse.json();
    const contacts = searchData.result;

    if (!contacts?.length) {
      return NextResponse.json({
        error: "This email is not subscribed to our newsletter."
      }, {
        status: 404
      });
    }

    // Ensure we have a valid contact with an ID
    const contactId = contacts[0]?.id;
    if (!contactId) {
      return NextResponse.json({
        error: "Invalid contact information."
      }, {
        status: 400
      });
    }

    // Step 2: Delete contact
    const deleteUrl = `https://api.sendgrid.com/v3/marketing/contacts?ids=${contactId}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: sendGridHeaders,
    });

    if (!deleteResponse.ok) {
      const status = deleteResponse.status;
      const errorMessages: Record<number, string> = {
        400: "Invalid request format. Please try again.",
        401: "Server authentication failed. Please try again later.",
        429: "Too many requests. Please try again in a few minutes.",
        500: "Server error. Please try again later.",
      };
      return NextResponse.json(
        { error: errorMessages[status] ?? "An unexpected error occurred." },
        { status },
      );
    }

    // Return 202 to match SendGrid's status code
    if (deleteResponse.status === 202) {
      return NextResponse.json({
        message: "Successfully unsubscribed from the newsletter."
      }, {
        status: 202  // Match SendGrid's status code
      });
    }

    throw new Error('Unexpected response from SendGrid');

  } catch (error) {
    // Log unexpected errors
    console.error('Unexpected error:', error);

    return NextResponse.json({
      error: "An unexpected error occurred. Please try again later."
    }, {
      status: 500
    });
  }
}