'use server';

import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma, PrismaClient } from '@prisma/client';

// PrismaClientKnownRequestError is now at Prisma.PrismaClientKnownRequestError in Prisma 7
import { v4 as uuidv4 } from 'uuid';
import {
  ClientListItem,
  ActionError,
  createCateringOrderSchema,
  CreateCateringOrderInput,
  CreateOrderResult
} from './schemas';
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

// Result of the delete action (shared with the on-demand action)
export type DeleteOrderResult = DeleteOrderActionResult;

/**
 * Fetches a list of potential clients (Profiles).
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

    console.log(`[getClients] Successfully fetched ${clients.length} client(s)`);

    if (clients.length === 0) {
      console.warn("[getClients] No CLIENT profiles found in database. Please ensure CLIENT profiles exist.");
    }

    return clients as ClientListItem[];
  } catch (error) {
    console.error("[getClients] Failed to fetch clients:", error);
    return { error: "Database error: Failed to fetch clients." };
  }
}

/**
 * Creates a new CateringRequest order.
 */
export async function createCateringOrder(formData: CreateCateringOrderInput): Promise<CreateOrderResult> {
  // 0. Server actions are public POST endpoints — only staff may create orders
  if (!(await getStaffCaller())) {
    return { success: false, error: "Unauthorized" };
  }

  // 1. Validate the input data
  const validationResult = createCateringOrderSchema.safeParse(formData);
  if (!validationResult.success) {
    console.error("Validation failed:", validationResult.error.format());
    return {
      success: false,
      error: "Validation failed. Please check the form fields.",
      fieldErrors: validationResult.error.format(),
    };
  }

    const data = validationResult.data;

  // Generate a unique order number using UUID
  const orderNumber = data.orderNumber || `CATER-${uuidv4()}`;
  
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
      
      // Create the CateringRequest
            const order = await tx.cateringRequest.create({
        data: {
          userId: data.userId,
          orderNumber: orderNumber,
          brokerage: data.brokerage ?? null,
          status: 'ACTIVE',
          pickupDateTime: data.pickupDateTime,
          arrivalDateTime: data.arrivalDateTime,
          completeDateTime: data.completeDateTime ?? null,
          headcount: data.headcount ?? null,
          needHost: data.needHost,
          hoursNeeded: data.hoursNeeded ?? null,
          numberOfHosts: data.numberOfHosts ?? null,
          clientAttention: data.clientAttention ?? null,
          pickupNotes: data.pickupNotes ?? null,
          specialNotes: data.specialNotes ?? null,
          orderTotal: data.orderTotal,
          tip: data.tip ?? null,
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
        orderType: "catering",
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
          entityType: 'catering_request',
        };
                
        const response = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });
        
        if (response.ok) {
          const result = await response.json();
                  } else {
          const errorText = await response.text();
          console.error(`Failed to update file associations: ${response.status} - ${errorText}`);
          
          // Add retry logic in case of failure
                    await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
          });
          
          if (retryResponse.ok) {
            const retryResult = await retryResponse.json();
                      } else {
            console.error('Retry failed to update file associations:', await retryResponse.text());
          }
        }
      } catch (error) {
        // Log but don't fail the order creation if file update fails
        console.error('Error updating file associations:', error);
        
        // Make sure we have enough details for debugging
        if (error instanceof Error) {
          console.error(`Error stack: ${error.stack}`);
        }
      }

      // Also try to update storage paths for any temporary files
      try {
                
        // Format the tempEntityId to ensure consistency
        const formattedTempId = tempEntityId.startsWith('temp-') 
          ? tempEntityId 
          : `temp-${tempEntityId}`;
          
                
        const supabase = await createClient();
        
        // Try multiple possible paths for temp files
        const possibleTempPaths = [
          `catering_order/${formattedTempId}`,
          `orders/catering/${formattedTempId}`, 
          `catering_order/temp-${tempEntityId}`,
          `orders/catering/temp-${tempEntityId}`
        ];
        
        let foundFiles = false;
        
        // First check for files in the possible temp paths
        for (const tempPath of possibleTempPaths) {
                    
          const { data: tempFiles, error: listError } = await supabase.storage
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
              const newPath = `catering_order/${newOrder.id}/${file.name}`;
              
                            
              try {
                const { error: moveError } = await supabase.storage
                  .from('fileUploader')
                  .move(oldPath, newPath);
                  
                if (moveError) {
                  console.error(`Error moving file ${oldPath} to ${newPath}:`, moveError);
                } else {
                                    
                  // Update file URL in database if needed
                  const { data: { publicUrl } } = supabase.storage
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
                        cateringRequestId: newOrder.id
                      }
                    });
                    
                                      } catch (dbError) {
                    console.error('Error updating file URL in database:', dbError);
                  }
                }
              } catch (moveError) {
                console.error(`Exception moving file ${oldPath} to ${newPath}:`, moveError);
              }
            }
          } else {
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
                    cateringRequestId: newOrder.id,
                    category: "catering-order"
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
                      const newPath = `catering_order/${newOrder.id}/${fileName}`;
                      
                                            
                      try {
                        const { error: moveError } = await supabase.storage
                          .from(bucketName)
                          .move(oldPath, newPath);
                          
                        if (!moveError) {
                          // Update URL in database
                          const { data: { publicUrl } } = supabase.storage
                            .from(bucketName)
                            .getPublicUrl(newPath);
                            
                          await prisma.fileUpload.update({
                            where: { id: file.id },
                            data: { fileUrl: publicUrl }
                          });
                          
                                                  } else {
                          console.error(`Error moving file: ${moveError.message}`);
                        }
                      } catch (moveError) {
                        console.error('Error moving file:', moveError);
                      }
                    }
                  }
                }
              } catch (updateError) {
                console.error(`Error updating file ${file.id}:`, updateError);
              }
            }
          } else {
                      }
        }
      } catch (storageError) {
        console.error('Error updating storage paths:', storageError);
      }
    }

    // 4. Revalidate relevant paths
    revalidatePath('/admin/catering-orders');
    revalidatePath('/(api)/orders/catering-orders'); // Example: Revalidate an API route if needed

    // 5. Return success result
    return {
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
    };

  } catch (error) {
    console.error("Failed to create catering order:", error);
    
    // Print the full error details
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("Unknown error type:", error);
    }
    
    // Check if the error is a Prisma unique constraint violation on orderNumber
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Assuming the unique constraint is on 'orderNumber'. Adjust field name if different.
      const targetFields = error.meta?.target as string[] | undefined;
      if (targetFields?.includes('orderNumber')) {
        return {
          success: false,
          error: `Order number '${orderNumber}' already exists. Please use a unique order number.`,
          fieldErrors: { 
            orderNumber: { _errors: [`Order number '${orderNumber}' already exists.`] },
            _errors: [] // Add top-level _errors array
           } 
        };
      }
    }

    // Generic database error
    return {
      success: false,
      error: "Database error: Failed to create catering order.",
    };
  }
}

/**
 * Soft-deletes a CateringRequest order through the shared order-deletion
 * service. Only ADMIN and SUPER_ADMIN users can delete orders.
 */
export async function deleteCateringOrder(orderId: string): Promise<DeleteOrderResult> {
  try {
    // Server actions are public POST endpoints: authorise the caller here.
    const caller = await getActionCaller();
    if (!caller) {
      return { success: false, error: "Unauthorized: You must be logged in to perform this action." };
    }
    if (!caller.isPrivileged) {
      return {
        success: false,
        error: "Unauthorized: Only Admin or Super Admin can delete catering orders."
      };
    }

    const result = await softDeleteOrder(
      { orderType: 'catering', orderId },
      { deletedBy: caller.userId },
    );

    if (result.outcome === 'DELETED') {
      revalidatePath('/admin/catering-orders');
      revalidatePath(`/admin/catering-orders/${encodeURIComponent(result.orderNumber)}`);
    }

    return toDeleteOrderActionResult(result, orderId);
  } catch (error) {
    console.error("Failed to delete catering order:", error);
    return {
      success: false,
      error: "Database error: Failed to delete catering order."
    };
  }
}

// --- Create Order Action (will be added next) --- 