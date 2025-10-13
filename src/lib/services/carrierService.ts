/**
 * Generic Carrier Service
 * Handles multiple carrier integrations in a scalable way
 */

import { DriverStatus } from '@/types/prisma';

export interface CarrierConfig {
  id: string;
  name: string;
  webhookUrl: string;
  apiKey?: string;
  enabled: boolean;
  statusMapping: Record<DriverStatus, string | null>;
  orderPrefix: string;
  webhookHeaders: Record<string, string>;
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    timeoutMs: number;
  };
}

export interface WebhookPayload {
  orderNumber: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookResult {
  success: boolean;
  attempts: number;
  lastError?: string;
  response?: Record<string, unknown>;
  carrierId: string;
}

// Carrier configurations
const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  catervalley: {
    id: 'catervalley',
    name: 'CaterValley',
    webhookUrl: process.env.CATERVALLEY_WEBHOOK_URL || 'https://api.catervalley.com/api/operation/order/update-order-status',
    apiKey: process.env.CATERVALLEY_API_KEY,
    enabled: true,
    statusMapping: {
      ASSIGNED: 'CONFIRM',
      ARRIVED_AT_VENDOR: 'READY',
      EN_ROUTE_TO_CLIENT: 'ON_THE_WAY',
      ARRIVED_TO_CLIENT: 'ON_THE_WAY',
      COMPLETED: 'COMPLETED',
    },
    orderPrefix: 'CV-',
    webhookHeaders: {
      'Content-Type': 'application/json',
      'partner': 'ready-set',
    },
    retryPolicy: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      timeoutMs: 10000,
    },
  },
  // Future carriers can be added here
  // ubereats: {
  //   id: 'ubereats',
  //   name: 'Uber Eats',
  //   webhookUrl: process.env.UBEREATS_WEBHOOK_URL,
  //   enabled: false,
  //   // ... other config
  // },
};

export class CarrierService {
  /**
   * Get all available carrier configurations
   */
  static getCarriers(): CarrierConfig[] {
    return Object.values(CARRIER_CONFIGS);
  }

  /**
   * Get a specific carrier configuration
   */
  static getCarrier(carrierId: string): CarrierConfig | null {
    return CARRIER_CONFIGS[carrierId] || null;
  }

  /**
   * Determine which carrier an order belongs to based on order number
   */
  static detectCarrier(orderNumber: string): CarrierConfig | null {
    for (const carrier of Object.values(CARRIER_CONFIGS)) {
      if (orderNumber.startsWith(carrier.orderPrefix)) {
        return carrier;
      }
    }
    return null;
  }

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
            return null;
    }

    const mappedStatus = carrier.statusMapping[driverStatus];
    if (!mappedStatus) {
            return {
        success: true,
        attempts: 0,
        carrierId: carrier.id,
      };
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
      try {
        const result = await this.makeWebhookRequest(carrier, payload);
        
        // Check if the response indicates success (carrier-specific logic)
        const isSuccess = this.isSuccessResponse(carrier, result);
        
        if (isSuccess) {
                    return {
            success: true,
            attempts: attempt,
            response: result,
            carrierId: carrier.id,
          };
        } else {
          lastError = `${carrier.name} API returned error response`;
          console.warn(`${carrier.name} webhook logical failure (attempt ${attempt}/${carrier.retryPolicy.maxAttempts})`);
          response = result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${carrier.name} webhook attempt ${attempt}/${carrier.retryPolicy.maxAttempts} failed:`, lastError);
        
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

    console.error(`${carrier.name} webhook failed after ${carrier.retryPolicy.maxAttempts} attempts. Last error: ${lastError}`);
    
    return {
      success: false,
      attempts: carrier.retryPolicy.maxAttempts,
      lastError,
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

  /**
   * Test connectivity to all enabled carriers
   */
  static async testConnections(): Promise<Record<string, { connected: boolean; latencyMs?: number; error?: string }>> {
    const results: Record<string, { connected: boolean; latencyMs?: number; error?: string }> = {};

    const testPromises = Object.values(CARRIER_CONFIGS)
      .filter(carrier => carrier.enabled)
      .map(async (carrier) => {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const headers = { ...carrier.webhookHeaders };
          if (carrier.apiKey) {
            headers['x-api-key'] = carrier.apiKey;
          }

          const response = await fetch(carrier.webhookUrl, {
            method: 'OPTIONS',
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const latencyMs = Date.now() - startTime;

          results[carrier.id] = {
            connected: response.ok,
            latencyMs,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          results[carrier.id] = {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

    await Promise.all(testPromises);
    return results;
  }
} 