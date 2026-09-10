// src/app/api/form-submissions/route.ts

import { NextResponse } from 'next/server';
import { FormSubmissionService } from '@/lib/form-submissions';
import { EmailService } from '@/lib/email-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Add validation for nested fields
    if (!body.formData?.companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    if (!body.formData?.email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // More specific form type validation
    const validFormTypes = ['food', 'flower', 'bakery', 'specialty'];
    const formType = body.formType?.toLowerCase();
    if (!formType || !validFormTypes.includes(formType)) {
      return NextResponse.json(
        { error: `Invalid form type. Valid types are: ${validFormTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.formData?.pickupAddress?.street?.trim()) {
      return NextResponse.json(
        { error: 'Street address is required' },
        { status: 400 }
      );
    }
    
    if (!body.formData?.counties?.length) {
      return NextResponse.json(
        { error: 'At least one county must be selected' },
        { status: 400 }
      );
    }

        const submission = await FormSubmissionService.createSubmission({
      formType,
      formData: body.formData,
    });

        
    // The submission itself is already safe in the database, so a failed
    // notification must not turn into an error for the visitor. It does have to
    // be visible to us though: for a long time this path swallowed the failure
    // entirely, so a quote form that sent no email still reported success and
    // nobody found out until the lead was missed.
    let emailDelivered = true;

    try {
            await EmailService.sendFormSubmissionNotification({
        formType,
        formData: body.formData,
        submissionId: submission.id
      });
    } catch (emailError) {
      emailDelivered = false;
      console.error(
        `[form-submissions] NOTIFICATION EMAIL FAILED for submission ${submission.id} (formType=${formType}) - the submission was saved but nobody was notified:`,
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
      emailDelivered
    });

  } catch (error) {
    console.error('Detailed submission error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit form';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}