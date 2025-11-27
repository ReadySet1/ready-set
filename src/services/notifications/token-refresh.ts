/**
 * FCM Token Refresh Service
 *
 * Handles token refresh logic for Firebase Cloud Messaging.
 * FCM tokens can expire or become invalid, so we need to:
 * 1. Track when tokens are refreshed
 * 2. Validate tokens periodically
 * 3. Clean up stale/invalid tokens
 */

import { prisma } from "@/lib/db/prisma";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

/**
 * Token refresh thresholds and intervals.
 */
const TOKEN_STALE_DAYS = 30; // Consider token stale after 30 days without refresh
const TOKEN_VALIDATION_BATCH_SIZE = 100; // Number of tokens to validate at once

export interface TokenRefreshResult {
  tokenId: string;
  token: string;
  profileId: string;
  refreshed: boolean;
  error?: string;
}

export interface TokenValidationResult {
  tokenId: string;
  valid: boolean;
  error?: string;
}

export interface StaleTokenInfo {
  id: string;
  profileId: string;
  token: string;
  lastRefreshedAt: Date;
  daysSinceRefresh: number;
}

/**
 * Record a token refresh event.
 * Called when a client provides a new/refreshed token.
 */
export async function recordTokenRefresh(
  token: string,
  profileId: string,
  userAgent?: string,
  platform?: string
): Promise<{ success: boolean; isNew: boolean; error?: string }> {
  try {
    // Check if this token already exists
    const existingToken = await prisma.profilePushToken.findUnique({
      where: { token },
      select: { id: true, profileId: true, refreshCount: true },
    });

    if (existingToken) {
      // Token exists - update refresh tracking
      await prisma.profilePushToken.update({
        where: { token },
        data: {
          profileId, // Update in case user changed
          userAgent,
          platform,
          lastRefreshedAt: new Date(),
          refreshCount: { increment: 1 },
          revokedAt: null, // Re-enable if previously revoked
        },
      });

      return { success: true, isNew: false };
    }

    // New token - create record
    await prisma.profilePushToken.create({
      data: {
        profileId,
        token,
        userAgent,
        platform,
        lastRefreshedAt: new Date(),
        refreshCount: 0,
      },
    });

    return { success: true, isNew: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error recording token refresh:", error);
    return { success: false, isNew: false, error: errorMessage };
  }
}

/**
 * Get tokens that haven't been refreshed recently.
 * These are candidates for validation or cleanup.
 */
export async function getStaleTokens(limit: number = 100): Promise<StaleTokenInfo[]> {
  const staleDate = new Date(Date.now() - TOKEN_STALE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const tokens = await prisma.profilePushToken.findMany({
      where: {
        lastRefreshedAt: { lt: staleDate },
        revokedAt: null,
      },
      select: {
        id: true,
        profileId: true,
        token: true,
        lastRefreshedAt: true,
      },
      orderBy: { lastRefreshedAt: "asc" },
      take: limit,
    });

    return tokens.map((t) => ({
      id: t.id,
      profileId: t.profileId,
      token: t.token,
      lastRefreshedAt: t.lastRefreshedAt,
      daysSinceRefresh: Math.floor(
        (Date.now() - t.lastRefreshedAt.getTime()) / (24 * 60 * 60 * 1000)
      ),
    }));
  } catch (error) {
    console.error("Error getting stale tokens:", error);
    return [];
  }
}

/**
 * Validate a single FCM token by sending a dry-run message.
 * FCM will return an error if the token is invalid.
 */
export async function validateToken(token: string): Promise<TokenValidationResult> {
  const messaging = getFirebaseMessaging();

  if (!messaging) {
    return {
      tokenId: token,
      valid: true, // Assume valid if we can't check (fail open)
      error: "Firebase Messaging not available",
    };
  }

  try {
    // Use dry_run to validate without actually sending
    await messaging.send(
      {
        token,
        notification: {
          title: "Validation",
          body: "Token validation check",
        },
      },
      true // dry_run = true
    );

    return { tokenId: token, valid: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for specific invalid token errors
    const isInvalid =
      errorMessage.includes("registration-token-not-registered") ||
      errorMessage.includes("invalid-registration-token") ||
      errorMessage.includes("unregistered");

    return {
      tokenId: token,
      valid: !isInvalid,
      error: isInvalid ? errorMessage : undefined,
    };
  }
}

/**
 * Validate multiple tokens in batch.
 */
export async function validateTokensBatch(
  tokenIds: string[]
): Promise<TokenValidationResult[]> {
  const tokens = await prisma.profilePushToken.findMany({
    where: {
      id: { in: tokenIds },
      revokedAt: null,
    },
    select: { id: true, token: true },
  });

  const results: TokenValidationResult[] = [];

  for (const tokenRecord of tokens) {
    const result = await validateToken(tokenRecord.token);
    results.push({
      tokenId: tokenRecord.id,
      valid: result.valid,
      error: result.error,
    });

    // If token is invalid, revoke it
    if (!result.valid) {
      await revokeToken(tokenRecord.id, result.error || "Token validation failed");
    }
  }

  return results;
}

/**
 * Revoke an invalid or expired token.
 */
export async function revokeToken(
  tokenId: string,
  reason?: string
): Promise<boolean> {
  try {
    await prisma.profilePushToken.update({
      where: { id: tokenId },
      data: {
        revokedAt: new Date(),
      },
    });

    console.info(`Revoked token ${tokenId}: ${reason || "No reason provided"}`);
    return true;
  } catch (error) {
    console.error(`Error revoking token ${tokenId}:`, error);
    return false;
  }
}

/**
 * Clean up old revoked tokens.
 * Revoked tokens older than the retention period will be deleted.
 *
 * @param retentionDays Days to keep revoked tokens (default: 7)
 * @returns Number of deleted tokens
 */
export async function cleanupRevokedTokens(retentionDays: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.profilePushToken.deleteMany({
      where: {
        revokedAt: {
          not: null,
          lt: cutoff,
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error("Error cleaning up revoked tokens:", error);
    return 0;
  }
}

/**
 * Validate and clean up stale tokens.
 * This is meant to be called periodically (e.g., via cron job).
 */
export async function validateAndCleanupStaleTokens(): Promise<{
  validated: number;
  revoked: number;
  cleaned: number;
}> {
  // Get stale tokens
  const staleTokens = await getStaleTokens(TOKEN_VALIDATION_BATCH_SIZE);

  if (staleTokens.length === 0) {
    return { validated: 0, revoked: 0, cleaned: 0 };
  }

  // Validate them
  const tokenIds = staleTokens.map((t) => t.id);
  const results = await validateTokensBatch(tokenIds);

  const revoked = results.filter((r) => !r.valid).length;

  // Clean up old revoked tokens
  const cleaned = await cleanupRevokedTokens();

  return {
    validated: results.length,
    revoked,
    cleaned,
  };
}

/**
 * Get token statistics for a profile.
 */
export async function getProfileTokenStats(profileId: string): Promise<{
  totalTokens: number;
  activeTokens: number;
  revokedTokens: number;
  staleTokens: number;
}> {
  const staleDate = new Date(Date.now() - TOKEN_STALE_DAYS * 24 * 60 * 60 * 1000);

  const [total, active, revoked, stale] = await Promise.all([
    prisma.profilePushToken.count({ where: { profileId } }),
    prisma.profilePushToken.count({ where: { profileId, revokedAt: null } }),
    prisma.profilePushToken.count({ where: { profileId, revokedAt: { not: null } } }),
    prisma.profilePushToken.count({
      where: {
        profileId,
        revokedAt: null,
        lastRefreshedAt: { lt: staleDate },
      },
    }),
  ]);

  return {
    totalTokens: total,
    activeTokens: active,
    revokedTokens: revoked,
    staleTokens: stale,
  };
}

/**
 * Get system-wide token statistics.
 */
export async function getSystemTokenStats(): Promise<{
  totalProfiles: number;
  totalTokens: number;
  activeTokens: number;
  revokedTokens: number;
  staleTokens: number;
  averageTokensPerProfile: number;
}> {
  const staleDate = new Date(Date.now() - TOKEN_STALE_DAYS * 24 * 60 * 60 * 1000);

  const [profileCount, total, active, revoked, stale] = await Promise.all([
    prisma.profile.count({ where: { hasPushNotifications: true, deletedAt: null } }),
    prisma.profilePushToken.count({}),
    prisma.profilePushToken.count({ where: { revokedAt: null } }),
    prisma.profilePushToken.count({ where: { revokedAt: { not: null } } }),
    prisma.profilePushToken.count({
      where: {
        revokedAt: null,
        lastRefreshedAt: { lt: staleDate },
      },
    }),
  ]);

  return {
    totalProfiles: profileCount,
    totalTokens: total,
    activeTokens: active,
    revokedTokens: revoked,
    staleTokens: stale,
    averageTokensPerProfile: profileCount > 0 ? Math.round((active / profileCount) * 100) / 100 : 0,
  };
}
