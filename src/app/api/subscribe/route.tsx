import { NextResponse } from 'next/server';
import { z } from "zod";

const EmailSchema = z
  .string()
  .email({ message: "Please enter a valid email address" });

export async function POST(request: Request) {
  const body = await request.json();

  // Validate email address
  const emailValidation = EmailSchema.safeParse(body.email);
  if (!emailValidation.success) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  // Retrieve SendGrid credentials from environment variables
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const SENDGRID_LIST_ID = process.env.SENDGRID_LIST_ID;

  // Check for required environment variables
  if (!SENDGRID_API_KEY || !SENDGRID_LIST_ID) {
    console.error('SendGrid configuration missing');
    return NextResponse.json({
      error: "Server configuration error. Please try again later."
    }, { status: 500 });
  }

  // Construct SendGrid API request URL
  const url = 'https://api.sendgrid.com/v3/marketing/contacts';

  // Prepare request data for SendGrid
  const data = {
    list_ids: [SENDGRID_LIST_ID],
    contacts: [{ email: emailValidation.data }]
  };

  try {
    // Use PUT instead of POST for the Marketing Contacts API
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    // SendGrid returns 202 Accepted for successful requests
    if (response.status === 202) {
      return NextResponse.json({
        message: "Awesome! You have successfully subscribed!"
      }, { status: 201 });
    }

    if (!response.ok) {
      const status = response.status;
      console.error(`SendGrid API Error: ${status}`);

      const errorMessages: Record<number, string> = {
        400: "Invalid request format. Please check your email address.",
        401: "Server authentication failed. Please try again later.",
        404: "Mailing list not found. Please contact support.",
        405: "API method not allowed. Please contact support.",
      };

      return NextResponse.json(
        { error: errorMessages[status] ?? "Oops! There was an error subscribing you." },
        { status },
      );
    }

    // Handle unexpected success status
    return NextResponse.json({
      error: "Subscription received but unexpected response. Please verify your subscription."
    }, { status: 500 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: "Unexpected system error. Please try again or contact support."
    }, { status: 500 });
  }
}