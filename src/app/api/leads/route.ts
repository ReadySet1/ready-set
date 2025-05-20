import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { Client } from "@sendgrid/client";
import { ClientRequest } from "@sendgrid/client/src/request";
import { sendDownloadEmail } from "@/app/actions/send-download-email";

const prisma = new PrismaClient();
const client = new Client();

// We're still using SendGrid for list management
if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_LIST_ID) {
  throw new Error('SendGrid configuration is missing');
}

client.setApiKey(process.env.SENDGRID_API_KEY);
const WEBSITE_LEADS_LIST_ID = process.env.SENDGRID_LIST_ID;

// Updated schema to include sendEmail flag
const FormSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  industry: z.string(),
  newsletterConsent: z.boolean(),
  resourceSlug: z.string().optional(),
  resourceUrl: z.string().optional(),
  sendEmail: z.boolean().optional().default(true)
});

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const validatedData = FormSchema.parse(data);

    // Store lead in database
    const lead = await prisma.leadCapture.upsert({
      where: {
        email: validatedData.email,
      },
      update: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        industry: validatedData.industry,
        newsletterConsent: validatedData.newsletterConsent,
      },
      create: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        industry: validatedData.industry,
        newsletterConsent: validatedData.newsletterConsent,
      },
    });

    // Handle SendGrid subscription for newsletter
    if (validatedData.newsletterConsent) {
      try {
        const sendgridData = {
          list_ids: [WEBSITE_LEADS_LIST_ID],
          contacts: [
            {
              email: validatedData.email.toLowerCase(),
              first_name: validatedData.firstName,
              last_name: validatedData.lastName,
              custom_fields: {
                industry: validatedData.industry,
              },
            },
          ],
        };

        const request: ClientRequest = {
          url: `/v3/marketing/contacts`,
          method: 'PUT' as const,
          body: sendgridData,
        };

        const [response, body] = await client.request(request);

        if (response.statusCode === 202) {
          console.log('Contact queued for processing', {
            jobId: body.job_id,
            email: validatedData.email,
          });
        } else {
          console.error('SendGrid unexpected status:', response.statusCode);
        }
      } catch (error) {
        // Log the error but don't throw it
        console.error('SendGrid subscription error:', {
          error,
          email: validatedData.email,
        });
      }
    }

    // Handle resource download email using Resend - only send if sendEmail flag is true
    if (validatedData.resourceSlug && validatedData.sendEmail) {
      try {
        await sendDownloadEmail(
          validatedData.email,
          validatedData.firstName,
          validatedData.resourceSlug,
          validatedData.resourceUrl
        );
      } catch (error) {
        // Log the error but don't throw it
        console.error('Download email failed:', { error });
      }
    }

    // Return success even if email operations fail
    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error in leads API:', error);
    return NextResponse.json(
      { error: 'Failed to process lead capture' },
      { status: 500 }
    );
  }
}