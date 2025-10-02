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
  console.log("Enhanced file upload API endpoint called");

  // Debug environment variables (without exposing sensitive data)
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set');
  console.log("Supabase Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set');
  console.log("Supabase Service Key:", process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');

  // Parse form data first to avoid issues with error handling
  const formData = await request.formData();
  console.log("Form data keys:", Array.from(formData.keys()));

  // Initialize storage buckets to ensure they exist before upload
  try {
    await initializeStorageBuckets();
    console.log("Storage buckets initialized successfully");
  } catch (initError) {
    console.error("Error initializing storage buckets:", initError);
    // Continue anyway - bucket creation errors shouldn't prevent uploads if buckets already exist
  }

  // Extract important data from the form
  const file = formData.get("file") as File;
  const entityId = formData.get("entityId") as string;
  let entityType = (formData.get("entityType") as string) || "job_application"; // Default value
  const category = (formData.get("category") as string) || "";
  console.log("File upload request received with category:", category);

  try {

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
      console.log("Using full category path for upload:", uploadPath);
    } else if (category) {
      // For other categories, make a simple prefix/category hierarchy
      uploadPath = `${category}`;
    }
    
    console.log("Final upload path:", uploadPath);
    
    const bucketName = (formData.get("bucketName") as string);
    
    // Normalize category if provided
    const normalizedCategory = category.toLowerCase();
    
    // Correct entityType based on category if needed
    // This helps ensure consistent entity types
    if (normalizedCategory === "catering-order") {
      entityType = "catering";
      console.log("Corrected entityType to 'catering' based on category 'catering-order'");
    } else if (normalizedCategory === "on-demand") {
      entityType = "on_demand";
      console.log("Corrected entityType to 'on_demand' based on category 'on-demand'");
    }
    
    console.log("Upload request details:", {
      entityType,
      entityId,
      category: normalizedCategory,
      fileName: file?.name,
      fileSize: file?.size,
    });

    // Basic validation
    if (!file) {
      console.log("Missing required field: file");
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
        console.log(`Using temporary ID as-is: ${finalEntityId}`);
      } else {
        // For normal IDs, use directly without temp prefix
        finalEntityId = entityId;
      }
    } else {
      // Generate a new temporary ID if none provided
      finalEntityId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    }
    
    console.log(`Using entity ID for file upload: ${finalEntityId}`);
    
    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;

    // Create a structured path based on entityType
    let filePath;
    let storageBucket = (bucketName || STORAGE_BUCKETS.DEFAULT) as string;
    
    // Convert entityType to a consistent format
    const normalizedEntityType = entityType.toLowerCase();
    console.log(`Normalized entityType: ${normalizedEntityType}`);
    
    // Determine which bucket and path to use based on entity type
    if (normalizedEntityType === "catering") {
      // Consistent path for catering orders
      filePath = `orders/catering/${finalEntityId}/${fileName}`;
      console.log("Using orders/catering path for catering order");
    } 
    else if (normalizedEntityType === "on_demand") {
      // Consistent path for on-demand orders  
      filePath = `orders/on-demand/${finalEntityId}/${fileName}`;
      console.log("Using orders/on-demand path for on-demand order");
    }
    else if (normalizedEntityType === "job_application") {
      // For job application type, check if ID is a temp ID or real UUID
      if (finalEntityId.startsWith('temp_') || finalEntityId.startsWith('temp-')) {
        // Skip UUID validation for temp job application IDs
        console.log("Using job-applications/temp path for temp job application uploads");
        filePath = `job-applications/temp/${finalEntityId}/${fileName}`;
      } else {
        // Only try to validate as UUID for non-temp IDs
        try {
          const jobApp = await prisma.jobApplication.findUnique({
            where: { id: finalEntityId }
          });
          
          if (jobApp) {
            console.log("Valid job application ID, using job-applications path");
            filePath = `job-applications/${jobApp.id}/${fileName}`;
          } else {
            // Check if we have a specific upload path from the category
            if (uploadPath && uploadPath.startsWith("job-applications/temp/")) {
              console.log(`Using specified upload path: ${uploadPath}`);
              filePath = `${uploadPath}/${finalEntityId}/${fileName}`;
            }
            // If category suggests this is a catering order but tagged as job application
            else if (normalizedCategory === "catering-order") {
              console.log("Catering order detected by category, using orders/catering path");
              filePath = `orders/catering/${finalEntityId}/${fileName}`;
            } else if (normalizedCategory === "on-demand") {
              console.log("On-demand order detected by category, using orders/on-demand path");
              filePath = `orders/on-demand/${finalEntityId}/${fileName}`;
            } else {
              console.log("Using job-applications/temp path for temp job application uploads");
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
      console.log("Using users path for user files");
    }
    // Default handling for other types
    else {
      filePath = `${normalizedEntityType || 'general'}/${finalEntityId}/${fileName}`;
    }

    // If bucketName was explicitly provided in the request, use that
    if (bucketName) {
      storageBucket = bucketName;
    }

    console.log(`Uploading file to storage path: ${filePath} in bucket: ${storageBucket}`);

    // Robust bucket checking and creation
    let bucketVerified = false;

    // First, check if storage is available and working
    let storageAvailable = false;
    try {
      const diagnostics = await diagnoseStorageIssues();
      storageAvailable = diagnostics.success;

      if (!storageAvailable) {
        console.warn('⚠️ Storage is not available. File uploads will be disabled or use fallback methods.');
      }
    } catch (initError) {
      console.error('Storage diagnostics failed:', initError);
      storageAvailable = false;
    }

    // Try to verify the bucket exists and is accessible
    try {
      const { data, error: listError } = await supabase.storage
        .from(storageBucket)
        .list();

      if (!listError && data !== null) {
        console.log(`Bucket '${storageBucket}' is accessible and verified`);
        bucketVerified = true;
      } else {
        console.error(`Bucket '${storageBucket}' verification failed:`, listError);

        // Try to create the bucket with admin privileges
        try {
          const adminClient = await import('@/utils/supabase/server').then(m => m.createAdminClient());
          const { error: createError } = await adminClient.storage.createBucket(storageBucket, {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          });

          if (!createError) {
            console.log(`Successfully created bucket '${storageBucket}'`);
            // Verify it was created successfully
            const { error: verifyError } = await supabase.storage.from(storageBucket).list();
            if (!verifyError) {
              console.log(`Bucket '${storageBucket}' creation verified`);
              bucketVerified = true;
            } else {
              console.error(`Bucket '${storageBucket}' creation verification failed:`, verifyError);
            }
          } else {
            console.error(`Failed to create bucket '${storageBucket}':`, createError);
          }
        } catch (createError) {
          console.error(`Exception creating bucket '${storageBucket}':`, createError);
        }

        // If bucket still not verified, try fallback
        if (!bucketVerified) {
          console.log(`Bucket '${storageBucket}' not working, trying fallback to '${STORAGE_BUCKETS.DEFAULT}'`);
          storageBucket = STORAGE_BUCKETS.DEFAULT;

          // Try to verify the default bucket
          const { error: defaultError } = await supabase.storage.from(storageBucket).list();
          if (!defaultError) {
            console.log(`Default bucket '${storageBucket}' is accessible`);
            bucketVerified = true;
          }
        }
      }
    } catch (bucketError) {
      console.error(`Exception during bucket verification for '${storageBucket}':`, bucketError);

      // Last resort: try default bucket
      storageBucket = STORAGE_BUCKETS.DEFAULT;
      try {
        const { error: fallbackError } = await supabase.storage.from(storageBucket).list();
        if (!fallbackError) {
          console.log(`Fallback bucket '${storageBucket}' is accessible`);
          bucketVerified = true;
        }
      } catch (fallbackError) {
        console.error(`Even fallback bucket '${storageBucket}' failed:`, fallbackError);
      }
    }

    // If no bucket works, we need to handle this gracefully
    if (!bucketVerified) {
      console.error(`CRITICAL: No storage buckets are accessible. This will cause upload failures.`);
      console.error(`Attempted buckets: ${Object.values(STORAGE_BUCKETS).join(', ')}`);

      // Check if storage is completely unavailable
      if (!storageAvailable) {
        console.error('STORAGE COMPLETELY UNAVAILABLE: Supabase storage is not configured or accessible');

        // Return a clear error message to help with debugging
        return NextResponse.json(
          {
            error: "File storage is currently unavailable. Please contact support if this issue persists.",
            errorType: "STORAGE_CONFIGURATION_ERROR",
            correlationId: uuidv4(),
            retryable: false,
            details: {
              message: "Supabase storage is not properly configured or accessible.",
              troubleshooting: [
                "Ensure Storage is enabled in your Supabase project dashboard",
                "Verify NEXT_PUBLIC_SUPABASE_URL points to the correct project",
                "Check that SUPABASE_SERVICE_ROLE_KEY has storage permissions",
                "Confirm your Supabase project has storage quotas available"
              ],
              environment: {
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
                serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set',
                anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set'
              }
            }
          },
          { status: 503 } // Service Unavailable
        );
      }

      // For now, we'll still try the upload but it will likely fail
      // In a production system, you might want to disable uploads or use alternative storage
    }

    // Upload the file with retry logic and enhanced error handling
    let storageData, storageError;

    // Multiple upload strategies in case Supabase storage fails
    const uploadStrategies = [
      // Strategy 1: Try Supabase storage with current bucket
      async () => {
        console.log(`Attempting upload to bucket '${storageBucket}'`);
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
          console.log(`Retrying upload with default bucket '${STORAGE_BUCKETS.DEFAULT}'`);
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
            console.log(`Upload retry attempt ${attempt} for file ${file.name}:`, error.message);
          }
        );

        storageData = result.data;
        storageError = result.error;
        break; // Success, exit the strategy loop

      } catch (error) {
        lastError = error;
        console.error(`Upload strategy failed:`, error.message);

        // If this is a bucket not found error, try the next strategy
        if (error.message.includes('Bucket not found') && strategy !== uploadStrategies[uploadStrategies.length - 1]) {
          console.log('Trying next upload strategy...');
          continue;
        }

        // For other errors, we might want to stop trying
        storageError = error;
        break;
      }
    }

    // If all strategies failed, use the last error
    if (!storageData && lastError) {
      storageError = lastError;
    }

    if (storageError) {
      console.error("Storage upload error after retries:", storageError);

      // Check if this is a critical storage failure that should disable uploads
      const isCriticalFailure = storageError.message.includes('Bucket not found') ||
                               storageError.message.includes('unauthorized') ||
                               storageError.message.includes('forbidden');

      if (isCriticalFailure && !bucketVerified) {
        console.error("CRITICAL: Storage system is not functioning properly. Consider disabling file uploads temporarily.");

        // Run diagnostics to help debug the issue
        try {
          console.log("Running storage diagnostics...");
          await diagnoseStorageIssues();
        } catch (diagError) {
          console.error("Diagnostics failed:", diagError);
        }

        // Return a more informative error to help with debugging
        return NextResponse.json(
          {
            error: "File storage is currently unavailable. Please try again later or contact support if the issue persists.",
            errorType: "STORAGE_UNAVAILABLE",
            correlationId: uuidv4(),
            retryable: true,
            retryAfter: 30000, // 30 seconds
            details: {
              message: "Storage buckets are not accessible. This may be due to configuration issues.",
              bucket: storageBucket,
              fileName: file.name,
              troubleshooting: [
                "Check that SUPABASE_SERVICE_ROLE_KEY is correctly set",
                "Verify that the Supabase project has storage enabled",
                "Ensure the service role has storage permissions",
                "Check that all required buckets exist in your Supabase project"
              ]
            }
          },
          { status: 503 } // Service Unavailable
        );
      }

      // Use enhanced error categorization for non-critical errors
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
    console.log(`Setting entity ID for type: ${entityType} and category: ${normalizedCategory}`);
    
    try {
      // First, prioritize category for determining the correct foreign key
      if (normalizedCategory === "catering-order" || normalizedCategory === "catering" || entityType === "catering") {
        console.log(`Evaluating cateringRequestId for: ${finalEntityId}`);
        
        // Only set cateringRequestId if it's NOT a temporary ID
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
          console.log(`Setting cateringRequestId to: ${finalEntityId}`);
          dbData.cateringRequestId = finalEntityId;
          
          // Double-check the catering request exists
          try {
            const cateringRequest = await prisma.cateringRequest.findUnique({
              where: { id: finalEntityId }
            });
            
            if (cateringRequest) {
              console.log(`Verified catering request exists: ID=${finalEntityId}`);
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
          console.log(`Skipping cateringRequestId for temporary ID: ${finalEntityId}`);
          // For temporary IDs, mark the file as temporary and do NOT set the cateringRequestId
          dbData.isTemporary = true;
          dbData.cateringRequestId = null;
          dbData.category = "catering-order";
        }
      } else if (normalizedCategory === "on-demand" || entityType === "on_demand") {
        // Similar logic for on-demand requests
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
          console.log(`Setting onDemandId to: ${finalEntityId}`);
          dbData.onDemandId = finalEntityId;
          dbData.isTemporary = false;
        } else if (finalEntityId) {
          console.log(`Skipping onDemandId for temporary ID: ${finalEntityId}`);
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
              console.log(`Setting jobApplicationId to: ${finalEntityId} (verified)`);
              dbData.jobApplicationId = finalEntityId;
              dbData.isTemporary = false;
            } else {
              console.log(`JobApplication ${finalEntityId} not found, not setting foreign key`);
              dbData.jobApplicationId = null;
              dbData.isTemporary = true;
              // Keep the original category rather than modifying it
            }
          } catch (error) {
            console.log(`Error finding job application with ID ${finalEntityId}, treating as temporary`, error);
            dbData.jobApplicationId = null;
            dbData.isTemporary = true;
          }
        } else if (finalEntityId) {
          // For temp IDs, don't try to look up in database at all
          console.log(`Using temporary ID for job application: ${finalEntityId}`);
          dbData.jobApplicationId = null;
          dbData.isTemporary = true;
          // Keep the original category rather than modifying it
        }
      } else if (entityType === "user") {
        // For user files, we need to set the userId field
        if (finalEntityId && !finalEntityId.startsWith('temp-') && !finalEntityId.startsWith('temp_')) {
          console.log(`Setting userId to: ${finalEntityId} for user file`);
          dbData.userId = finalEntityId;
          
          // Check if user exists
          try {
            const userProfile = await prisma.profile.findUnique({
              where: { id: finalEntityId }
            });
            
            if (userProfile) {
              console.log(`Verified user exists: ID=${finalEntityId}`);
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
        console.log(`No specific entity ID field set for type: ${entityType} and category: ${normalizedCategory}`);
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
    console.log("Creating database record with data:", dbData);

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
          console.log(`Database record creation retry attempt ${attempt}:`, error.message);
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

    console.log("Database record created successfully:", fileUpload.id);

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
            const parsed = contentType.includes('application/json')
              ? JSON.parse(bodyText)
              : Object.fromEntries(new URLSearchParams(bodyText));
            fileUrl = (parsed as any)?.fileUrl || fileUrl;
            fileIdParam = (parsed as any)?.fileId || fileIdParam;
          } catch {
            // ignore parse errors; handled by validation below
          }
        }
      } catch (e) {
        // ignore parse errors; handled by validation below
      }
    }

    console.log('DELETE /api/file-uploads called with params:', {
      fileUrl,
      fileId: fileIdParam
    });

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

      console.log('Found file record by ID:', fileRecord.fileName);
    } else {
      // Find file by URL
      fileRecord = await prisma.fileUpload.findFirst({
        where: { 
          fileUrl: fileUrl as string 
        },
      });

      if (!fileRecord) {
        console.log('File record not found for URL:', fileUrl);
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 },
        );
      }

      console.log('Found file record by URL:', fileRecord.fileName);
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
        
        console.log('Extracted storage details:', { bucketName, filePath });
      } else {
        console.log('Could not parse storage path from URL:', fileRecord.fileUrl);
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
      console.log(`Attempting to delete from bucket '${bucketName}', path: ${filePath}`);
      
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue anyway to delete the database record
      } else {
        console.log('Successfully deleted from storage');
      }
    } else {
      console.log('No valid file path to delete from storage');
    }

    // Delete from database
    await prisma.fileUpload.delete({
      where: { id: fileRecord.id },
    });

    console.log('Successfully deleted file record from database');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file", details: error.message || String(error) },
      { status: 500 },
    );
  }
}
