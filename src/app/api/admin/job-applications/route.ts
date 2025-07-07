import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { ApplicationStatus } from "@/types/job-application";
import { createClient } from "@/utils/supabase/server";

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

// GET handler for fetching job applications with filters and pagination
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid authorization header" },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Fetch user profile to check role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();
      
    if (!userProfile || !userProfile.type || !["ADMIN", "HELPDESK", "SUPER_ADMIN"].includes(userProfile.type)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse URL search params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") as ApplicationStatus | null;
    const position = searchParams.get("position");
    const search = searchParams.get("search");
    const statsOnly = searchParams.get("statsOnly") === "true";

    // Calculate pagination values
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where: any = { deletedAt: null };
    
    if (status) {
      where.status = status;
    }
    
    if (position) {
      where.position = position;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If statsOnly is true, just return the statistics
    if (statsOnly) {
      // Initialize Supabase client for stats
      const supabaseStats = await createClient();
      
      // Use Promise.all for better performance with Supabase
      const [
        totalResult,
        pendingResult,
        approvedResult,
        rejectedResult,
        interviewingResult,
        positionsResult,
        recentResult
      ] = await Promise.all([
        (supabaseStats as any).from('job_applications').select('*', { count: 'exact', head: true }),
        (supabaseStats as any).from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        (supabaseStats as any).from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        (supabaseStats as any).from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED'),
        (supabaseStats as any).from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'INTERVIEWING'),
        (supabaseStats as any).from('job_applications').select('position'),
        (supabaseStats as any).from('job_applications').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      const totalApplications = totalResult.count || 0;
      const pendingApplications = pendingResult.count || 0;
      const approvedApplications = approvedResult.count || 0;
      const rejectedApplications = rejectedResult.count || 0;
      const interviewingApplications = interviewingResult.count || 0;
      const recentApplications = recentResult.data || [];
      
      // Process position counts
      const positionCounts: Record<string, number> = {};
      if (positionsResult.data) {
        positionsResult.data.forEach((app: any) => {
          const pos = app.position;
          positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        });
      }

      const applicationsByPosition = Object.entries(positionCounts).reduce((acc: Record<string, number>, [pos, count]) => {
        acc[pos] = count;
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({
        totalApplications,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        interviewingApplications,
        applicationsByPosition,
        recentApplications
      });
    }

    // Initialize Supabase client
    const supabaseClient = await createClient();

    // Build Supabase query with filters
    let query = (supabaseClient as any)
      .from('job_applications')
      .select(`
        *,
        file_uploads:file_uploads!file_uploads_job_application_id_fkey(
          id, file_name, file_type, file_size, uploaded_at, category
        )
      `)
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (position) {
      query = query.eq('position', position);
    }
    
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Get total count and applications
    const [applicationsResult, countResult] = await Promise.all([
      query,
      (supabaseClient as any)
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
    ]);

    const applications = applicationsResult.data || [];
    const totalCount = countResult.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Process applications to fix file upload inconsistency
    const processedApplications = applications.map((app: any) => {
      const fileUploadCount = app.fileUploads?.length || 0;
      const hasFileUploads = fileUploadCount > 0;
      
      return {
        ...app,
        hasFileUploads,
        fileUploadCount,
        // Add computed field for better debugging
        _fileUploadDebug: {
          actualCount: fileUploadCount,
          hasUploads: hasFileUploads,
          uploadIds: app.fileUploads?.map((f: any) => f.id) || [],
        },
      };
    });

    console.log("API: Fetched applications with corrected fileUploads:", processedApplications.map((app: any) => ({
      id: app.id,
      hasFileUploads: app.hasFileUploads,
      fileUploadCount: app.fileUploadCount,
      actualFileCount: app.fileUploads?.length || 0,
    })));

    return NextResponse.json({
      applications: processedApplications,
      totalCount,
      totalPages,
      currentPage: page
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Error fetching job applications:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch job applications",
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
} 