/**
 * Client-Safe Carrier Service
 * Configuration reading and testing methods that can be used in client components
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

// Carrier configurations
export const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  catervalley: {
    id: 'catervalley',
    name: 'CaterValley',
    webhookUrl: process.env.CATERVALLEY_WEBHOOK_URL || 'https://api.catervalley.com/api/operation/order/update-order-status',
    apiKey: process.env.CATERVALLEY_API_KEY,
    enabled: true,
    statusMapping: {
      ASSIGNED: 'CONFIRM',
      ARRIVED_AT_VENDOR: 'READY',
      PICKED_UP: 'ON_THE_WAY',
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
  ezcater: {
    id: 'ezcater',
    name: 'ezCater',
    // ezCater uses GraphQL API, not webhooks - this URL is for reference only
    webhookUrl: process.env.EZCATER_API_URL || 'https://api.ezcater.com/graphql',
    apiKey: process.env.EZCATER_API_TOKEN,
    enabled: true,
    statusMapping: {
      ASSIGNED: 'COURIER_ASSIGNED',
      ARRIVED_AT_VENDOR: 'ARRIVED_AT_PICKUP',
      PICKED_UP: 'ORDER_PICKED_UP',
      EN_ROUTE_TO_CLIENT: 'EN_ROUTE_TO_DROPOFF',
      ARRIVED_TO_CLIENT: 'ARRIVED_AT_DROPOFF',
      COMPLETED: 'ORDER_DELIVERED',
    },
    orderPrefix: 'EZ-',
    webhookHeaders: {
      'Content-Type': 'application/json',
    },
    retryPolicy: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      timeoutMs: 20000, // ezCater GraphQL can be slower
    },
  },
};

// Constants for connectivity testing
const CONNECTIVITY_TEST_TIMEOUT_MS = 5000;

/**
 * Client-safe carrier configuration service
 */
export class CarrierServiceClient {
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
   * Test connectivity to all enabled carriers
   */
  static async testConnections(): Promise<Record<string, { connected: boolean; latencyMs?: number; error?: string }>> {
    const results: Record<string, { connected: boolean; latencyMs?: number; error?: string }> = {};

    const testPromises = Object.values(CARRIER_CONFIGS)
      .filter(carrier => carrier.enabled)
      .map(async (carrier) => {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_TEST_TIMEOUT_MS);

        try {
          // For CaterValley, test via our internal status endpoint
          if (carrier.id === 'catervalley') {
            const response = await fetch('/api/cater-valley/status', {
              method: 'GET',
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const latencyMs = Date.now() - startTime;

            if (response.ok) {
              const data = await response.json();
              // Check for operational status or explicit connected flag
              results[carrier.id] = {
                connected: data.status === 'ok' || data.status === 'operational' || data.connected === true,
                latencyMs,
              };
            } else {
              results[carrier.id] = {
                connected: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
              };
            }
          } else {
            // For other carriers, use HEAD request (lighter than OPTIONS)
            const headers = { ...carrier.webhookHeaders };
            if (carrier.apiKey) {
              headers['x-api-key'] = carrier.apiKey;
            }

            const response = await fetch(carrier.webhookUrl, {
              method: 'HEAD',
              headers,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const latencyMs = Date.now() - startTime;

            results[carrier.id] = {
              connected: response.ok,
              latencyMs,
            };
          }
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
