'use server';

import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { createClient } from '@/utils/supabase/server';

// Define UserType enum locally to match schema
enum UserType {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
  DRIVER = 'DRIVER'
}

// Define the delete operation result interface
export interface DeleteOrderResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Deletes an OnDemand order.
 * Only ADMIN and SUPER_ADMIN users can delete orders.
 */
export async function deleteOnDemandOrder(orderId: string): Promise<DeleteOrderResult> {

  try {
    // Get authenticated user from Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      console.error("Unauthorized: No authenticated user");
      return { success: false, error: "Unauthorized: You must be logged in to perform this action." };
    }

    // Check if the user is an ADMIN or SUPER_ADMIN
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!userProfile || (userProfile.type !== UserType.ADMIN && userProfile.type !== UserType.SUPER_ADMIN)) {
      console.error(`Unauthorized: User ${user.id} with type ${userProfile?.type} attempted to delete order`);
      return {
        success: false,
        error: "Unauthorized: Only Admin or Super Admin can delete on-demand orders."
      };
    }

    // Find the order first to make sure it exists
    const order = await prisma.onDemand.findUnique({
      where: { id: orderId },
      include: {
        fileUploads: true
      }
    });

    if (!order) {
      return { success: false, error: `Order with ID ${orderId} not found.` };
    }

    // Get file uploads before transaction to ensure we have them for storage deletion
    const fileUploads = [...order.fileUploads];

    // Perform the deletion in a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete associated dispatches
      await tx.dispatch.deleteMany({
        where: { onDemandId: orderId }
      });

      // Delete associated file uploads from database
      await tx.fileUpload.deleteMany({
        where: { onDemandId: orderId }
      });

      // Delete the order
      await tx.onDemand.delete({
        where: { id: orderId }
      });
    });

    // Delete files from storage bucket (outside transaction since it's an external service)
    if (fileUploads.length > 0) {
      for (const file of fileUploads) {
        if (file.fileUrl) {
          try {
            // Extract the storage URL parts
            let bucketName = "fileUploader"; // Default bucket name
            let filePath = "";
            let tempFolderPath = "";

            // Look for patterns in the URL
            // 1. Check standard format: .../storage/v1/object/public/bucket-name/path
            const standardPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+?)(?:\?.*)?$/;
            const standardMatch = file.fileUrl.match(standardPattern);

            // 2. Check for temp folder pattern: .../temp-[UUID]/...
            const tempFolderPattern = /(temp-[a-zA-Z0-9]+)/;
            const tempFolderMatch = file.fileUrl.match(tempFolderPattern);

            if (standardMatch) {
              // Standard URL format
              bucketName = standardMatch?.[1] || "fileUploader";
              filePath = standardMatch?.[2] || "";

              // Attempt to delete from standard path
              if (filePath) {
                const { error } = await supabase.storage.from(bucketName).remove([filePath]);
                if (error) {
                  console.error(`Error deleting file from standard path:`, error);
                }
              }
            }
            else if (tempFolderMatch) {
              // This is a temp folder structure
              tempFolderPath = tempFolderMatch?.[1] || "";
              bucketName = "fileUploader";

              // Try several possible path structures
              const pathAttempts = [];

              // 1. First attempt: Get everything after the domain including temp folder
              const url = new URL(file.fileUrl);
              const fullPath = url.pathname.split('/').slice(1).join('/');
              pathAttempts.push(fullPath);

              // 2. Just the temp folder name
              pathAttempts.push(tempFolderPath);

              // 3. Try with the file name if we can extract it
              const pathParts = url.pathname.split('/');
              const fileName = pathParts[pathParts.length - 1];
              if (fileName && !fileName.startsWith('temp-')) {
                pathAttempts.push(`${tempFolderPath}/${fileName}`);
              }

              // 4. Look for on_demand subfolder
              if (url.pathname.includes('on_demand')) {
                pathAttempts.push(`${tempFolderPath}/on_demand/${fileName}`);
              }

              // Try all path combinations
              for (const attemptPath of pathAttempts) {
                if (!attemptPath) continue;

                const { error } = await supabase.storage.from(bucketName).remove([attemptPath]);

                if (!error) {
                  break;
                }
              }
            }
            else {
              // Fallback method
              try {
                const url = new URL(file.fileUrl);
                filePath = url.pathname.split('/').slice(1).join('/');

                await supabase.storage.from(bucketName).remove([filePath]);
              } catch (e) {
                console.error(`Fallback method failed:`, e);
              }
            }
          } catch (error) {
            console.error(`Error processing file URL ${file.fileUrl}:`, error);
          }
        }
      }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/on-demand-orders');
    revalidatePath(`/admin/on-demand-orders/${encodeURIComponent(order.orderNumber)}`);

    return {
      success: true,
      message: "Order and associated data deleted successfully"
    };
  } catch (error) {
    console.error("Failed to delete on-demand order:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    return {
      success: false,
      error: "Database error: Failed to delete on-demand order."
    };
  }
}
