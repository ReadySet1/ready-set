'use server';

import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

// PrismaClientKnownRequestError is now at Prisma.PrismaClientKnownRequestError in Prisma 7
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/utils/supabase/server';
import { notifyOrderCreated } from '@/services/orders/notifyOrderCreated';
import { siteOrigin } from '@/lib/site-url';
import { runAfterResponse } from '@/lib/api/after-response';
import { getStaffCaller } from '@/lib/auth/staff-caller';
import { getActionCaller } from '@/lib/auth/driver-ownership';
import {
  softDeleteOrder,
  toDeleteOrderActionResult,
  type DeleteOrderActionResult,
} from '@/lib/services/order-deletion';
import {
  ClientListItem,
  ActionError,
  createOnDemandOrderSchema,
  CreateOnDemandOrderInput,
  CreateOrderResult
} from './schemas';

// Result of the delete action (shared with the catering action)
export type DeleteOrderResult = DeleteOrderActionResult;

/**
 * Soft-deletes an OnDemand order through the shared order-deletion service.
 * Only ADMIN and SUPER_ADMIN users can delete orders.
 */
export async function deleteOnDemandOrder(orderId: string): Promise<DeleteOrderResult> {
  try {
    // Server actions are public POST endpoints: authorise the caller here.
    const caller = await getActionCaller();
    if (!caller) {
      return { success: false, error: "Unauthorized: You must be logged in to perform this action." };
    }
    if (!caller.isPrivileged) {
      return {
        success: false,
        error: "Unauthorized: Only Admin or Super Admin can delete on-demand orders."
      };
    }

    const result = await softDeleteOrder(
      { orderType: 'on_demand', orderId },
      { deletedBy: caller.userId },
    );

    if (result.outcome === 'DELETED') {
      revalidatePath('/admin/on-demand-orders');
      revalidatePath(`/admin/on-demand-orders/${encodeURIComponent(result.orderNumber)}`);
    }

    return toDeleteOrderActionResult(result, orderId);
  } catch (error) {
    console.error("Failed to delete on-demand order:", error);
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
  // 0. Server actions are public POST endpoints — only staff may create orders
  if (!(await getStaffCaller())) {
    return { success: false, error: 'Unauthorized' };
  }

  // 1. Validate the input data
  const validationResult = createOnDemandOrderSchema.safeParse(formData);
  if (!validationResult.success) {
    const failingFields = validationResult.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const uniqueFields = [...new Set(failingFields)];
    const fieldList = uniqueFields.length > 0 ? ` Issues with: ${uniqueFields.join(', ')}.` : '';
    return {
      success: false,
      error: `Validation failed. Please check the form fields.${fieldList}`,
      fieldErrors: validationResult.error.format(),
    };
  }

  const data = validationResult.data;

  // Generate a unique order number using UUID
  const orderNumber = data.orderNumber || `OD-${uuidv4()}`;

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

    // Admin order notification
    runAfterResponse("admin-order-notification", () =>
      notifyOrderCreated({
        orderId: newOrder.id,
        orderType: "on_demand",
        source: "admin_dashboard",
      }),
    );

    // 3. Update any temporary file associations
    if (tempEntityId) {
      try {
        // Call the API to update file associations
        const baseUrl = siteOrigin();
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
