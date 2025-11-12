import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { validateUserNotSoftDeleted } from '@/lib/soft-delete-handlers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    
  try {
    // Get the Supabase client for auth and storage
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get form data from the request
    const formData = await request.formData();
        
    // Extract important data from the form
    const file = formData.get('file') as File;
    const entityId = formData.get('entityId') as string;
    const entityType = formData.get('entityType') as string || 'catering_request';
    const category = formData.get('category') as string || 'attachment';
    const userId = session.user.id; // Use the authenticated user's ID
    
    // Get userType from form data, or determine it from the user's profile
    let userType = formData.get('userType') as string;
    
    // If userType isn't provided in the form, try to get it from the user profile
    if (!userType) {
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', userId)
          .single();
        
        userType = userProfile?.type || 'client'; // Default to 'client' if no type found
      } catch (err) {
                userType = 'client';
      }
    }
    
    // Log parameters for debugging
        
    if (!file || !entityId) {
            return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate that the user is not soft-deleted
    const userValidation = await validateUserNotSoftDeleted(userId);
    if (!userValidation.isValid) {
      console.log("User validation failed:", userValidation.error);
      return NextResponse.json({ 
        error: userValidation.error 
      }, { status: 403 });
    }
    
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    
    // Create a structured path with userType/userId/fileName
    const filePath = `${userType}/${userId}/${fileName}`;
    
        
    // Upload the file to catering-files bucket
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('catering-files')  // This should be the bucket name you want
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });
      
    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json(
        { error: "Failed to upload file to storage", details: storageError },
        { status: 500 }
      );
    }
    
    // Get public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('catering-files')
      .getPublicUrl(filePath);
    
        
    // Create record in the file_upload table
    try {
            
      // Prepare specific entity type IDs
      let cateringRequestId = null;
      
      if (!isNaN(Number(entityId))) {
        cateringRequestId = BigInt(entityId).toString();
      }
      
      // Create the database record using Prisma
      const fileUpload = await prisma.fileUpload.create({
        data: {
          userId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileUrl: publicUrl,
          category,
          cateringRequestId
        }
      });
      
            
      return NextResponse.json({
        success: true,
        file: {
          id: fileUpload.id,
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
          entityId,
          entityType,
          category,
          storagePath: filePath // Return the storage path in the response
        }
      });
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      
      // More detailed error logging for debugging
      if (dbError.meta) {
        console.error("Database error metadata:", dbError.meta);
      }
      
      return NextResponse.json(
        { 
          error: "Failed to save file metadata to database", 
          details: dbError.message || dbError,
          code: dbError.code
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // ENHANCED LOGGING: Log detailed error information in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('=== CATERING FILE UPLOAD ERROR ===');
      console.error('Error Type:', error?.constructor?.name || typeof error);
      console.error('Error Message:', error?.message || String(error));
      console.error('Error Stack:', error?.stack);
      console.error('Error Code:', error?.code);
      console.error('Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('==================================');
    } else {
      // Production: Log minimal info without sensitive details
      console.error('Catering file upload error:', {
        errorType: error?.constructor?.name
      });
    }

    // Build response with conditional details
    const response: any = {
      error: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    };

    // Only include sensitive details in development
    if (process.env.NODE_ENV === 'development') {
      response.details = error.message || error;
      response.errorCode = error?.code;
      response.diagnostics = {
        operation: 'catering_file_upload',
        errorType: error?.constructor?.name,
        errorMessage: error?.message
      };
    }

    return NextResponse.json(response, { status: 500 });
  }
}