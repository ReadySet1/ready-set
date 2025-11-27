/**
 * Distributed notification deduplication service.
 * Uses database (Supabase/Postgres) instead of in-memory cache for multi-instance support.
 *
 * This replaces the in-memory Map-based deduplication in push.ts for production deployments
 * where multiple server instances may be running.
 */

import { prisma } from "@/lib/db/prisma";

const DEDUP_TTL_SECONDS = 60; // 60 second deduplication window

/**
 * Generate a unique cache key for deduplication based on profile, event, and order.
 */
export function getNotificationCacheKey(
  profileId: string,
  event: string,
  orderId: string
): string {
  return `${profileId}:${event}:${orderId}`;
}

/**
 * Check if a notification was recently sent (within TTL window).
 * Uses database query instead of in-memory check.
 *
 * @returns true if duplicate (should skip), false if new notification
 */
export async function isDuplicateNotificationDistributed(
  profileId: string,
  event: string,
  orderId: string
): Promise<boolean> {
  const cacheKey = getNotificationCacheKey(profileId, event, orderId);
  const cutoff = new Date(Date.now() - DEDUP_TTL_SECONDS * 1000);

  try {
    const existing = await prisma.notificationDedup.findFirst({
      where: {
        cacheKey,
        createdAt: { gt: cutoff },
      },
    });

    return !!existing;
  } catch (error) {
    // On database error, allow the notification (fail open)
    console.error("Error checking notification dedup:", error);
    return false;
  }
}

/**
 * Mark a notification as sent in the distributed dedup cache.
 * Uses upsert to handle concurrent requests gracefully.
 */
export async function markNotificationSentDistributed(
  profileId: string,
  event: string,
  orderId: string
): Promise<void> {
  const cacheKey = getNotificationCacheKey(profileId, event, orderId);

  try {
    await prisma.notificationDedup.upsert({
      where: { cacheKey },
      create: { cacheKey },
      update: { createdAt: new Date() },
    });
  } catch (error) {
    // Log but don't fail the notification on dedup cache error
    console.error("Error marking notification in dedup cache:", error);
  }
}

/**
 * Clean up expired dedup entries.
 * Should be called periodically (e.g., via cron job or after batch operations).
 *
 * @returns Number of deleted entries
 */
export async function cleanupExpiredDedup(): Promise<number> {
  const cutoff = new Date(Date.now() - DEDUP_TTL_SECONDS * 1000);

  try {
    const result = await prisma.notificationDedup.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  } catch (error) {
    console.error("Error cleaning up expired dedup entries:", error);
    return 0;
  }
}

/**
 * Clear all dedup entries (useful for testing).
 */
export async function clearDedupCache(): Promise<void> {
  try {
    await prisma.notificationDedup.deleteMany({});
  } catch (error) {
    console.error("Error clearing dedup cache:", error);
  }
}

/**
 * Get the current dedup TTL in seconds.
 */
export function getDedupTTLSeconds(): number {
  return DEDUP_TTL_SECONDS;
}
