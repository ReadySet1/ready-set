/**
 * Webhook Logger Service
 * Tracks all webhook attempts to carrier systems for monitoring integration health
 */

import { createAdminClient } from '@/utils/supabase/server';
import { carrierLogger } from '@/utils/logger';

export interface WebhookLogData {
  carrierId: string;
  orderNumber: string;
  status: string;
  success: boolean;
  errorMessage?: string;
  responseTime?: number;
}

export interface WebhookSuccessRate {
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number | null; // Percentage (0-100) or null if no attempts
}

/**
 * WebhookLogger class handles logging and querying webhook attempts
 */
export class WebhookLogger {
  /**
   * Log a successful webhook attempt
   */
  async logSuccess(data: {
    carrierId: string;
    orderNumber: string;
    status: string;
    responseTime?: number;
  }): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { error } = await supabase.from('webhook_logs').insert({
        carrier_id: data.carrierId,
        order_number: data.orderNumber,
        status: data.status,
        success: true,
        response_time: data.responseTime,
      });

      if (error) {
        carrierLogger.error('[WebhookLogger] Failed to log successful webhook:', error);
      } else {
        carrierLogger.info(
          `[WebhookLogger] Logged successful webhook for carrier ${data.carrierId}, order ${data.orderNumber}`
        );
      }
    } catch (error) {
      carrierLogger.error('[WebhookLogger] Exception logging successful webhook:', error);
    }
  }

  /**
   * Log a failed webhook attempt
   */
  async logFailure(data: {
    carrierId: string;
    orderNumber: string;
    status: string;
    errorMessage: string;
    responseTime?: number;
  }): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { error } = await supabase.from('webhook_logs').insert({
        carrier_id: data.carrierId,
        order_number: data.orderNumber,
        status: data.status,
        success: false,
        error_message: data.errorMessage,
        response_time: data.responseTime,
      });

      if (error) {
        carrierLogger.error('[WebhookLogger] Failed to log failed webhook:', error);
      } else {
        carrierLogger.warn(
          `[WebhookLogger] Logged failed webhook for carrier ${data.carrierId}, order ${data.orderNumber}: ${data.errorMessage}`
        );
      }
    } catch (error) {
      carrierLogger.error('[WebhookLogger] Exception logging failed webhook:', error);
    }
  }

  /**
   * Calculate webhook success rate for a carrier
   * @param carrierId - The carrier ID to calculate success rate for
   * @param daysBack - Number of days to look back (default: 30)
   * @returns Success rate data including percentage
   */
  async getSuccessRate(
    carrierId: string,
    daysBack: number = 30
  ): Promise<WebhookSuccessRate> {
    try {
      const supabase = await createAdminClient();

      // Calculate the date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);

      // Get all webhook logs for this carrier within the time range
      const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('success')
        .eq('carrier_id', carrierId)
        .gte('created_at', dateThreshold.toISOString());

      if (error) {
        carrierLogger.error(
          `[WebhookLogger] Failed to fetch webhook logs for carrier ${carrierId}:`,
          error
        );
        return {
          totalAttempts: 0,
          successfulAttempts: 0,
          successRate: null,
        };
      }

      if (!logs || logs.length === 0) {
        carrierLogger.info(
          `[WebhookLogger] No webhook logs found for carrier ${carrierId} in the last ${daysBack} days`
        );
        return {
          totalAttempts: 0,
          successfulAttempts: 0,
          successRate: null,
        };
      }

      const totalAttempts = logs.length;
      const successfulAttempts = logs.filter((log) => log.success).length;
      const successRate = (successfulAttempts / totalAttempts) * 100;

      carrierLogger.debug(
        `[WebhookLogger] Success rate for carrier ${carrierId}: ${successRate.toFixed(2)}% (${successfulAttempts}/${totalAttempts})`
      );

      return {
        totalAttempts,
        successfulAttempts,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      };
    } catch (error) {
      carrierLogger.error(
        `[WebhookLogger] Exception calculating success rate for carrier ${carrierId}:`,
        error
      );
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        successRate: null,
      };
    }
  }

  /**
   * Get recent webhook logs for a carrier
   * @param carrierId - The carrier ID to get logs for
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of webhook log entries
   */
  async getRecentLogs(
    carrierId: string,
    limit: number = 100
  ): Promise<WebhookLogData[]> {
    try {
      const supabase = await createAdminClient();

      const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('carrier_id', carrierId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        carrierLogger.error(
          `[WebhookLogger] Failed to fetch recent logs for carrier ${carrierId}:`,
          error
        );
        return [];
      }

      return (logs || []).map((log) => ({
        carrierId: log.carrier_id,
        orderNumber: log.order_number,
        status: log.status,
        success: log.success,
        errorMessage: log.error_message || undefined,
        responseTime: log.response_time || undefined,
      }));
    } catch (error) {
      carrierLogger.error(
        `[WebhookLogger] Exception fetching recent logs for carrier ${carrierId}:`,
        error
      );
      return [];
    }
  }
}

// Export a singleton instance
export const webhookLogger = new WebhookLogger();
