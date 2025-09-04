import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { ApplicationStatus } from "@/types/job-application";
import { createClient } from "@/utils/supabase/server";
import { loggers } from '@/utils/logger';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function PATCH(
  request: NextRequest, 
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = params.id;
    
    loggers.app.debug('Request headers:', Object.fromEntries(request.headers.entries()));
    
        let requestBody;
    try {
      requestBody = await request.json();
      loggers.app.debug('Parsed request body:', requestBody);
    } catch (error) {
      loggers.app.debug('Error parsing request body:', error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    // Check if request body is empty
    if (!requestBody || Object.keys(requestBody).length === 0) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      );
    }
    
    const { status, feedbackNote } = requestBody;
    
    // Check if status is provided
    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }
    
    // Check if user is authorized (admin or helpdesk)
    const supabase = await createClient();
    
    // Try to get auth token from header first
    const authHeader = request.headers.get('authorization');
    let user;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token);
      if (error) {
        console.error('Token auth error:', error);
      }
      user = tokenUser;
    } else {
      // Fallback to session-based auth
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      user = sessionUser;
    }
    
    if (!user || !user.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Fetch user profile to check role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('type')
      .eq('email', user.email)
      .single();
    
    const userType = userProfile?.type?.toUpperCase() || '';
      
    if (!userProfile || !["ADMIN", "HELPDESK", "SUPER_ADMIN"].includes(userType)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Validate the input
    loggers.app.debug('Status received:', status);
    loggers.app.debug('ApplicationStatus values:', Object.values(ApplicationStatus));
    loggers.app.debug('Is status valid:', Object.values(ApplicationStatus).includes(status as ApplicationStatus));
    
    if (!Object.values(ApplicationStatus).includes(status as ApplicationStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Find the application to ensure it exists
    const application = await prisma.jobApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return NextResponse.json(
        { error: "Job application not found" },
        { status: 404 }
      );
    }

    // Update the application status
    const updatedApplication = await prisma.jobApplication.update({
      where: { id },
      data: {
        status: status as ApplicationStatus,
        // If there's a way to store feedback in your schema, add it here
      }
    });

    return NextResponse.json({
      success: true,
      application: updatedApplication
    });
  } catch (error) {
    console.error("Error updating application status:", error);
    return NextResponse.json(
      { error: "Failed to update job application status" },
      { status: 500 }
    );
  }
}