// src/app/api/cater-valley/update-order-status/route.ts

import { type NextRequest, NextResponse } from 'next/server';
import {
  updateCaterValleyOrderStatus,
  ALLOWED_STATUSES,
  type OrderStatus,
  type CaterValleyUpdateResult,
} from '@/services/caterValleyService'; // Import from the service file

// Interface for the request body expected by this route handler
interface UpdateStatusRequestBody {
  orderNumber: string;
  status: OrderStatus;
  // Add any other internal identifiers if needed, e.g., your internal order ID
  // internalOrderId?: string;
}

// --- API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    // 1. Parse Request Body
    if (request.headers.get('content-type') !== 'application/json') {
        return NextResponse.json(
            { message: 'Invalid Content-Type. Expected application/json.' },
            { status: 415 } // Unsupported Media Type
        );
    }

    let requestBody: UpdateStatusRequestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        console.error("Error parsing JSON body:", e);
        return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }


    // 2. Validate Input
    const { orderNumber, status } = requestBody;
    if (!orderNumber || !status) {
      return NextResponse.json(
        { message: 'Missing required fields: orderNumber and status' },
        { status: 400 } // Bad Request
      );
    }
    // Use the imported constant for validation
    if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
            { message: `Invalid status: ${status}. Must be one of ${ALLOWED_STATUSES.join(', ')}.` },
            { status: 400 }
        );
    }

    // --- Security Note ---
    // Add authentication/authorization checks here if this endpoint
    // needs to be protected. Verify the caller has permission to update this order.
    // Example: const session = await getServerSession(authOptions); if (!session) { return NextResponse.json({ message: 'Unauthorized' }, { status: 401 }); }


    // 3. Call the External API via the service function
    // The core logic is now in the service function
    const result: CaterValleyUpdateResult = await updateCaterValleyOrderStatus(
      orderNumber,
      status
    );

    // 4. Handle External API Response based on the structured result
    if (!result.success) {
      // Handle specific error cases
      if (!result.orderFound && result.statusCode === 404) {
        // Order not found in CaterValley - this is a common scenario
        console.warn(`Order ${orderNumber} not found in CaterValley system during status update to ${status}`);
        return NextResponse.json(
          {
            message: `Order ${orderNumber} not found in CaterValley system`,
            orderFound: false,
            details: result.error,
          },
          { status: 404 }
        );
      }
      
      // Handle validation errors
      if (result.error && (result.error.includes('Invalid orderNumber') || result.error.includes('Invalid status'))) {
        return NextResponse.json(
          {
            message: result.error,
          },
          { status: 400 }
        );
      }
      
      // Handle other CaterValley API errors
      const statusCode = result.statusCode || 422;
      return NextResponse.json(
        {
          message: `Failed to update status in CaterValley: ${result.error}`,
          orderFound: result.orderFound,
          caterValleyStatusCode: result.statusCode,
        },
        { status: statusCode }
      );
    }

    // 5. Optional: Update Your Own Database (If this route is called directly for other reasons)
    // This logic might be redundant if the primary update happens in the /api/catering-requests route
    /*
    try {
      // Example using a hypothetical db client
      await db.updateOrder(requestBody.internalOrderId ?? orderNumber, { 
        status: status, 
        lastExternalUpdate: new Date(),
      });
    } catch (dbError) {
      console.error(`Failed to update internal database for order ${orderNumber} after successful CaterValley update:`, dbError);
      return NextResponse.json(
        { message: 'External status updated, but internal update failed. Please check logs.' },
        { status: 500 } 
      );
    }
    */

    // 6. Return Success Response
    return NextResponse.json(
      {
        message: 'Order status successfully updated in CaterValley.',
        orderNumber,
        status,
        orderFound: true,
        caterValleyResponse: result.response,
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    // Catch unexpected errors
    console.error('Error in /api/cater-valley/update-order-status:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';

    // Return a generic server error response
    return NextResponse.json(
      { message: `Internal Server Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// export const dynamic = 'force-dynamic'; // If needed, though default should be fine 