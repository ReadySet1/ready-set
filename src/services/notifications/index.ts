/**
 * Notification Services
 *
 * Central exports for all notification-related services.
 * This includes push notifications, email, analytics, and supporting utilities.
 */

// Push notification core
export {
  type DeliveryStatusEvent,
  type PushNotificationPayload,
  type DeliveryStatusPushParams,
  mapDispatchStatusToPushEvent,
  buildDeliveryStatusMessage,
  sendPushNotification,
  sendDeliveryStatusPush,
  isDuplicateNotification,
  markNotificationSent,
  clearNotificationCache,
} from "./push";

// Delivery status notifications (multi-recipient)
export {
  type DispatchNotificationRecipient,
  type DispatchStatusNotificationParams,
  sendDispatchStatusNotification,
} from "./delivery-status";

// Notification deduplication (distributed)
export {
  getNotificationCacheKey,
  isDuplicateNotificationDistributed,
  markNotificationSentDistributed,
  cleanupExpiredDedup,
  clearDedupCache,
  getDedupTTLSeconds,
} from "./dedup";

// Notification analytics
export {
  type NotificationStatus,
  type NotificationType,
  type TrackNotificationParams,
  type NotificationAnalyticsRecord,
  type NotificationMetrics,
  type NotificationMetricsByRecipient,
  trackNotification,
  markNotificationDelivered,
  markNotificationFailed,
  markNotificationClicked,
  trackNotificationClickByMessageId,
  getNotificationMetrics,
  getMetricsByRecipientType,
  getMetricsByEventType,
  getRecentFailedNotifications,
  getProfileNotificationHistory,
  cleanupOldAnalytics,
} from "./analytics";

// Token refresh management
export {
  type TokenRefreshResult,
  type TokenValidationResult,
  type StaleTokenInfo,
  recordTokenRefresh,
  getStaleTokens,
  validateToken,
  validateTokensBatch,
  revokeToken,
  cleanupRevokedTokens,
  validateAndCleanupStaleTokens,
  getProfileTokenStats,
  getSystemTokenStats,
} from "./token-refresh";
