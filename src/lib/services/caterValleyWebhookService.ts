/**
 * CaterValley Webhook Service
 * Handles sending status updates from Ready Set to CaterValley
 */

import { DriverStatus } from '@/types/prisma';

interface WebhookPayload {
  orderNumber: string;
  status: CaterValleyStatus;
}

interface WebhookResponse {
  result: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  lastError?: string;
  response?: WebhookResponse;
}

type CaterValleyStatus = 'CONFIRM' | 'READY' | 'ON_THE_WAY' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

const CATERVALLEY_WEBHOOK_URL = process.env.CATERVALLEY_WEBHOOK_URL || 'https://api.catervalley.com/api/operation/order/update-order-status';
const WEBHOOK_TIMEOUT = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second, then exponential backoff

export class CaterValleyWebhookService {
  /**
   * Maps Ready Set driver statuses to CaterValley statuses
   */
  private static mapDriverStatusToCaterValley(driverStatus: DriverStatus): CaterValleyStatus | null {
    const statusMap: Record<DriverStatus, CaterValleyStatus | null> = {
      ASSIGNED: 'CONFIRM',
      ARRIVED_AT_VENDOR: 'READY',
      PICKED_UP: 'READY', // Order picked up, mapped to READY for CaterValley
      EN_ROUTE_TO_CLIENT: 'ON_THE_WAY',
      ARRIVED_TO_CLIENT: 'ON_THE_WAY', // Still on the way until confirmed delivered
      COMPLETED: 'COMPLETED',
    };

    return statusMap[driverStatus] || null;
  }

  /**
   * Sends a status update to CaterValley with retry logic
   */
  static async sendStatusUpdate(
    orderNumber: string, 
    driverStatus: DriverStatus,
    options: { 
      maxRetries?: number; 
      timeoutMs?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<WebhookDeliveryResult> {
    const { maxRetries = MAX_RETRY_ATTEMPTS, timeoutMs = WEBHOOK_TIMEOUT } = options;

    try {
      const caterValleyStatus = this.mapDriverStatusToCaterValley(driverStatus);
      
      if (!caterValleyStatus) {
                return {
          success: true,
          attempts: 0,
        };
      }

      // Remove the CV- prefix if it exists to get clean order number
      const cleanOrderNumber = orderNumber.replace(/^CV-/, '');

      const payload: WebhookPayload = {
        orderNumber: cleanOrderNumber,
        status: caterValleyStatus,
      };

      
      // Attempt webhook delivery with retries
      let lastError: string | undefined;
      let response: WebhookResponse | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.makeWebhookRequest(payload, timeoutMs);
          
          if (result.result) {
                        return {
              success: true,
              attempts: attempt,
              response: result,
            };
          } else {
            lastError = `CaterValley API returned error: ${result.message}`;
            console.warn(`CaterValley webhook logical failure for order ${cleanOrderNumber} (attempt ${attempt}/${maxRetries}): ${lastError}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`CaterValley webhook attempt ${attempt}/${maxRetries} failed for order ${cleanOrderNumber}:`, lastError);
          
          // Don't retry on certain error types
          if (this.isNonRetryableError(error)) {
            break;
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }

      // All attempts failed
      console.error(`CaterValley webhook failed after ${maxRetries} attempts for order ${cleanOrderNumber}. Last error: ${lastError}`);
      
      return {
        success: false,
        attempts: maxRetries,
        lastError,
        response,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in sendStatusUpdate';
      console.error('Error in CaterValley webhook service:', errorMessage);
      
      return {
        success: false,
        attempts: 0,
        lastError: errorMessage,
      };
    }
  }

  /**
   * Makes the actual HTTP request to CaterValley webhook
   */
  private static async makeWebhookRequest(payload: WebhookPayload, timeoutMs: number): Promise<WebhookResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(CATERVALLEY_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'partner': 'ready-set', // Required by CaterValley API
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData: WebhookResponse = await response.json();
      
      // Validate response structure
      if (typeof responseData.result !== 'boolean') {
        console.warn('CaterValley response missing or invalid "result" field:', responseData);
      }

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Webhook request timed out after ${timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Checks if an error should not be retried
   */
  private static isNonRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    
    // Don't retry on authentication/authorization errors
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
      return true;
    }
    
    // Don't retry on bad request errors
    if (message.includes('400') || message.includes('bad request')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Bulk status update for multiple orders
   */
  static async sendBulkStatusUpdates(
    updates: Array<{ orderNumber: string; driverStatus: DriverStatus }>
  ): Promise<Array<WebhookDeliveryResult & { orderNumber: string }>> {
    const results = await Promise.allSettled(
      updates.map(async ({ orderNumber, driverStatus }) => {
        const result = await this.sendStatusUpdate(orderNumber, driverStatus);
        return { ...result, orderNumber };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          attempts: 0,
          lastError: result.reason?.message || 'Unknown error in bulk update',
          orderNumber: updates[index]?.orderNumber || 'unknown',
        };
      }
    });
  }

    /**
   * Test webhook connectivity
   */
  static async testConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Send a test ping to the webhook endpoint
      const response = await fetch(CATERVALLEY_WEBHOOK_URL, {
        method: 'OPTIONS', // Use OPTIONS to test connectivity without side effects
        headers: {
          'partner': 'ready-set',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      return {
        connected: response.ok,
        latencyMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
} 