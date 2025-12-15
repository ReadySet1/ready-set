'use server';

import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/utils/supabase/server';
import {
  ClientListItem,
  ActionError,
  createOnDemandOrderSchema,
  CreateOnDemandOrderInput,
  CreateOrderResult
} from './schemas';

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
      return { success: false, error: "Unauthorized: You must be logged in to perform this action." };
    }

    // Check if the user is an ADMIN or SUPER_ADMIN
    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!userProfile || (userProfile.type !== UserType.ADMIN && userProfile.type !== UserType.SUPER_ADMIN)) {
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
                await supabase.storage.from(bucketName).remove([filePath]);
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
              } catch {
                // Silently ignore fallback failures
              }
            }
          } catch {
            // Silently ignore file processing errors
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
  } catch {
    return {
      success: false,
      error: "Database error: Failed to delete on-demand order."
    };
  }
}

/**
 * Fetches a list of potential clients (Profiles with type CLIENT).
 */
export async function getClients(): Promise<ClientListItem[] | ActionError> {
  try {
    const clients = await prisma.profile.findMany({
      where: {
        type: 'CLIENT',
        name: {
          not: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return clients as ClientListItem[];
  } catch {
    return { error: "Database error: Failed to fetch clients." };
  }
}

/**
 * Creates a new OnDemand order.
 */
export async function createOnDemandOrder(formData: CreateOnDemandOrderInput): Promise<CreateOrderResult> {
  // 1. Validate the input data
  const validationResult = createOnDemandOrderSchema.safeParse(formData);
  if (!validationResult.success) {
    return {
      success: false,
      error: "Validation failed. Please check the form fields.",
      fieldErrors: validationResult.error.format(),
    };
  }

  const data = validationResult.data;

  // Generate a unique order number using UUID
  const orderNumber = data.orderNumber || `OD-${uuidv4()}`;

  // Get Supabase client for session information and file operations
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Extract temp entity ID from form data if it exists
  // This is the temp ID used for file uploads before the order was created
  const tempEntityId = data.tempEntityId || null;

  try {
    // 2. Perform database operations within a transaction
    const newOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create pickup address
      const pickupAddress = await tx.address.create({
        data: {
          street1: data.pickupAddress.street1,
          street2: data.pickupAddress.street2 ?? null,
          city: data.pickupAddress.city,
          state: data.pickupAddress.state,
          zip: data.pickupAddress.zip,
          county: data.pickupAddress.county ?? null,
        },
      });

      // Create delivery address
      const deliveryAddress = await tx.address.create({
        data: {
          street1: data.deliveryAddress.street1,
          street2: data.deliveryAddress.street2 ?? null,
          city: data.deliveryAddress.city,
          state: data.deliveryAddress.state,
          zip: data.deliveryAddress.zip,
          county: data.deliveryAddress.county ?? null,
        },
      });

      // Create the OnDemand order
      const order = await tx.onDemand.create({
        data: {
          userId: data.userId,
          orderNumber: orderNumber,
          status: 'ACTIVE',
          vehicleType: data.vehicleType,
          pickupDateTime: data.pickupDateTime,
          arrivalDateTime: data.arrivalDateTime,
          completeDateTime: data.completeDateTime ?? null,
          hoursNeeded: data.hoursNeeded ?? null,
          itemDelivered: data.itemDelivered ?? null,
          clientAttention: data.clientAttention,
          pickupNotes: data.pickupNotes ?? null,
          specialNotes: data.specialNotes ?? null,
          orderTotal: data.orderTotal,
          tip: data.tip ?? null,
          length: data.length ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          weight: data.weight ?? null,
          pickupAddressId: pickupAddress.id,
          deliveryAddressId: deliveryAddress.id,
        },
      });

      return order;
    });

    // 3. Update any temporary file associations
    if (tempEntityId && user) {
      try {
        // Call the API to update file associations
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ready-set.vercel.app';
        const updateUrl = `${baseUrl}/api/file-uploads/update-entity`;

        const updateData = {
          oldEntityId: tempEntityId,
          newEntityId: newOrder.id,
          entityType: 'on_demand',
        };

        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          // Add retry logic in case of failure
          await new Promise(resolve => setTimeout(resolve, 1000));

          await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
          });
        }
      } catch {
        // Silently ignore file association errors - don't fail the order creation
      }

      // Also try to update storage paths for any temporary files
      try {
        // Format the tempEntityId to ensure consistency
        const formattedTempId = tempEntityId.startsWith('temp-')
          ? tempEntityId
          : `temp-${tempEntityId}`;

        const supabaseClient = await createClient();

        // Try multiple possible paths for temp files
        const possibleTempPaths = [
          `on_demand/${formattedTempId}`,
          `orders/on_demand/${formattedTempId}`,
          `on_demand/temp-${tempEntityId}`,
          `orders/on_demand/temp-${tempEntityId}`
        ];

        let foundFiles = false;

        // First check for files in the possible temp paths
        for (const tempPath of possibleTempPaths) {
          const { data: tempFiles, error: listError } = await supabaseClient.storage
            .from('fileUploader')
            .list(tempPath);

          if (listError) {
            continue; // Try next path
          }

          if (tempFiles && tempFiles.length > 0) {
            foundFiles = true;

            // Move each file to the new path
            for (const file of tempFiles) {
              const oldPath = `${tempPath}/${file.name}`;
              const newPath = `on_demand/${newOrder.id}/${file.name}`;

              try {
                const { error: moveError } = await supabaseClient.storage
                  .from('fileUploader')
                  .move(oldPath, newPath);

                if (!moveError) {
                  // Update file URL in database if needed
                  const { data: { publicUrl } } = supabaseClient.storage
                    .from('fileUploader')
                    .getPublicUrl(newPath);

                  try {
                    // Update the file record in the database with the new URL
                    await prisma.fileUpload.updateMany({
                      where: {
                        fileUrl: {
                          contains: oldPath
                        },
                        isTemporary: true
                      },
                      data: {
                        fileUrl: publicUrl,
                        isTemporary: false,
                        onDemandId: newOrder.id
                      }
                    });
                  } catch {
                    // Silently ignore database update errors
                  }
                }
              } catch {
                // Silently ignore file move errors
              }
            }
          }
        }

        // If we didn't find any files by path, check the database for files with encoded category
        if (!foundFiles) {
          // Look for files with the temp ID encoded in the category field
          const encodedTempFiles = await prisma.fileUpload.findMany({
            where: {
              isTemporary: true,
              OR: [
                { category: { contains: formattedTempId } },
                { category: { contains: tempEntityId } }
              ]
            }
          });

          if (encodedTempFiles.length > 0) {
            // Update them to use the new order ID
            for (const file of encodedTempFiles) {
              try {
                await prisma.fileUpload.update({
                  where: { id: file.id },
                  data: {
                    isTemporary: false,
                    onDemandId: newOrder.id,
                    category: "on-demand-order"
                  }
                });

                // If the file has a URL that contains the temp ID, try to move it
                if (file.fileUrl && (file.fileUrl.includes(formattedTempId) || file.fileUrl.includes(tempEntityId))) {
                  const url = new URL(file.fileUrl);
                  const parts = url.pathname.split('/');
                  let tempPath = '';
                  let fileName = '';

                  // Try to extract the path and filename
                  const publicIndex = parts.findIndex(part => part === 'public');
                  if (publicIndex >= 0 && publicIndex + 2 < parts.length) {
                    const bucketName = parts[publicIndex + 1] || 'fileUploader';
                    const pathParts = parts.slice(publicIndex + 2);
                    fileName = pathParts[pathParts.length - 1] || '';
                    tempPath = pathParts.slice(0, -1).join('/');

                    if (tempPath && fileName) {
                      const oldPath = `${tempPath}/${fileName}`;
                      const newPath = `on_demand/${newOrder.id}/${fileName}`;

                      try {
                        const { error: moveError } = await supabaseClient.storage
                          .from(bucketName)
                          .move(oldPath, newPath);

                        if (!moveError) {
                          // Update URL in database
                          const { data: { publicUrl } } = supabaseClient.storage
                            .from(bucketName)
                            .getPublicUrl(newPath);

                          await prisma.fileUpload.update({
                            where: { id: file.id },
                            data: { fileUrl: publicUrl }
                          });
                        }
                      } catch {
                        // Silently ignore file move errors
                      }
                    }
                  }
                }
              } catch {
                // Silently ignore file update errors
              }
            }
          }
        }
      } catch {
        // Silently ignore storage path update errors
      }
    }

    // 4. Revalidate relevant paths
    revalidatePath('/admin/on-demand-orders');
    revalidatePath('/account/orders');

    // 5. Return success result
    return {
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
    };

  } catch (error) {
    // Check if the error is a Prisma unique constraint violation on orderNumber
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      const targetFields = error.meta?.target as string[] | undefined;
      if (targetFields?.includes('orderNumber')) {
        return {
          success: false,
          error: `Order number '${orderNumber}' already exists. Please use a unique order number.`,
          fieldErrors: {
            orderNumber: { _errors: [`Order number '${orderNumber}' already exists.`] },
            _errors: []
          }
        };
      }
    }

    // Generic database error
    return {
      success: false,
      error: "Database error: Failed to create on-demand order.",
    };
  }
}
