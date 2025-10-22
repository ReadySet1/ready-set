import { NextRequest, NextResponse } from "next/server";
import { prisma, withDatabaseRetry } from "@/utils/prismaDB";
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
      // Use Promise.all for better performance
      const [
        totalApplications,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        interviewingApplications,
        positionCounts,
        recentApplications
      ] = await Promise.all([
        prisma.jobApplication.count({
          where: { deletedAt: null }
        }),
        prisma.jobApplication.count({
          where: { 
            deletedAt: null,
            status: ApplicationStatus.PENDING
          }
        }),
        prisma.jobApplication.count({
          where: { 
            deletedAt: null,
            status: ApplicationStatus.APPROVED
          }
        }),
        prisma.jobApplication.count({
          where: { 
            deletedAt: null,
            status: ApplicationStatus.REJECTED
          }
        }),
        prisma.jobApplication.count({
          where: { 
            deletedAt: null,
            status: ApplicationStatus.INTERVIEWING
          }
        }),
        prisma.jobApplication.groupBy({
          by: ['position'],
          _count: {
            position: true
          },
          where: { deletedAt: null }
        }),
        prisma.jobApplication.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      ]);

      const applicationsByPosition = positionCounts.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.position] = curr._count.position;
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

    // Get total count and applications with retry logic
    const [totalCount, applications] = await withDatabaseRetry(async () => {
      return Promise.all([
        prisma.jobApplication.count({ where }),
        prisma.jobApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            fileUploads: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                fileUrl: true,
                uploadedAt: true,
                category: true,
              },
            },
          },
        })
      ]);
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Initialize admin Supabase client for generating signed URLs
    const { createAdminClient } = await import('@/utils/supabase/server');
    const supabaseAdmin = await createAdminClient();

    // Process applications to fix file upload inconsistency and generate signed URLs
    const processedApplications = await Promise.all(applications.map(async (app: any) => {
      const fileUploadCount = app.fileUploads?.length || 0;
      const hasFileUploads = fileUploadCount > 0;

      // Generate fresh signed URLs for all files
      const fileUploadsWithSignedUrls = await Promise.all(
        (app.fileUploads || []).map(async (file: any) => {
          // Extract bucket name and path from the existing fileUrl
          let signedUrl = file.fileUrl; // Default to original URL

          try {
            const urlObj = new URL(file.fileUrl);
            const pathParts = urlObj.pathname.split('/');

            // Find the bucket name and file path
            if (pathParts.length > 6 && pathParts[1] === 'storage' && pathParts[4] === 'public') {
              const bucketName = pathParts[5];
              const filePath = pathParts.slice(6).join('/');

              if (bucketName) {
                // Generate a signed URL (valid for 1 hour)
                const { data: signedData, error: signedError } = await supabaseAdmin.storage
                  .from(bucketName)
                  .createSignedUrl(filePath, 3600); // 1 hour expiry

                if (!signedError && signedData?.signedUrl) {
                  signedUrl = signedData.signedUrl;
                }
              }
            }
          } catch (error) {
            console.error('Error generating signed URL for file:', file.id, error);
          }

          return {
            ...file,
            fileUrl: signedUrl, // Replace with signed URL
          };
        })
      );

      return {
        ...app,
        fileUploads: fileUploadsWithSignedUrls,
        hasFileUploads,
        fileUploadCount,
        // Add computed field for better debugging
        _fileUploadDebug: {
          actualCount: fileUploadCount,
          hasUploads: hasFileUploads,
          uploadIds: app.fileUploads?.map((f: any) => f.id) || [],
        },
      };
    }));

    
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