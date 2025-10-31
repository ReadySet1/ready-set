// src/lib/services/caterValleyService.ts

import { withCaterValleyResilience, CircuitBreakerOpenError } from '@/utils/api-resilience';

// Define allowed status values based on the CaterValley documentation
const CATER_VALLEY_ALLOWED_STATUSES = [
  'CONFIRM',
  'READY',
  'ON_THE_WAY',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const; // Use 'as const' for stricter type checking

// Type for the allowed CaterValley statuses
export type CaterValleyOrderStatus = (typeof CATER_VALLEY_ALLOWED_STATUSES)[number];

// Interface for the response from the CaterValley API
interface CaterValleyApiResponse {
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
 * Updates the order status in the CaterValley system via their API.
 * Enhanced with better error handling for common scenarios like order not found.
 * Includes automatic retry, circuit breaker, and timeout protection.
 *
 * Part of REA-77: External API Resilience Implementation
 *
 * @param orderNumber - The order number recognized by CaterValley.
 * @param status - The new status to set, must be a valid CaterValleyOrderStatus.
 * @returns A promise that resolves with a structured result indicating success, error details, and whether the order was found.
 */
export async function updateCaterValleyOrderStatus(
  orderNumber: string,
  status: CaterValleyOrderStatus
): Promise<CaterValleyUpdateResult> {
  const CATER_VALLEY_API_URL =
    process.env.NEXT_PUBLIC_CATER_VALLEY_API_URL || 'https://api.catervalley.com/api/operation/order/update-order-status';
  const PARTNER_HEADER = process.env.NEXT_PUBLIC_CATER_VALLEY_PARTNER_HEADER || 'ready-set';

  // --- Input Validation ---
  if (!orderNumber || typeof orderNumber !== 'string' || orderNumber.trim() === '') {
    return {
      success: false,
      orderFound: false,
      error: '[CaterValley Service] Invalid orderNumber provided.',
    };
  }

  // Validate against the specific CaterValley statuses
  if (!status || !CATER_VALLEY_ALLOWED_STATUSES.includes(status)) {
    return {
      success: false,
      orderFound: false,
      error: `[CaterValley Service] Invalid status provided: ${status}. Must be one of ${CATER_VALLEY_ALLOWED_STATUSES.join(', ')}.`,
    };
  }


  try {
    // Wrap the fetch call with resilience (retry, circuit breaker, timeout)
    const response = await withCaterValleyResilience(async () => {
      return await fetch(CATER_VALLEY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'partner': PARTNER_HEADER, // Crucial header for CaterValley
          // Add other headers if needed, e.g., Authorization if they implement it later
        },
        body: JSON.stringify({ orderNumber, status }),
        // Timeout is handled by the resilience wrapper
      });
    });

    // --- Enhanced Response Handling ---
    if (!response.ok) {
      // Handle specific HTTP status codes
      if (response.status === 404) {
        // Order not found - this is a common scenario that should be handled gracefully
        let errorMessage = 'Order not found in CaterValley system';
        let errorDetails = {};
        
        try {
          const errorBody = await response.json();
          if (errorBody.message) {
            errorMessage = errorBody.message;
          }
          errorDetails = errorBody;
        } catch (parseError) {
          // Use default message if can't parse response
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
      let errorDetails = {};
      
      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage += `: ${errorBody.message}`;
        }
        errorDetails = errorBody;
      } catch (parseError) {
        // Ignore if error body isn't valid JSON
        errorMessage += `: ${response.statusText}`;
      }
      
      console.error(`[CaterValley Service] API Error for order ${orderNumber}:`, { 
        status: response.status, 
        message: errorMessage, 
        details: errorDetails 
      });
      
      return {
        success: false,
        orderFound: response.status !== 404, // Assume order exists for non-404 errors
        error: errorMessage,
        statusCode: response.status,
      };
    }

    const responseData: CaterValleyApiResponse = await response.json();
    
    // Optional: Add more specific checks based on expected response structure
    if (typeof responseData.result !== 'boolean') {
      console.warn("[CaterValley Service] Response 'result' field has unexpected type:", responseData);
    }

    // Handle logical failure reported by the API
    if (responseData.result === false) {
      console.warn(`[CaterValley Service] API reported logical failure for order ${orderNumber}: ${responseData.message}`);
      
      return {
        success: false,
        orderFound: true, // Order exists but operation failed
        response: responseData,
        error: responseData.message || 'Unknown logical failure',
        statusCode: 200,
      };
    }

    // Success case
        
    return {
      success: true,
      orderFound: true,
      response: responseData,
    };

  } catch (error) {
    // Handle circuit breaker open error specially
    if (error instanceof CircuitBreakerOpenError) {
      console.warn(
        `[CaterValley Service] Circuit breaker open for order ${orderNumber}:`,
        {
          retryAfter: error.retryAfter,
          estimatedWaitMs: error.estimatedWaitMs,
        }
      );

      return {
        success: false,
        orderFound: false, // Can't determine if order exists due to circuit breaker
        error: error.message,
        statusCode: 503, // Service Unavailable
      };
    }

    console.error(`[CaterValley Service] Error calling API for order ${orderNumber}:`, error);

    const errorMessage = error instanceof Error
      ? `Network/API error: ${error.message}`
      : 'An unknown error occurred while updating status.';

    return {
      success: false,
      orderFound: false, // Can't determine if order exists due to network error
      error: `[CaterValley Service] ${errorMessage}`,
    };
  }
}

// Legacy function that maintains backward compatibility by throwing errors
// Deprecated: Use updateCaterValleyOrderStatus instead for better error handling
export async function updateCaterValleyOrderStatusLegacy(
  orderNumber: string,
  status: CaterValleyOrderStatus
): Promise<CaterValleyApiResponse> {
  const result = await updateCaterValleyOrderStatus(orderNumber, status);
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to update CaterValley order status');
  }
  
  return result.response!;
}

// Potential future functions:
// export async function getCaterValleyOrderStatus(orderNumber: string) { ... }
// export async function createCaterValleyOrder(orderDetails: any) { ... } 