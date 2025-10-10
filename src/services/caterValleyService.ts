// src/services/caterValleyService.ts

// Define allowed status values based on the documentation
export const ALLOWED_STATUSES = [
    'CONFIRM',
    'READY',
    'ON_THE_WAY',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
  ] as const; // Use 'as const' for stricter type checking
  
  // Type for the allowed statuses
export type OrderStatus = (typeof ALLOWED_STATUSES)[number];
  
  // Interface for the response from the CaterValley API
export interface CaterValleyApiResponse {
    result: boolean;
    message: string;
    data: Record<string, never>; // Empty object based on docs
}

// Enhanced response interface that includes error handling info
export interface CaterValleyUpdateResult {
  success: boolean;
  orderFound: boolean;
  response?: CaterValleyApiResponse;
  error?: string;
  statusCode?: number;
}
  
  /**
   * Updates the order status via the CaterValley API.
   * Enhanced with better error handling for common scenarios like order not found.
   * 
   * @param orderNumber - The CaterValley order number.
   * @param status - The new status to set.
   * @returns A structured result indicating success, error details, and whether the order was found.
   */
export async function updateCaterValleyOrderStatus(
    orderNumber: string,
    status: OrderStatus
  ): Promise<CaterValleyUpdateResult> {
    const CATER_VALLEY_API_URL =
      'https://api.catervalley.com/api/operation/order/update-order-status';
    // Hardcode the partner header as specified in the CaterValley documentation
    const PARTNER_HEADER = 'ready-set';
  
    // Input validation
    if (!orderNumber || typeof orderNumber !== 'string' || orderNumber.trim() === '') {
        return {
          success: false,
          orderFound: false,
          error: 'Invalid orderNumber provided for CaterValley update.',
        };
    }
    if (!status || !ALLOWED_STATUSES.includes(status)) {
        return {
          success: false,
          orderFound: false,
          error: `Invalid status provided for CaterValley update: ${status}. Must be one of ${ALLOWED_STATUSES.join(', ')}.`,
        };
    }
  
    // Ensure status is always uppercase as expected by the API
    const normalizedStatus = status.toUpperCase() as OrderStatus;
    
    
    try {
      const response = await fetch(CATER_VALLEY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'partner': PARTNER_HEADER, // Crucial header for CaterValley
        },
        body: JSON.stringify({ 
          orderNumber, 
          status: normalizedStatus 
        }),
        // Consider adding a timeout if needed
        // signal: AbortSignal.timeout(10000) // 10 seconds timeout
      });
  
      // Log raw response details for debugging
      const responseText = await response.text(); 
      
      if (!response.ok) {
        // Handle specific HTTP status codes
        if (response.status === 404) {
          // Order not found - this is a common scenario that should be handled gracefully
          let errorMessage = 'Order not found in CaterValley system';
          let errorDetails = {};
          
          try {
            const errorBody = JSON.parse(responseText);
            if (errorBody.message) {
              errorMessage = errorBody.message;
            }
            errorDetails = errorBody;
          } catch (parseError) {
            // Use default message if can't parse response
            if (responseText) {
              errorMessage += `. Response: ${responseText}`;
            }
          }
          
          console.warn(`[CaterValley Service] Order ${orderNumber} not found in CaterValley system:`, errorDetails);
          
          return {
            success: false,
            orderFound: false,
            error: errorMessage,
            statusCode: 404,
          };
        }
        
        // Handle other HTTP errors
        let errorMessage = `CaterValley API request failed with status ${response.status}`;
        try {
          // Try parsing the already read text
          const errorBody = JSON.parse(responseText);
          if (errorBody.message) {
              errorMessage += `: ${errorBody.message}`;
          }
        } catch (parseError) { 
          // Use the raw text if JSON parsing fails
          errorMessage += `. Response body: ${responseText}`; 
        }
        
        console.error(`[CaterValley Service] API Error for order ${orderNumber}:`, { 
          status: response.status, 
          message: errorMessage, 
          responseText 
        });
        
        return {
          success: false,
          orderFound: response.status !== 404, // Assume order exists for non-404 errors
          error: errorMessage,
          statusCode: response.status,
        };
      }
  
      // Parse the successful JSON response from the text
      const responseData: CaterValleyApiResponse = JSON.parse(responseText);
  
      // Optional: Add more specific checks based on expected response structure
      if (typeof responseData.result !== 'boolean') {
          console.warn("CaterValley response 'result' field has unexpected type:", responseData);
      }

      // Handle logical failure reported by the API
      if (responseData.result === false) {
        console.warn(`CaterValley status update logically failed for order ${orderNumber} to ${normalizedStatus}: ${responseData.message}`);
        
        return {
          success: false,
          orderFound: true, // Order exists but operation failed
          response: responseData,
          error: responseData.message || 'Unknown logical failure',
          statusCode: 200,
        };
      } else {
              }
  
      // Success case
      return {
        success: true,
        orderFound: true,
        response: responseData,
      };
  
    } catch (error) {
      console.error('Error calling CaterValley API:', error);
      
      const errorMessage = error instanceof Error 
        ? `Network/API error: ${error.message}`
        : 'An unknown error occurred while updating status.';
      
      return {
        success: false,
        orderFound: false, // Can't determine if order exists due to network error
        error: `Failed to update CaterValley order status for ${orderNumber}: ${errorMessage}`,
      };
    }
}

// Legacy function that maintains backward compatibility by throwing errors
// Deprecated: Use updateCaterValleyOrderStatus instead for better error handling
export async function updateCaterValleyOrderStatusLegacy(
  orderNumber: string,
  status: OrderStatus
): Promise<CaterValleyApiResponse> {
  const result = await updateCaterValleyOrderStatus(orderNumber, status);
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to update CaterValley order status');
  }
  
  return result.response!;
} 