import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { UserType } from '@/types/prisma';
import { createClient } from "@/utils/supabase/server";
import { PrismaTransaction } from "@/types/prisma-types";

import { prisma } from "@/utils/prismaDB";

export async function DELETE(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if the user is authenticated
    if (!user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized: You must be logged in to perform this action." 
      }, { status: 401 });
    }

    // Check if the user is an admin or super admin
    const userData = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!userData || (userData.type !== UserType.ADMIN && userData.type !== UserType.SUPER_ADMIN)) {
      return NextResponse.json({ 
        success: false,
        error: "Unauthorized: Only administrators can delete orders." 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const orderType = searchParams.get('orderType');

    if (!orderId || !orderType) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: orderId or orderType'
      }, { status: 400 });
    }

    if (orderType !== 'catering' && orderType !== 'onDemand') {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid orderType: ${orderType}. Must be 'catering' or 'onDemand'.` 
      }, { status: 400 });
    }

    // Check if the order exists before attempting to delete
    let orderExists = false;
    if (orderType === 'catering') {
      const order = await prisma.cateringRequest.findUnique({
        where: { id: orderId }
      });
      orderExists = !!order;
    } else {
      const order = await prisma.onDemand.findUnique({
        where: { id: orderId }
      });
      orderExists = !!order;
    }

    if (!orderExists) {
      return NextResponse.json({ 
        success: false, 
        error: `Order with ID ${orderId} not found.`
      }, { status: 404 });
    }

    // Start a transaction
    const result = await prisma.$transaction(async (tx: PrismaTransaction) => {
      // Delete associated dispatches
      const deletedDispatches = await tx.dispatch.deleteMany({
        where: {
          [orderType === 'catering' ? 'cateringRequestId' : 'onDemandId']: orderId,
        },
      });

      // Get file uploads before deleting them from the database
      const fileUploads = await tx.fileUpload.findMany({
        where: {
          [orderType === 'catering' ? 'cateringRequestId' : 'onDemandId']: orderId,
        },
      });

      // Delete associated file uploads from database
      await tx.fileUpload.deleteMany({
        where: {
          [orderType === 'catering' ? 'cateringRequestId' : 'onDemandId']: orderId,
        },
      });

      // Delete the order
      let deletedOrder;
      if (orderType === 'catering') {
        deletedOrder = await tx.cateringRequest.delete({
          where: { id: orderId },
        });
      } else {
        deletedOrder = await tx.onDemand.delete({
          where: { id: orderId },
        });
      }

      return { 
        success: true,
        deletedDispatches: deletedDispatches.count,
        fileUploads,
        deletedOrder: deletedOrder ? 1 : 0
      };
    });

    // After transaction completes successfully, attempt to delete files from storage
    if (result.fileUploads && result.fileUploads.length > 0) {
      console.log(`Found ${result.fileUploads.length} file(s) to delete from storage`);
      
      // Check specifically for nested structure based on the screenshot
      try {
        // First check if we have folder structure like catering_order/[orderId]
        console.log(`Checking for specific folder structure: catering_order/${orderId}`);
        const { data: orderFolder, error: orderFolderError } = await supabase.storage
          .from('fileUploader')
          .list(`catering_order/${orderId}`);
        
        if (orderFolderError) {
          console.log(`No direct folder found at catering_order/${orderId}: ${orderFolderError.message}`);
        } else if (orderFolder && orderFolder.length > 0) {
          // Found files in the expected structure
          console.log(`Found ${orderFolder.length} files in catering_order/${orderId}`);
          
          // Create paths to delete all these files
          const orderFilesToDelete = orderFolder.map(file => `catering_order/${orderId}/${file.name}`);
          
          // Delete all files in one call
          const { data: orderDeleteData, error: orderDeleteError } = await supabase.storage
            .from('fileUploader')
            .remove(orderFilesToDelete);
          
          if (orderDeleteError) {
            console.error(`Error deleting files from catering_order/${orderId}:`, orderDeleteError);
          } else {
            console.log(`Successfully deleted ${orderDeleteData?.length || 0} files from catering_order/${orderId}`);
          }
        } else {
          console.log(`No files found in catering_order/${orderId}`);
        }
        
        // Also check the root catering_order folder for any files matching this order
        console.log(`Checking root catering_order folder for order-related files`);
        const { data: rootCateringFiles, error: rootCateringError } = await supabase.storage
          .from('fileUploader')
          .list('catering_order');
        
        if (rootCateringError) {
          console.log(`Error checking root catering_order folder: ${rootCateringError.message}`);
        } else if (rootCateringFiles && rootCateringFiles.length > 0) {
          // Look for directories with matching order ID
          const orderDirs = rootCateringFiles.filter(item => 
            item.id === orderId || 
            item.name === orderId ||
            (item.metadata && item.metadata.id === orderId)
          );
          
          if (orderDirs.length > 0) {
            console.log(`Found ${orderDirs.length} matching directories in catering_order for order ${orderId}`);
            
            // Process each directory
            for (const dir of orderDirs) {
              const dirPath = `catering_order/${dir.name}`;
              console.log(`Processing directory: ${dirPath}`);
              
              // List files in this directory
              const { data: dirFiles, error: dirError } = await supabase.storage
                .from('fileUploader')
                .list(dirPath);
              
              if (dirError) {
                console.error(`Error listing files in ${dirPath}:`, dirError);
              } else if (dirFiles && dirFiles.length > 0) {
                const dirFilesToDelete = dirFiles.map(file => `${dirPath}/${file.name}`);
                
                // Delete all files in this directory
                const { data: dirDeleteData, error: dirDeleteError } = await supabase.storage
                  .from('fileUploader')
                  .remove(dirFilesToDelete);
                
                if (dirDeleteError) {
                  console.error(`Error deleting files from ${dirPath}:`, dirDeleteError);
                } else {
                  console.log(`Successfully deleted ${dirDeleteData?.length || 0} files from ${dirPath}`);
                }
              }
            }
          }
        }
      } catch (specificFolderError) {
        console.error('Error during specific folder cleanup:', specificFolderError);
      }

      // After deleting order-specific files, check for any temp folders
      try {
        // List the top-level folders to find any temp folders
        const { data: rootFolders, error: rootError } = await supabase.storage
          .from('fileUploader')
          .list('');
          
        if (rootError) {
          console.error('Error listing root folders:', rootError);
        } else if (rootFolders) {
          // Find temp folders that might be related to this order
          const tempFolders = rootFolders.filter(folder => 
            folder.name.startsWith('temp-') && folder.name.includes('-')
          );
          
          if (tempFolders.length > 0) {
            console.log(`Found ${tempFolders.length} temporary folders to check`);
            
            // Check each temp folder to see if we can find files belonging to this order
            for (const tempFolder of tempFolders) {
              try {
                // List files in the temp folder
                const { data: tempFiles, error: tempError } = await supabase.storage
                  .from('fileUploader')
                  .list(tempFolder.name);
                  
                if (tempError) {
                  console.error(`Error listing files in temp folder ${tempFolder.name}:`, tempError);
                  continue;
                }
                
                if (tempFiles && tempFiles.length > 0) {
                  // Create paths to delete all files in this temp folder
                  const tempFilesToDelete = tempFiles.map(file => `${tempFolder.name}/${file.name}`);
                  
                  console.log(`Attempting to delete ${tempFilesToDelete.length} files from temp folder ${tempFolder.name}`);
                  
                  // Delete all files in the temp folder
                  const { data: tempDeleteData, error: tempDeleteError } = await supabase.storage
                    .from('fileUploader')
                    .remove(tempFilesToDelete);
                    
                  if (tempDeleteError) {
                    console.error(`Error deleting files from temp folder ${tempFolder.name}:`, tempDeleteError);
                  } else {
                    console.log(`Successfully deleted ${tempDeleteData?.length || 0} files from temp folder ${tempFolder.name}`);
                  }
                }
              } catch (tempFolderError) {
                console.error(`Error processing temp folder ${tempFolder.name}:`, tempFolderError);
              }
            }
          }
        }
      } catch (tempCleanupError) {
        console.error('Error during temporary folder cleanup:', tempCleanupError);
      }

      // Also try individual file deletions based on fileUrl in case paths are different
      try {
        if (result.fileUploads && result.fileUploads.length > 0) {
          console.log(`Processing ${result.fileUploads.length} file URLs from database records`);
          
          for (const file of result.fileUploads) {
            try {
              if (file.fileUrl) {
                console.log(`Processing file URL for deletion: ${file.fileUrl}`);
                
                // Try to extract the path from the URL
                let filePath = "";
                try {
                  // Check if it's a Supabase storage URL
                  if (file.fileUrl.includes('/storage/v1/object/public/')) {
                    // Format: .../storage/v1/object/public/bucket-name/path
                    const pathParts = file.fileUrl.split('/storage/v1/object/public/')[1];
                    if (pathParts) {
                      // Split by bucket name and the rest of the path
                      const pathSegments = pathParts.split('/');
                      if (pathSegments.length > 1) {
                        const bucket = pathSegments[0];
                        const rest = pathSegments.slice(1);
                        const filePathWithQuery = rest.join('/');
                        filePath = filePathWithQuery.split('?')[0] || ""; // Remove query params
                        
                        console.log(`Extracted path from URL: bucket=${bucket}, path=${filePath}`);
                        
                        if (filePath) {
                          const { error: fileDeleteError } = await supabase.storage
                            .from('fileUploader')
                            .remove([filePath]);
                            
                          if (fileDeleteError) {
                            console.error(`Error deleting individual file ${filePath}:`, fileDeleteError);
                          } else {
                            console.log(`Successfully deleted individual file: ${filePath}`);
                          }
                        }
                      }
                    }
                  }
                } catch (parseError) {
                  console.error(`Error parsing file URL ${file.fileUrl}:`, parseError);
                }
              }
            } catch (fileError) {
              console.error(`Error processing file ${file.id}:`, fileError);
            }
          }
        }
      } catch (fileUrlError) {
        console.error('Error processing file URLs:', fileUrlError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order and associated data deleted successfully",
      details: {
        deletedDispatches: result.deletedDispatches,
        deletedFiles: result.fileUploads?.length || 0,
        deletedOrder: result.deletedOrder
      }
    });
    
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'An error occurred while deleting the order. Please try again.'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}