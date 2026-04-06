import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export async function PUT(request: NextRequest) {
  try {
    const { oldEntityId, newEntityId, entityType } = await request.json();

    if (!oldEntityId || !newEntityId) {
      return NextResponse.json(
        { error: "Both old and new entity IDs are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Allow operations even without session for server-to-server calls
    const hasSession = !!session;
    
    
    // Build entity-specific OR conditions based on entityType
    const entityIdConditions: Record<string, unknown>[] = [
      // Look for files with category containing the old entity ID
      {
        isTemporary: true,
        category: { contains: oldEntityId },
      },
      // Look for files with URLs containing the old entity ID
      {
        isTemporary: true,
        fileUrl: { contains: oldEntityId },
      },
    ];

    // Add entity-specific FK lookup based on entityType
    if (!oldEntityId.startsWith('temp-') && !oldEntityId.startsWith('temp_')) {
      if (entityType === 'on_demand') {
        entityIdConditions.push({ isTemporary: true, onDemandId: oldEntityId });
      } else if (entityType === 'job_application') {
        entityIdConditions.push({ isTemporary: true, jobApplicationId: oldEntityId });
      } else {
        // Default to catering for backwards compatibility
        entityIdConditions.push({ isTemporary: true, cateringRequestId: oldEntityId });
      }
    }

    // Get all files with temp entity ID, using different approaches
    let fileRecords = await prisma.fileUpload.findMany({
      where: {
        OR: entityIdConditions,
      },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        category: true,
        isTemporary: true,
        uploadedAt: true,
        updatedAt: true,
        userId: true,
        cateringRequestId: true,
        onDemandId: true,
        jobApplicationId: true
      },
    });

    
    if (fileRecords.length === 0) {
      // Check for raw path matches in the fileUrl field
      const pathFileRecords = await prisma.fileUpload.findMany({
        where: {
          isTemporary: true,
          fileUrl: {
            contains: oldEntityId
          }
        },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          fileType: true,
          category: true,
          isTemporary: true,
          uploadedAt: true,
          updatedAt: true,
          userId: true,
          cateringRequestId: true,
          onDemandId: true,
          jobApplicationId: true
        }
      });

      if (pathFileRecords.length > 0) {
                fileRecords = fileRecords.concat(pathFileRecords);
      } else {
        // If still no files found, check if any files already exist with the new entity ID
        const newIdOrConditions: Record<string, unknown>[] = [
          { fileUrl: { contains: newEntityId } },
        ];
        if (entityType === 'on_demand') {
          newIdOrConditions.push({ onDemandId: newEntityId });
        } else if (entityType === 'job_application') {
          newIdOrConditions.push({ jobApplicationId: newEntityId });
        } else {
          newIdOrConditions.push({ cateringRequestId: newEntityId });
        }
        const newIdFileRecords = await prisma.fileUpload.findMany({
          where: {
            OR: newIdOrConditions,
          },
          select: {
            id: true,
          },
        });

        if (newIdFileRecords.length > 0) {
                    // Files are already using the new ID, so we consider this a success
          return NextResponse.json({
            success: true,
            message: "Files are already associated with the new entity ID",
            updatedCount: 0,
            alreadyUpdated: newIdFileRecords.length,
          });
        }

        // No files found with old or new entityId, which is unusual but not necessarily an error
                return NextResponse.json({
          success: true,
          message: "No files found to update",
          updatedCount: 0,
        });
      }
    }

    // Process the file records
    let updatedCount = 0;

    for (const file of fileRecords) {
      
      try {
        // First update the DB record with the correct FK based on entityType
        const entityData: Record<string, unknown> = { isTemporary: false };
        if (entityType === 'on_demand') {
          entityData.onDemandId = newEntityId;
          entityData.cateringRequestId = null;
        } else if (entityType === 'job_application') {
          entityData.jobApplicationId = newEntityId;
          entityData.cateringRequestId = null;
        } else {
          entityData.cateringRequestId = newEntityId;
        }
        await prisma.fileUpload.update({
          where: { id: file.id },
          data: entityData,
        });

        // Now try to move the file in storage
        if (file.fileUrl) {
          // Extract path information
          const urlObj = new URL(file.fileUrl);
          const pathParts = urlObj.pathname.split('/');
          
          // Find 'public' and the following bucket name in the path
          const publicIndex = pathParts.findIndex(part => part === 'public');
          
          if (publicIndex >= 0 && publicIndex + 1 < pathParts.length) {
            const bucketName = pathParts[publicIndex + 1] || '';
            
            // Only proceed if we have a valid bucket name
            if (bucketName) {
              // Look for the old entity ID in the path
              const pathAfterBucket = pathParts.slice(publicIndex + 2).join('/');
              
              // Attempt to identify the folder structure
              let oldPath = '';
              let newPath = '';
              
              if (pathAfterBucket.includes('catering_order')) {
                // Handle catering_order path format
                const parts = pathAfterBucket.split('/');
                for (let i = 0; i < parts.length - 1; i++) {
                  if (parts[i] === 'catering_order' && i + 1 < parts.length) {
                    // Type assertion to handle possibly undefined values
                    const folderName = parts[i + 1] as string;
                    if (folderName && (folderName.includes(oldEntityId) || folderName === oldEntityId)) {
                      // Found the folder with old ID
                      const fileName = parts[parts.length - 1] as string;
                      oldPath = `catering_order/${folderName}/${fileName}`;
                      newPath = `catering_order/${newEntityId}/${fileName}`;
                      break;
                    }
                  }
                }
              } else if (pathAfterBucket.includes('orders/catering')) {
                // Handle orders/catering path format
                const parts = pathAfterBucket.split('/');
                for (let i = 0; i < parts.length - 1; i++) {
                  if ((parts[i] === 'orders' && parts[i+1] === 'catering') && i + 2 < parts.length) {
                    // Type assertion to handle possibly undefined values
                    const folderName = parts[i + 2] as string;
                    if (folderName && (folderName.includes(oldEntityId) || folderName === oldEntityId)) {
                      // Found the folder with old ID
                      const fileName = parts[parts.length - 1] as string;
                      oldPath = `orders/catering/${folderName}/${fileName}`;
                      newPath = `orders/catering/${newEntityId}/${fileName}`;
                      break;
                    }
                  }
                }
              } else if (pathAfterBucket.includes(oldEntityId)) {
                // Generic handler: file path contains the old entity ID anywhere
                // This covers on-demand and other entity types
                const decodedPath = decodeURIComponent(pathAfterBucket);
                oldPath = decodedPath;
                newPath = decodedPath.replace(oldEntityId, newEntityId);
              }
              
              if (oldPath && newPath) {
                                
                try {
                  const { error: moveError } = await supabase.storage
                    .from(bucketName)
                    .move(oldPath, newPath);
                    
                  if (moveError) {
                    console.error(`Error moving file: ${moveError.message}`);
                  } else {
                                        
                    // Update file URL in database
                    const { data: { publicUrl } } = supabase.storage
                      .from(bucketName)
                      .getPublicUrl(newPath);
                    
                    await prisma.fileUpload.update({
                      where: { id: file.id },
                      data: { fileUrl: publicUrl }
                    });
                    
                                      }
                } catch (moveError) {
                  console.error(`Exception moving file: ${moveError}`);
                }
              } else {
                              }
            }
          }
        }
        
        updatedCount++;
      } catch (error) {
        console.error(`Error updating file ${file.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Successfully updated ${updatedCount} files from entity ${oldEntityId} to ${newEntityId}`,
    });
  } catch (error) {
    console.error("Error updating file entity IDs:", error);
    return NextResponse.json(
      { error: "Failed to update file entity IDs" },
      { status: 500 },
    );
  }
}
