/**
 * Server-Side Carrier Service
 * Handles webhook execution and server-only carrier operations
 * For client-safe operations, use carrier-service-client.ts
 */

import { DriverStatus } from '@/types/prisma';
import { carrierLogger } from '@/utils/logger';
import { webhookLogger } from '@/lib/services/webhook-logger';
import { CARRIER_CONFIGS, CarrierServiceClient, type CarrierConfig } from '@/lib/services/carrier-service-client';

// Re-export client-safe types and class for backwards compatibility
export type { CarrierConfig } from '@/lib/services/carrier-service-client';
export { CarrierServiceClient } from '@/lib/services/carrier-service-client';

// For backwards compatibility, export client service as CarrierService
export { CarrierServiceClient as CarrierService } from '@/lib/services/carrier-service-client';

export interface WebhookPayload {
  orderNumber: string;
  status: string;
  metadata?: Record<string, unknown>;
}

// Use discriminated union for better type safety
export type WebhookResult =
  | {
      success: true;
      attempts: number;
      response?: Record<string, unknown>;
      carrierId: string;
    }
  | {
      success: false;
      attempts: number;
      lastError: string; // Always defined when success is false
      response?: Record<string, unknown>;
      carrierId: string;
    };

/**
 * Helper to get webhook logger instance
 * This is wrapped to keep webhook-logger import contained to server-only code
 */
async function getWebhookLogger() {
  return webhookLogger;
}

/**
 * Server-side webhook service
 * Extends the client-safe service with webhook capabilities
 */
export class CarrierWebhookService extends CarrierServiceClient {

  /**
   * Send status update to appropriate carrier
   */
  static async sendStatusUpdate(
    orderNumber: string,
    driverStatus: DriverStatus,
    metadata?: Record<string, unknown>
  ): Promise<WebhookResult | null> {
    const carrier = this.detectCarrier(orderNumber);

    if (!carrier || !carrier.enabled) {
      carrierLogger.error(`[CarrierService] Cannot send status update for order ${orderNumber}: carrier not found or disabled`);
      return null;
    }

    const mappedStatus = carrier.statusMapping[driverStatus];
    if (!mappedStatus) {
      carrierLogger.error(`[CarrierService] Cannot send status update for order ${orderNumber}: status '${driverStatus}' not mapped for carrier ${carrier.id}`);
      return null;
    }

    
    // Remove carrier prefix for clean order number
    const cleanOrderNumber = orderNumber.replace(carrier.orderPrefix, '');

    const payload: WebhookPayload = {
      orderNumber: cleanOrderNumber,
      status: mappedStatus,
      metadata,
    };

    return this.executeWebhook(carrier, payload);
  }

  /**
   * Execute webhook with retry logic
   */
  private static async executeWebhook(
    carrier: CarrierConfig,
    payload: WebhookPayload
  ): Promise<WebhookResult> {
    let lastError: string | undefined;
    let response: Record<string, unknown> | undefined;

    for (let attempt = 1; attempt <= carrier.retryPolicy.maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        const result = await this.makeWebhookRequest(carrier, payload);
        const responseTime = Date.now() - startTime;

        // Check if the response indicates success (carrier-specific logic)
        const isSuccess = this.isSuccessResponse(carrier, result);

        if (isSuccess) {
          // Log successful webhook
          const logger = await getWebhookLogger();
          await logger.logSuccess({
            carrierId: carrier.id,
            orderNumber: payload.orderNumber,
            status: payload.status,
            responseTime,
          });

          return {
            success: true,
            attempts: attempt,
            response: result,
            carrierId: carrier.id,
          };
        } else {
          lastError = `${carrier.name} API returned error response`;
          response = result;

          // Log failed webhook (non-success response)
          const logger = await getWebhookLogger();
          await logger.logFailure({
            carrierId: carrier.id,
            orderNumber: payload.orderNumber,
            status: payload.status,
            errorMessage: lastError,
            responseTime,
          });
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        lastError = error instanceof Error ? error.message : 'Unknown error';

        // Log failed webhook (exception)
        const logger = await getWebhookLogger();
        await logger.logFailure({
          carrierId: carrier.id,
          orderNumber: payload.orderNumber,
          status: payload.status,
          errorMessage: lastError,
          responseTime,
        });

        if (this.isNonRetryableError(error)) {
          break;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < carrier.retryPolicy.maxAttempts) {
        const delay = carrier.retryPolicy.baseDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      attempts: carrier.retryPolicy.maxAttempts,
      lastError: lastError || 'Unknown error occurred',
      response,
      carrierId: carrier.id,
    };
  }

  /**
   * Make HTTP request to carrier webhook
   */
  private static async makeWebhookRequest(
    carrier: CarrierConfig,
    payload: WebhookPayload
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), carrier.retryPolicy.timeoutMs);

    try {
      const headers = { ...carrier.webhookHeaders };
      if (carrier.apiKey) {
        headers['x-api-key'] = carrier.apiKey;
      }

      const response = await fetch(carrier.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Webhook request timed out after ${carrier.retryPolicy.timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Check if response indicates success (carrier-specific)
   */
  private static isSuccessResponse(carrier: CarrierConfig, response: Record<string, unknown>): boolean {
    switch (carrier.id) {
      case 'catervalley':
        return typeof response.result === 'boolean' && response.result === true;
      default:
        // Generic success check
        return response.success === true || response.status === 'success';
    }
  }

  /**
   * Check if error should not be retried
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
   * Send bulk status updates to multiple carriers
   */
  static async sendBulkStatusUpdates(
    updates: Array<{ orderNumber: string; driverStatus: DriverStatus; metadata?: Record<string, unknown> }>
  ): Promise<Array<(WebhookResult & { orderNumber: string }) | null>> {
    const results = await Promise.allSettled(
      updates.map(async ({ orderNumber, driverStatus, metadata }) => {
        const result = await this.sendStatusUpdate(orderNumber, driverStatus, metadata);
        return result ? { ...result, orderNumber } : null;
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const update = updates[index];
        if (!update) {
          return null;
        }
        const carrier = this.detectCarrier(update.orderNumber);
        return {
          success: false,
          attempts: 0,
          lastError: result.reason?.message || 'Unknown error in bulk update',
          orderNumber: update.orderNumber,
          carrierId: carrier?.id || 'unknown',
        };
      }
    });
  }
} 