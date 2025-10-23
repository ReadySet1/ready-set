// src/app/api/file-uploads/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { STORAGE_BUCKETS, initializeStorageBuckets, diagnoseStorageIssues } from "@/utils/file-service";
import { prisma } from "@/utils/prismaDB";
import { v4 as uuidv4 } from 'uuid';
import {
  UploadErrorHandler,
  RetryHandler,
  FileValidator,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_VALIDATION_CONFIG
} from "@/lib/upload-error-handler";
import { UploadSecurityManager } from "@/lib/upload-security";
import { UploadErrorType } from "@/types/upload";
import type { Database } from '@/types/supabase';

// Type definitions for application_sessions
type ApplicationSession = Database['public']['Tables']['application_sessions']['Row'];

// Helper function to safely extract error message from unknown error
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
  }
  return String(error || 'Unknown error');
}

// Add a new route to get a signed URL for a file
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
    
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }
    
    // First try to create a signed URL (works for private buckets)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKETS.DEFAULT)
      .createSignedUrl(path, 60 * 30); // 30 minutes expiration
    
    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      // Fall back to public URL if signed URL fails
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.DEFAULT)
        .getPublicUrl(path);
      
      return NextResponse.json({
        url: publicUrl,
        isPublic: true
      });
    }
    
    return NextResponse.json({
      url: signedUrlData.signedUrl,
      isPublic: false,
      expiresIn: '30 minutes'
    });
  } catch (error: any) {
    console.error('Error generating file URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate file URL', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  // Parse form data first to avoid issues with error handling
  const formData = await request.formData();

  // Extract important data from the form
  let file = formData.get("file") as File;
  const entityId = formData.get("entityId") as string;
  let entityType = (formData.get("entityType") as string) || "job_application"; // Default value
  const category = (formData.get("category") as string) || "";

  // Store session info for later use
  let validatedSession: { id: string; session_token: string } | null = null;

  try {
    // ===== SESSION VALIDATION (Security Enhancement) =====
    // Validate upload session token for job applications
    if (entityType === "job_application" || category.startsWith("job-applications")) {
      const sessionToken = request.headers.get('x-upload-token');

      if (!sessionToken) {
        return NextResponse.json(
          {
            error: 'Authentication required',
            errorType: 'AUTH_REQUIRED',
            message: 'Upload session token is required. Please start a new application session.'
          },
          { status: 401 }
        );
      }

      // Validate session
      const supabase = await createClient();
      const { data: session, error: sessionError } = await supabase
        .from('application_sessions')
        .select('id, session_token, session_expires_at, upload_count, max_uploads, completed')
        .eq('session_token', sessionToken)
        .single<Pick<ApplicationSession, 'id' | 'session_token' | 'session_expires_at' | 'upload_count' | 'max_uploads' | 'completed'>>();

      if (sessionError || !session) {
        console.error('Session validation error:', sessionError);
        return NextResponse.json(
          {
            error: 'Invalid or expired session',
            errorType: 'INVALID_SESSION',
            message: 'Your upload session is invalid. Please start a new application.'
          },
          { status: 401 }
        );
      }

      // Check if session is expired
      if (new Date(session.session_expires_at) < new Date()) {
        return NextResponse.json(
          {
            error: 'Session expired',
            errorType: 'SESSION_EXPIRED',
            message: 'Your upload session has expired. Please start a new application.'
          },
          { status: 401 }
        );
      }

      // Check upload limit
      if (session.upload_count >= session.max_uploads) {
        return NextResponse.json(
          {
            error: 'Upload limit exceeded',
            errorType: 'UPLOAD_LIMIT_EXCEEDED',
            message: `Maximum uploads (${session.max_uploads}) reached for this session.`
          },
          { status: 429 }
        );
      }

      // Check if session is already completed
      if (session.completed) {
        return NextResponse.json(
          {
            error: 'Session completed',
            errorType: 'SESSION_COMPLETED',
            message: 'This application session is already completed.'
          },
          { status: 400 }
        );
      }

      // Store validated session info
      validatedSession = { id: session.id, session_token: session.session_token };
    }
    // ===== END SESSION VALIDATION =====

    // Initialize storage buckets to ensure they exist before upload
    try {
      await initializeStorageBuckets();
    } catch (initError) {
      console.error("Error initializing storage buckets:", initError);
      // Continue anyway - bucket creation errors shouldn't prevent uploads if buckets already exist
    }

    // Sanitize the filename before validation to avoid rejecting files with special characters
    const sanitizedFilename = FileValidator.sanitizeFilename(file.name);
    if (sanitizedFilename !== file.name) {
      // Create a new File object with the sanitized name
      file = new File([file], sanitizedFilename, { type: file.type });
    }

    // Check rate limit for uploads
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const rateLimitPassed = await UploadSecurityManager.checkRateLimit(userId, 'UPLOAD');
    if (!rateLimitPassed) {
      const rateLimitError = UploadErrorHandler.createValidationError(
        'content',
        'Rate limit exceeded for file uploads',
        'Too many upload attempts. Please wait a moment and try again.',
        { userId, action: 'UPLOAD' }
      );

      UploadErrorHandler.logError(rateLimitError, { fileName: file.name, entityId, entityType });
      await UploadErrorHandler.reportError(rateLimitError);

      return NextResponse.json(
        {
          error: rateLimitError.userMessage,
          errorType: rateLimitError.type,
          correlationId: rateLimitError.correlationId,
          retryable: rateLimitError.retryable,
          retryAfter: 60000
        },
        { status: 429 }
      );
    }

    // Enhanced validation with new error handling system
    const validationError = FileValidator.validateFile(file, DEFAULT_VALIDATION_CONFIG);
    if (validationError) {
      UploadErrorHandler.logError(validationError, { fileName: file.name, entityId, entityType });
      await UploadErrorHandler.reportError(validationError);

      return NextResponse.json(
        {
          error: validationError.userMessage,
          errorType: validationError.type,
          correlationId: validationError.correlationId,
          retryable: validationError.retryable
        },
        { status: 400 }
      );
    }

    // Security validation
    const securityCheck = await UploadSecurityManager.validateFileSecurity(file, userId);
    if (!securityCheck.isSecure) {
      UploadErrorHandler.logError(securityCheck.error!, {
        fileName: file.name,
        entityId,
        entityType,
        scanResults: securityCheck.scanResults
      });
      await UploadErrorHandler.reportError(securityCheck.error!);

      return NextResponse.json(
        {
          error: securityCheck.error!.userMessage,
          errorType: securityCheck.error!.type,
          correlationId: securityCheck.error!.correlationId,
          retryable: securityCheck.error!.retryable,
          retryAfter: securityCheck.error!.retryAfter,
          quarantined: securityCheck.quarantineRequired
        },
        { status: 403 }
      );
    }

    // Ensure job-applications/temp paths are properly handled
    let uploadPath = "temp";
    
    // Special handling for job application categories with the new path structure
    if (category.startsWith("job-applications/temp/")) {
      uploadPath = category; // Use the full path as provided 
          } else if (category) {
      // For other categories, make a simple prefix/category hierarchy
      uploadPath = `${category}`;
    }
    
        
    const bucketName = (formData.get("bucketName") as string);
    
    // Normalize category if provided
    const normalizedCategory = category.toLowerCase();
    
    // Correct entityType based on category if needed
    // This helps ensure consistent entity types
    if (normalizedCategory === "catering-order") {
      entityType = "catering";
          } else if (normalizedCategory === "on-demand") {
      entityType = "on_demand";
          }
    
    
    // Basic validation
    if (!file) {
            return NextResponse.json(
        { error: "Missing required field: file" },
        { status: 400 },
      );
    }

    // Get the Supabase client for storage
    const supabase = await createClient();

    // Handle entity IDs in a consistent way
    // Don't add temp- prefix to IDs that already have temp_ prefix (job applications)
    let finalEntityId = '';
    if (entityId) {
      if (entityId.startsWith('temp_') || entityId.startsWith('temp-')) {
        // For temporary IDs, use as-is
        finalEntityId = entityId;
              } else {
        // For normal IDs, use directly without temp prefix
        finalEntityId = entityId;
      }
    } else {
      // Generate a new temporary ID if none provided
      finalEntityId = `temp-${Date.now()}-${uuidv4().substring(0, 8)}`;
    }
    
        
    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;

    // Create a structured path based on entityType
    let filePath;
    let storageBucket = (bucketName || STORAGE_BUCKETS.DEFAULT) as string;
    
    // Convert entityType to a consistent format
    const normalizedEntityType = entityType.toLowerCase();
        
    // Determine which bucket and path to use based on entity type
    if (normalizedEntityType === "catering") {
      // Consistent path for catering orders
      filePath = `orders/catering/${finalEntityId}/${fileName}`;
          } 
    else if (normalizedEntityType === "on_demand") {
      // Consistent path for on-demand orders  
      filePath = `orders/on-demand/${finalEntityId}/${fileName}`;
          }
    else if (normalizedEntityType === "job_application") {
      // For job application type, prioritize validated session
      if (validatedSession) {
        // Use session ID for secure, tracked uploads
        filePath = `job-applications/temp/${validatedSession.id}/${fileName}`;
      } else if (finalEntityId.startsWith('temp_') || finalEntityId.startsWith('temp-')) {
        // Skip UUID validation for temp job application IDs (legacy)
                filePath = `job-applications/temp/${finalEntityId}/${fileName}`;
      } else {
        // Only try to validate as UUID for non-temp IDs
        try {
          const jobApp = await prisma.jobApplication.findUnique({
            where: { id: finalEntityId }
          });
          
          if (jobApp) {
                        filePath = `job-applications/${jobApp.id}/${fileName}`;
          } else {
            // Check if we have a specific upload path from the category
            if (uploadPath && uploadPath.startsWith("job-applications/temp/")) {
                            filePath = `${uploadPath}/${finalEntityId}/${fileName}`;
            }
            // If category suggests this is a catering order but tagged as job application
            else if (normalizedCategory === "catering-order") {
                            filePath = `orders/catering/${finalEntityId}/${fileName}`;
            } else if (normalizedCategory === "on-demand") {
                            filePath = `orders/on-demand/${finalEntityId}/${fileName}`;
            } else {
                            filePath = `job-applications/temp/${finalEntityId}/${fileName}`;
            }
          }
        } catch (error) {
          console.error("Error checking job application:", error);
          filePath = `job-applications/temp/${finalEntityId}/${fileName}`;
        }
      }
    }
    else if (normalizedEntityType === "user") {
      // Consistent path for user files
      filePath = `users/${finalEntityId}/${fileName}`;
          }
    // Default handling for other types
    else {
      filePath = `${normalizedEntityType || 'general'}/${finalEntityId}/${fileName}`;
    }

    // If bucketName was explicitly provided in the request, use that
    if (bucketName) {
      storageBucket = bucketName;
    }


    // Simplified bucket verification - removed diagnostic call to reduce log noise
    let bucketVerified = false;

    // Try to verify the bucket exists and is accessible
    try {
      const { data, error: listError } = await supabase.storage
        .from(storageBucket)
        .list();

      if (!listError && data !== null) {
        bucketVerified = true;
      } else {
        // If verification fails, try fallback to DEFAULT bucket
        if (storageBucket !== STORAGE_BUCKETS.DEFAULT) {
          storageBucket = STORAGE_BUCKETS.DEFAULT;
          const { error: defaultError } = await supabase.storage.from(storageBucket).list();
          if (!defaultError) {
            bucketVerified = true;
          }
        }
      }
    } catch (bucketError) {
      // Silently try default bucket as fallback
      if (storageBucket !== STORAGE_BUCKETS.DEFAULT) {
        storageBucket = STORAGE_BUCKETS.DEFAULT;
        try {
          const { error: fallbackError } = await supabase.storage.from(storageBucket).list();
          if (!fallbackError) {
            bucketVerified = true;
          }
        } catch {
          // Ignore fallback errors - upload will handle it
        }
      }
    }

    // Upload the file with retry logic and enhanced error handling
    let storageData: any, storageError: { message?: string } | null = null;

    // Multiple upload strategies in case Supabase storage fails
    const uploadStrategies = [
      // Strategy 1: Try Supabase storage with current bucket
      async () => {
                const result = await supabase.storage
          .from(storageBucket)
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
          });

        if (result.error) {
          throw result.error;
        }

        return result;
      },

      // Strategy 2: Try with default bucket if current bucket fails
      async () => {
        if (storageBucket !== STORAGE_BUCKETS.DEFAULT) {
                    const result = await supabase.storage
            .from(STORAGE_BUCKETS.DEFAULT)
            .upload(filePath, file, {
              upsert: true,
              contentType: file.type,
            });

          if (result.error) {
            throw result.error;
          }

          return result;
        }
        throw new Error('Default bucket already tried');
      }
    ];

    let lastError;

    for (const strategy of uploadStrategies) {
      try {
        const result = await RetryHandler.withRetry(
          strategy,
          {
            ...DEFAULT_RETRY_CONFIG,
            maxAttempts: 2,
            baseDelay: 1000
          },
          (error, attempt) => {
                      }
        );

        storageData = result.data;
        storageError = result.error;
        break; // Success, exit the strategy loop

      } catch (error) {
        lastError = error;
        const errorMessage = getErrorMessage(error);
        console.error(`Upload strategy failed:`, errorMessage);

        // If this is a bucket not found error, try the next strategy
        if (errorMessage.includes('Bucket not found') && strategy !== uploadStrategies[uploadStrategies.length - 1]) {
                    continue;
        }

        // For other errors, we might want to stop trying
        storageError = { message: errorMessage };
        break;
      }
    }

    // If all strategies failed, use the last error
    if (!storageData && lastError) {
      storageError = { message: getErrorMessage(lastError) };
    }

    if (storageError) {
      console.error("Storage upload error after retries:", storageError);

      // Use enhanced error categorization
      const uploadError = UploadErrorHandler.categorizeError(storageError, file);

      // Log and report the error
      UploadErrorHandler.logError(uploadError, {
        fileName: file.name,
        filePath,
        bucket: storageBucket,
        entityId,
        entityType
      });
      await UploadErrorHandler.reportError(uploadError);

      return NextResponse.json(
        {
          error: uploadError.userMessage,
          errorType: uploadError.type,
          correlationId: uploadError.correlationId,
          retryable: uploadError.retryable,
          retryAfter: uploadError.retryAfter,
          details: {
            bucket: storageBucket,
            filePath,
            fileName: file.name,
            fileSize: file.size
          }
        },
        { status: uploadError.type === UploadErrorType.PERMISSION_ERROR ? 403 : 500 },
      );
    }

    // Get public URL for the file
    const {
      data: { publicUrl },
    } = supabase.storage.from(storageBucket).getPublicUrl(filePath);

    const finalUrl = publicUrl;

    // Prepare database record data based on entityType
    const dbData: any = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileUrl: finalUrl,
      uploadedAt: new Date(),
      updatedAt: new Date(),
      category: normalizedCategory,
      // Set isTemporary flag based on entityId format
      isTemporary: finalEntityId ? (finalEntityId.startsWith('temp_') || finalEntityId.startsWith('temp-')) : true,
      // Set all IDs to null by default
      cateringRequestId: null,
      onDemandId: null,
      jobApplicationId: null,
      userId: null
    };

    // CRITICAL FIX: Set the proper foreign key based on either category or entityType
    // This ensures files are associated with the correct records
        
    try {
      // First, prioritize category for determining the correct foreign key
      if (normalizedCategory === "catering-order" || normalizedCategory === "catering" || entityType === "catering") {
                
        // Only set cateringRequestId if it's NOT a temporary ID
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
                    dbData.cateringRequestId = finalEntityId;
          
          // Double-check the catering request exists
          try {
            const cateringRequest = await prisma.cateringRequest.findUnique({
              where: { id: finalEntityId }
            });
            
            if (cateringRequest) {
                            // Make sure category is set consistently to improve retrieval
              dbData.category = "catering-order";
              dbData.isTemporary = false;
            } else {
              console.warn(`Catering request with ID ${finalEntityId} not found in database`);
              dbData.isTemporary = true;
              // Clear the ID to avoid database errors
              dbData.cateringRequestId = null;
            }
          } catch (err) {
            console.error("Error verifying catering request:", err);
            dbData.isTemporary = true;
            // Clear the ID to avoid database errors
            dbData.cateringRequestId = null;
          }
        } else if (finalEntityId) {
                    // For temporary IDs, mark the file as temporary and do NOT set the cateringRequestId
          dbData.isTemporary = true;
          dbData.cateringRequestId = null;
          dbData.category = "catering-order";
        }
      } else if (normalizedCategory === "on-demand" || entityType === "on_demand") {
        // Similar logic for on-demand requests
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
                    dbData.onDemandId = finalEntityId;
          dbData.isTemporary = false;
        } else if (finalEntityId) {
                    dbData.isTemporary = true;
          dbData.onDemandId = null;
          // Store in category for retrieval
          dbData.category = `on-demand`;
        }
      } else if (entityType === "job_application") {
        // Only set jobApplicationId if it's really a job application (verified earlier)
        // Skip UUID validation completely for temp_ format IDs
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
          try {
            const jobApp = await prisma.jobApplication.findUnique({
              where: { id: finalEntityId }
            });
            
            if (jobApp) {
                            dbData.jobApplicationId = finalEntityId;
              dbData.isTemporary = false;
            } else {
                            dbData.jobApplicationId = null;
              dbData.isTemporary = true;
              // Keep the original category rather than modifying it
            }
          } catch (error) {
                        dbData.jobApplicationId = null;
            dbData.isTemporary = true;
          }
        } else if (finalEntityId) {
          // For temp IDs, don't try to look up in database at all
                    dbData.jobApplicationId = null;
          dbData.isTemporary = true;
          // Keep the original category rather than modifying it
        }
      } else if (entityType === "user") {
        // For user files, we need to set the userId field
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
                    dbData.userId = finalEntityId;
          
          // Check if user exists
          try {
            const userProfile = await prisma.profile.findUnique({
              where: { id: finalEntityId }
            });
            
            if (userProfile) {
                            dbData.isTemporary = false;
            } else {
              console.warn(`User with ID ${finalEntityId} not found in database`);
              dbData.isTemporary = true;
              // Clear the ID to avoid database errors
              dbData.userId = null;
            }
          } catch (err) {
            console.error("Error verifying user:", err);
            dbData.isTemporary = true;
            dbData.userId = null;
          }
        } else if (finalEntityId) {
          dbData.userId = null;
          dbData.isTemporary = true;
          // Store in category for retrieval
          dbData.category = `user`;
        }
      } else {
                // For safety, ensure all fields are null if undefined or temp
        if (finalEntityId && (finalEntityId.startsWith('temp-') || finalEntityId.startsWith('temp_'))) {
          dbData.isTemporary = true;
          dbData.cateringRequestId = null;
          dbData.onDemandId = null;
          dbData.jobApplicationId = null;
          dbData.userId = null;
        }
      }
    } catch (error) {
      console.error("Error processing entity ID:", error);
      // Safety: reset all foreign keys to null if there was an error
      dbData.cateringRequestId = null;
      dbData.onDemandId = null;
      dbData.jobApplicationId = null;
      dbData.userId = null;
    }

    // Create the database record with retry logic
    
    let fileUpload;
    try {
      const dbOperation = async () => {
        return await prisma.fileUpload.create({
          data: dbData,
        });
      };

      fileUpload = await RetryHandler.withRetry(
        dbOperation,
        {
          ...DEFAULT_RETRY_CONFIG,
          maxAttempts: 2, // Fewer retries for DB operations
          baseDelay: 1000
        },
        (error, attempt) => {
                  }
      );
    } catch (error) {
      console.error("Database record creation failed after retries:", error);

      // Use enhanced error categorization for database errors
      const dbError = UploadErrorHandler.categorizeError(error, file);

      // Log and report the error
      UploadErrorHandler.logError(dbError, {
        fileName: file.name,
        filePath,
        entityId,
        entityType,
        dbData
      });
      await UploadErrorHandler.reportError(dbError);

      return NextResponse.json(
        {
          error: dbError.userMessage,
          errorType: dbError.type,
          correlationId: dbError.correlationId,
          retryable: dbError.retryable,
          retryAfter: dbError.retryAfter
        },
        { status: 500 }
      );
    }

    // Update session after successful upload (atomic operation to prevent race conditions)
    if (validatedSession) {
      try {
        // Use RPC function for atomic increment to prevent race conditions
        // CRITICAL: This RPC function MUST exist in the database before deployment
        // Migration required: see docs/security/deployment-guide.md
        // SECURITY: Pass session token to validate ownership and prevent session hijacking
        // @ts-expect-error - RPC function added in migration, types will be updated after deployment
        const { error: sessionUpdateError } = await supabase.rpc('increment_session_upload', {
          p_session_id: validatedSession.id,
          p_file_path: filePath,
          p_session_token: validatedSession.session_token
        });

        if (sessionUpdateError) {
          console.error('CRITICAL: Failed to update session after upload:', sessionUpdateError);

          // Check if this is a missing function error
          if (sessionUpdateError.message?.includes('function')) {
            console.error(
              'CRITICAL: Database migration required! The increment_session_upload RPC function is missing. ' +
              'This indicates the database has not been properly migrated. ' +
              'See docs/security/deployment-guide.md for migration instructions.'
            );

            // Return error to prevent data inconsistency
            // Note: The file upload succeeded, but session tracking failed
            return NextResponse.json(
              {
                error: 'System configuration error',
                errorType: 'CONFIGURATION_ERROR',
                message: 'Upload succeeded but session tracking failed. Please contact support.',
                details: {
                  uploadedFile: fileUpload.id,
                  requiresMigration: true
                }
              },
              { status: 500 }
            );
          }

          // For other errors, log but don't fail the upload
          console.error('Session update failed, but upload succeeded');
        }
      } catch (sessionError) {
        console.error('Error updating session:', sessionError);
        // Don't fail the upload, just log the error
      }
    }


    return NextResponse.json({
      success: true,
      file: {
        id: fileUpload.id,
        name: file.name,
        url: finalUrl,
        type: file.type,
        size: file.size,
        entityId: finalEntityId,
        entityType: entityType,
        category: normalizedCategory,
        path: filePath,
        isTemporary: dbData.isTemporary,
        bucketName: storageBucket,
      },
    });
  } catch (error: any) {
    console.error("File upload error:", error);

    // Use enhanced error categorization for general errors
    const uploadError = UploadErrorHandler.categorizeError(error, file);

    // Log and report the error
    UploadErrorHandler.logError(uploadError, {
      fileName: file?.name,
      entityId,
      entityType,
      category
    });
    await UploadErrorHandler.reportError(uploadError);

    return NextResponse.json(
      {
        error: uploadError.userMessage,
        errorType: uploadError.type,
        correlationId: uploadError.correlationId,
        retryable: uploadError.retryable,
        retryAfter: uploadError.retryAfter
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let fileUrl = searchParams.get('fileUrl');
    let fileIdParam = searchParams.get('fileId');

    // Fallback: some clients send JSON body instead of query params
    if (!fileUrl && !fileIdParam) {
      try {
        const contentType = request.headers.get('content-type') || '';
        // Be tolerant of different body encodings and environments
        const bodyText = await request.text();
        if (bodyText) {
          try {
            const parsed: unknown = contentType.includes('application/json')
              ? JSON.parse(bodyText)
              : Object.fromEntries(new URLSearchParams(bodyText));

            // Type-safe property access for parsed body
            if (parsed && typeof parsed === 'object') {
              const parsedObj = parsed as Record<string, unknown>;
              if (typeof parsedObj.fileUrl === 'string') fileUrl = parsedObj.fileUrl;
              if (typeof parsedObj.fileId === 'string') fileIdParam = parsedObj.fileId;
            }
          } catch {
            // ignore parse errors; handled by validation below
          }
        }
      } catch (e) {
        // ignore parse errors; handled by validation below
      }
    }

    
    if (!fileUrl && !fileIdParam) {
      return NextResponse.json(
        { error: "Either fileUrl or fileId is required" },
        { status: 400 },
      );
    }

    // Initialize Prisma client to find and delete the file record
    let fileRecord;

    if (fileIdParam) {
      // Find file by ID
      fileRecord = await prisma.fileUpload.findUnique({
        where: { id: fileIdParam },
      });

      if (!fileRecord) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 },
        );
      }

          } else {
      // Find file by URL
      fileRecord = await prisma.fileUpload.findFirst({
        where: { 
          fileUrl: fileUrl as string 
        },
      });

      if (!fileRecord) {
                return NextResponse.json(
          { error: "File not found" },
          { status: 404 },
        );
      }

          }

    // Determine the bucket and path from the fileUrl
    let bucketName = STORAGE_BUCKETS.DEFAULT;
    let filePath = '';

    try {
      // Extract path from the fileUrl
      // Example URL: https://example.supabase.co/storage/v1/object/public/bucket-name/path/to/file.ext
      const url = new URL(fileRecord.fileUrl);
      const pathParts = url.pathname.split('/');
      
      // Find the index of "public" which comes before the bucket name
      const publicIndex = pathParts.findIndex(part => part === 'public');
      
      if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
        bucketName = pathParts[publicIndex + 1] as typeof STORAGE_BUCKETS.DEFAULT;
        // The path is everything after the bucket name
        filePath = pathParts.slice(publicIndex + 2).join('/');
        
              } else {
                // Use default path construction as fallback
        filePath = fileRecord.fileUrl.split('/').pop() || '';
      }
    } catch (error) {
      console.error('Error parsing file URL:', error);
      // Use default path construction as fallback
      filePath = fileRecord.fileUrl.split('/').pop() || '';
    }

    // Get Supabase client
    const supabase = await createClient();

    // Delete from Supabase storage
    if (filePath) {
            
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue anyway to delete the database record
      } else {
              }
    } else {
          }

    // Delete from database
    await prisma.fileUpload.delete({
      where: { id: fileRecord.id },
    });

    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file", details: error.message || String(error) },
      { status: 500 },
    );
  }
}
