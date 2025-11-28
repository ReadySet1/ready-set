/**
 * Notification Analytics Service
 *
 * Tracks push notification delivery, failures, and engagement metrics.
 * Integrates with the NotificationAnalytics database table for persistence.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db/prisma";
import { DeliveryStatusEvent } from "./push";
import { DispatchNotificationRecipient } from "./delivery-status";

/**
 * Notification status types for analytics tracking.
 */
export type NotificationStatus = "sent" | "delivered" | "failed" | "clicked";

/**
 * Notification types supported by the analytics system.
 */
export type NotificationType = "delivery_status" | "order_update" | "system" | "marketing";

export interface TrackNotificationParams {
  profileId: string;
  notificationType: NotificationType;
  event: string;
  recipientType: DispatchNotificationRecipient | "DRIVER";
  orderId?: string;
  dispatchId?: string;
  status?: NotificationStatus;
  errorMessage?: string;
  fcmMessageId?: string;
}

export interface NotificationAnalyticsRecord {
  id: string;
  profileId: string;
  notificationType: string;
  event: string;
  recipientType: string;
  orderId: string | null;
  dispatchId: string | null;
  status: string;
  errorMessage: string | null;
  fcmMessageId: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  clickedAt: Date | null;
}

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalClicked: number;
  deliveryRate: number;
  clickRate: number;
}

export interface NotificationMetricsByRecipient {
  recipientType: string;
  metrics: NotificationMetrics;
}

/**
 * Track a notification event in the analytics system.
 * This is the main entry point for recording notification sends.
 */
export async function trackNotification(
  params: TrackNotificationParams
): Promise<NotificationAnalyticsRecord | null> {
  const {
    profileId,
    notificationType,
    event,
    recipientType,
    orderId,
    dispatchId,
    status = "sent",
    errorMessage,
    fcmMessageId,
  } = params;

  try {
    const record = await prisma.notificationAnalytics.create({
      data: {
        profileId,
        notificationType,
        event,
        recipientType,
        orderId,
        dispatchId,
        status,
        errorMessage,
        fcmMessageId,
      },
    });

    return record as NotificationAnalyticsRecord;
  } catch (error) {
    // Log but don't fail the notification flow
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "trackNotification", profileId, event },
    });
    return null;
  }
}

/**
 * Update a notification record to mark it as delivered.
 * Called when FCM confirms delivery.
 */
export async function markNotificationDelivered(
  analyticsId: string
): Promise<NotificationAnalyticsRecord | null> {
  try {
    const record = await prisma.notificationAnalytics.update({
      where: { id: analyticsId },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
      },
    });

    return record as NotificationAnalyticsRecord;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "markNotificationDelivered", analyticsId },
    });
    return null;
  }
}

/**
 * Update a notification record to mark it as failed.
 */
export async function markNotificationFailed(
  analyticsId: string,
  errorMessage: string
): Promise<NotificationAnalyticsRecord | null> {
  try {
    const record = await prisma.notificationAnalytics.update({
      where: { id: analyticsId },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return record as NotificationAnalyticsRecord;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "markNotificationFailed", analyticsId },
    });
    return null;
  }
}

/**
 * Update a notification record to mark it as clicked.
 * Called when user clicks on a notification.
 */
export async function markNotificationClicked(
  analyticsId: string
): Promise<NotificationAnalyticsRecord | null> {
  try {
    const record = await prisma.notificationAnalytics.update({
      where: { id: analyticsId },
      data: {
        status: "clicked",
        clickedAt: new Date(),
      },
    });

    return record as NotificationAnalyticsRecord;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "markNotificationClicked", analyticsId },
    });
    return null;
  }
}

/**
 * Track a notification click by FCM message ID.
 * Used when we receive a click callback from the service worker.
 */
export async function trackNotificationClickByMessageId(
  fcmMessageId: string
): Promise<NotificationAnalyticsRecord | null> {
  try {
    // Find the most recent notification with this FCM message ID
    const notification = await prisma.notificationAnalytics.findFirst({
      where: { fcmMessageId },
      orderBy: { createdAt: "desc" },
    });

    if (!notification) {
      Sentry.captureMessage(`No notification found for FCM message ID: ${fcmMessageId}`, {
        level: "warning",
        tags: { service: "notification-analytics" },
      });
      return null;
    }

    return markNotificationClicked(notification.id);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "trackNotificationClickByMessageId", fcmMessageId },
    });
    return null;
  }
}

/**
 * Get notification metrics for a specific time range.
 */
export async function getNotificationMetrics(
  startDate: Date,
  endDate: Date,
  notificationType?: NotificationType
): Promise<NotificationMetrics> {
  try {
    const whereClause: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (notificationType) {
      whereClause.notificationType = notificationType;
    }

    const [totalSent, totalDelivered, totalFailed, totalClicked] = await Promise.all([
      prisma.notificationAnalytics.count({
        where: whereClause,
      }),
      prisma.notificationAnalytics.count({
        where: { ...whereClause, status: "delivered" },
      }),
      prisma.notificationAnalytics.count({
        where: { ...whereClause, status: "failed" },
      }),
      prisma.notificationAnalytics.count({
        where: { ...whereClause, status: "clicked" },
      }),
    ]);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalClicked,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "getNotificationMetrics", startDate, endDate, notificationType },
    });
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalClicked: 0,
      deliveryRate: 0,
      clickRate: 0,
    };
  }
}

/**
 * Get notification metrics grouped by recipient type.
 */
export async function getMetricsByRecipientType(
  startDate: Date,
  endDate: Date
): Promise<NotificationMetricsByRecipient[]> {
  try {
    const recipientTypes = ["CUSTOMER", "ADMIN", "STORE", "DRIVER"];
    const results: NotificationMetricsByRecipient[] = [];

    for (const recipientType of recipientTypes) {
      const whereClause = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        recipientType,
      };

      const [totalSent, totalDelivered, totalFailed, totalClicked] = await Promise.all([
        prisma.notificationAnalytics.count({ where: whereClause }),
        prisma.notificationAnalytics.count({
          where: { ...whereClause, status: "delivered" },
        }),
        prisma.notificationAnalytics.count({
          where: { ...whereClause, status: "failed" },
        }),
        prisma.notificationAnalytics.count({
          where: { ...whereClause, status: "clicked" },
        }),
      ]);

      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;

      results.push({
        recipientType,
        metrics: {
          totalSent,
          totalDelivered,
          totalFailed,
          totalClicked,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
        },
      });
    }

    return results;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "getMetricsByRecipientType", startDate, endDate },
    });
    return [];
  }
}

/**
 * Get notification metrics grouped by event type.
 */
export async function getMetricsByEventType(
  startDate: Date,
  endDate: Date
): Promise<{ event: string; count: number; failureCount: number }[]> {
  try {
    const events: DeliveryStatusEvent[] = [
      "delivery:assigned",
      "driver:en_route",
      "driver:arrived",
      "delivery:completed",
      "delivery:delayed",
      "delivery:failed",
    ];

    const results: { event: string; count: number; failureCount: number }[] = [];

    for (const event of events) {
      const whereClause = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        event,
      };

      const [count, failureCount] = await Promise.all([
        prisma.notificationAnalytics.count({ where: whereClause }),
        prisma.notificationAnalytics.count({
          where: { ...whereClause, status: "failed" },
        }),
      ]);

      results.push({ event, count, failureCount });
    }

    return results;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "getMetricsByEventType", startDate, endDate },
    });
    return [];
  }
}

/**
 * Get recent failed notifications for debugging/monitoring.
 */
export async function getRecentFailedNotifications(
  limit: number = 50
): Promise<NotificationAnalyticsRecord[]> {
  try {
    const records = await prisma.notificationAnalytics.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records as NotificationAnalyticsRecord[];
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "getRecentFailedNotifications", limit },
    });
    return [];
  }
}

/**
 * Get notification history for a specific profile.
 */
export async function getProfileNotificationHistory(
  profileId: string,
  limit: number = 100
): Promise<NotificationAnalyticsRecord[]> {
  try {
    const records = await prisma.notificationAnalytics.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records as NotificationAnalyticsRecord[];
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "getProfileNotificationHistory", profileId, limit },
    });
    return [];
  }
}

/**
 * Clean up old analytics records.
 * Should be called periodically (e.g., via cron job).
 *
 * @param retentionDays Number of days to retain records (default: 90)
 * @returns Number of deleted records
 */
export async function cleanupOldAnalytics(retentionDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.notificationAnalytics.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { service: "notification-analytics" },
      extra: { operation: "cleanupOldAnalytics", retentionDays },
    });
    return 0;
  }
}
