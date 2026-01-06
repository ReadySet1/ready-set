// src/lib/spam-protection.ts

import { isValidIp, isPrivateIp, extractClientIp as extractClientIpUtil } from '@/utils/ip-validation';

/**
 * Spam Protection System for Contact Forms
 *
 * Implements multiple layers of spam prevention:
 * - Rate limiting (in-memory, resets on serverless cold starts)
 * - Disposable email detection
 * - Spam pattern detection
 * - Honeypot validation
 * - Monitoring and logging
 *
 * ⚠️ IMPORTANT LIMITATIONS FOR PRODUCTION:
 *
 * 1. MEMORY LEAK RISK:
 *    - Cleanup scheduler must be started manually in a long-lived process
 *    - Do NOT use in serverless functions without careful lifecycle management
 *    - Consider using Next.js middleware or API routes with proper initialization
 *
 * 2. RACE CONDITIONS:
 *    - Rate limit checks are NOT atomic in concurrent requests
 *    - Multiple requests can bypass rate limits if processed simultaneously
 *    - This is acceptable for basic spam protection but not for strict limits
 *
 * 3. NOT DISTRIBUTED:
 *    - Rate limits are NOT shared across serverless instances
 *    - Each instance maintains its own rate limit state
 *    - Limits reset on function cold starts
 *
 * 4. PRODUCTION RECOMMENDATION:
 *    - Use Redis with INCR for atomic, distributed rate limiting
 *    - Implement proper request queuing
 *    - Add comprehensive monitoring and alerting
 *
 * This implementation is suitable for:
 * - Development and testing
 * - Low-traffic applications
 * - Additional layer of protection alongside other measures
 *
 * NOT suitable for:
 * - High-traffic production applications
 * - Strict rate limiting requirements
 * - Distributed serverless deployments at scale
 */

export interface RateLimit {
  identifier: string;
  count: number;
  windowStart: number;
  windowSize: number; // milliseconds
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  score: number; // 0-100, higher = more likely spam
  details?: {
    rateLimitExceeded?: boolean;
    disposableEmail?: boolean;
    spamPatterns?: string[];
    honeypotTriggered?: boolean;
  };
}

/**
 * Re-export extractClientIp for backward compatibility.
 * This function has been moved to @/utils/ip-validation for reusability.
 *
 * @deprecated Import directly from '@/utils/ip-validation' instead
 */
export const extractClientIp = extractClientIpUtil;

export class SpamProtectionManager {
  /**
   * In-memory rate limit storage
   * NOTE: This is NOT shared across serverless instances and resets on cold starts
   */
  private static readonly RATE_LIMITS = new Map<string, RateLimit>();
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_RATE_LIMIT_ENTRIES = 10000; // Safety valve to prevent unbounded growth
  private static readonly EMERGENCY_CLEANUP_THRESHOLD = 0.9; // Trigger at 90% capacity
  private static readonly MAX_MESSAGE_LENGTH_FOR_REGEX = 5000; // Prevent ReDoS attacks on very long messages
  private static cleanupTimer: NodeJS.Timeout | null = null;
  private static isSchedulerRunning = false;

  // Rate limiting configuration
  static readonly RATE_LIMIT_CONFIG = {
    maxAttempts: 5, // 5 submissions
    windowMs: 15 * 60 * 1000, // per 15 minutes
  };

  // List of known disposable email domains
  private static readonly DISPOSABLE_EMAIL_DOMAINS = new Set([
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'temp-mail.org',
    'throwaway.email',
    'tempmail.com',
    'trashmail.com',
    'getnada.com',
    'maildrop.cc',
    'yopmail.com',
    'sharklasers.com',
    'guerrillamailblock.com',
    'pokemail.net',
    'spam4.me',
    'mailnesia.com',
    'mytrashmail.com',
    'mailcatch.com',
    'mohmal.com',
    'throwawaymail.com',
    'mintemail.com',
  ]);

  // Spam patterns to detect in message content
  // NOTE: URL counting is handled separately in calculateSpamScore() to avoid regex performance issues
  private static readonly SPAM_PATTERNS = [
    /\b(viagra|cialis|pharmacy|pills)\b/gi,
    /\b(casino|poker|gambling|lottery|jackpot)\b/gi,
    /\b(click here|click this|free money|make money fast)\b/gi,
    /\b(weight loss|lose weight|diet pills)\b/gi,
    /\b(earn \$|make \$\d+|guaranteed income)\b/gi,
    /\b(seo services|cheap seo|link building)\b/gi,
    /\b(cryptocurrency|bitcoin|investment opportunity)\b/gi,
    /<script|javascript:|onclick=/gi, // XSS attempts
    /\[url=|<a href=/gi, // BBCode/HTML links
  ];

  /**
   * Check rate limit for a given identifier (email, IP, or fingerprint)
   *
   * IMPORTANT: Cleanup scheduler must be started manually via startCleanupScheduler()
   * to avoid memory leaks in serverless environments. Do NOT auto-initialize here.
   *
   * ⚠️ RACE CONDITION WARNING:
   * This implementation uses NON-ATOMIC operations (rateLimit.count++).
   * In high-concurrency scenarios, multiple simultaneous requests can bypass rate limits.
   *
   * Example race condition scenario:
   * 1. Request A reads count=4 (under limit of 5)
   * 2. Request B reads count=4 (under limit of 5)
   * 3. Request A increments to 5 and is allowed
   * 4. Request B increments to 6 and is allowed (SHOULD HAVE BEEN BLOCKED)
   *
   * This is acceptable for:
   * - Basic spam protection (small variance is tolerable)
   * - Low-traffic applications
   * - Development environments
   *
   * For production with strict rate limiting, use Redis with atomic operations:
   * ```typescript
   * // Redis example with atomic INCR
   * const count = await redis.incr(`rate-limit:${identifier}`);
   * await redis.expire(`rate-limit:${identifier}`, windowSizeInSeconds);
   * if (count > maxAttempts) {
   *   return false; // Rate limit exceeded
   * }
   * ```
   *
   * WARNING THRESHOLD: Consider logging when approaching limit (e.g., at 80% capacity)
   * to help detect aggressive attempts before the limit is actually exceeded.
   */
  static checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    let rateLimit = this.RATE_LIMITS.get(identifier);

    if (!rateLimit || now - rateLimit.windowStart > this.RATE_LIMIT_CONFIG.windowMs) {
      // Check Map size before adding new entries (safety valve)
      // If at maximum capacity, reject the request
      const canAddEntry = this.checkMapSize();
      if (!canAddEntry) {
        console.error(`[SPAM] Cannot add new rate limit entry for ${identifier} - Map at maximum capacity`);
        return false; // Treat as rate limit exceeded
      }

      // Reset or create new window
      rateLimit = {
        identifier,
        count: 0,
        windowStart: now,
        windowSize: this.RATE_LIMIT_CONFIG.windowMs,
      };
      this.RATE_LIMITS.set(identifier, rateLimit);
    }

    // NON-ATOMIC increment (see race condition warning in JSDoc above)
    rateLimit.count++;

    // Log warning when approaching limit (helps detect aggressive attempts)
    const utilizationPercent = (rateLimit.count / this.RATE_LIMIT_CONFIG.maxAttempts) * 100;
    if (utilizationPercent >= 80 && utilizationPercent < 100) {
      console.warn(`[SPAM] Rate limit at ${utilizationPercent.toFixed(0)}% for identifier ${identifier} (${rateLimit.count}/${this.RATE_LIMIT_CONFIG.maxAttempts})`);
    }

    // Check if limit exceeded
    if (rateLimit.count > this.RATE_LIMIT_CONFIG.maxAttempts) {
      console.warn(`[SPAM] Rate limit exceeded for identifier ${identifier} (${rateLimit.count}/${this.RATE_LIMIT_CONFIG.maxAttempts})`);
      return false;
    }

    return true;
  }

  /**
   * Check if email domain is from a known disposable email service
   */
  static isDisposableEmail(email: string): boolean {
    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return false;

    return this.DISPOSABLE_EMAIL_DOMAINS.has(domain);
  }

  /**
   * Scan message content for spam patterns
   *
   * SECURITY: Includes ReDoS protection by limiting message length for regex processing
   */
  static detectSpamPatterns(message: string): string[] {
    // ReDoS Protection: Skip regex matching on excessively long messages
    // Long messages are flagged by calculateSpamScore() separately
    if (message.length > this.MAX_MESSAGE_LENGTH_FOR_REGEX) {
      console.warn(`[SPAM] Message too long for regex matching (${message.length} chars), skipping pattern detection`);
      return [];
    }

    const detectedPatterns: string[] = [];

    for (const pattern of this.SPAM_PATTERNS) {
      // Reset lastIndex to 0 before each test to handle global regex correctly
      // Without this reset, subsequent calls to test() on the same regex may fail
      // because global regexes maintain state between calls
      pattern.lastIndex = 0;
      if (pattern.test(message)) {
        detectedPatterns.push(pattern.source);
      }
    }

    return detectedPatterns;
  }

  /**
   * Calculate spam score based on various factors
   */
  static calculateSpamScore(data: {
    email: string;
    message: string;
    name?: string;
    phone?: string;
  }): number {
    let score = 0;

    // Check disposable email (40 points)
    if (this.isDisposableEmail(data.email)) {
      score += 40;
    }

    // Check spam patterns in message (10 points per pattern, max 50)
    const patterns = this.detectSpamPatterns(data.message);
    score += Math.min(patterns.length * 10, 50);

    // Check for suspicious characteristics
    // Very short messages (< 10 chars) (15 points)
    if (data.message.length < 10) {
      score += 15;
    }

    // Very long messages (> 2000 chars) (10 points)
    if (data.message.length > 2000) {
      score += 10;
    }

    // All caps message (15 points)
    if (data.message.length > 20 && data.message === data.message.toUpperCase()) {
      score += 15;
    }

    // Excessive links (more than 3) (20 points)
    // Using simple counting instead of complex regex to avoid catastrophic backtracking
    const linkCount = (data.message.match(/https?:\/\//gi) || []).length;
    if (linkCount > 3) {
      score += 20;
    }

    // Suspicious name patterns
    if (data.name) {
      // Name contains numbers (10 points)
      if (/\d/.test(data.name)) {
        score += 10;
      }
      // Name is very short (< 2 chars) (10 points)
      if (data.name.length < 2) {
        score += 10;
      }
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Comprehensive spam check
   */
  static async checkForSpam(data: {
    email: string;
    message: string;
    name?: string;
    phone?: string;
    honeypot?: string; // Should be empty if not spam
    identifier?: string; // For rate limiting (email or IP)
  }): Promise<SpamCheckResult> {
    const identifier = data.identifier || data.email;
    let score = 0;
    const details: SpamCheckResult['details'] = {};

    // 1. Check honeypot (if provided)
    if (data.honeypot && data.honeypot.trim() !== '') {
      console.warn(`[SPAM] Honeypot triggered for ${identifier}`);
      return {
        isSpam: true,
        reason: 'Bot detected via honeypot field',
        score: 100,
        details: { honeypotTriggered: true },
      };
    }

    // 2. Check rate limit
    const rateLimitPassed = this.checkRateLimit(identifier);
    if (!rateLimitPassed) {
      details.rateLimitExceeded = true;
      score += 100; // Instant spam flag
      return {
        isSpam: true,
        reason: 'Too many submissions in a short period',
        score,
        details,
      };
    }

    // 3. Check disposable email
    if (this.isDisposableEmail(data.email)) {
      details.disposableEmail = true;
      score += 40;
    }

    // 4. Check spam patterns
    const patterns = this.detectSpamPatterns(data.message);
    if (patterns.length > 0) {
      details.spamPatterns = patterns;
      score += Math.min(patterns.length * 10, 50);
    }

    // 5. Calculate comprehensive spam score
    const calculatedScore = this.calculateSpamScore(data);
    score = Math.max(score, calculatedScore);

    // Determine if spam (threshold: 50)
    const isSpam = score >= 50;

    if (isSpam) {
      console.warn(`[SPAM] Blocked submission from ${identifier} (score: ${score})`);
    }

    return {
      isSpam,
      reason: isSpam ? this.getSpamReason(details, score) : undefined,
      score,
      details,
    };
  }

  /**
   * Get human-readable spam reason
   */
  private static getSpamReason(details: SpamCheckResult['details'], score: number): string {
    if (details?.honeypotTriggered) return 'Bot detected';
    if (details?.rateLimitExceeded) return 'Too many submissions';
    if (details?.disposableEmail && details?.spamPatterns) return 'Suspicious content and disposable email';
    if (details?.disposableEmail) return 'Disposable email address not allowed';
    if (details?.spamPatterns) return 'Suspicious content detected';
    return `Spam score too high (${score})`;
  }

  /**
   * Cleanup expired rate limit entries to prevent memory leak
   */
  static cleanupExpiredRateLimits(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, limit] of this.RATE_LIMITS.entries()) {
      // Remove entries older than 2x their window size
      if (now - limit.windowStart > limit.windowSize * 2) {
        this.RATE_LIMITS.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SPAM] Cleaned up ${cleanedCount} expired rate limit entries`);
    }

    return cleanedCount;
  }

  /**
   * Emergency cleanup when approaching maximum entries
   * Removes oldest entries to prevent unbounded Map growth
   */
  private static emergencyCleanup(): number {
    const now = Date.now();
    const entries = Array.from(this.RATE_LIMITS.entries());

    // Sort by age (oldest first)
    entries.sort((a, b) => a[1].windowStart - b[1].windowStart);

    // Remove oldest 20% of entries
    const removeCount = Math.ceil(entries.length * 0.2);
    let removed = 0;

    for (let i = 0; i < removeCount && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        this.RATE_LIMITS.delete(entry[0]);
        removed++;
      }
    }

    console.warn(`[SPAM] Emergency cleanup triggered - removed ${removed} oldest rate limit entries`);
    return removed;
  }

  /**
   * Check if Map size is approaching limit and trigger cleanup if needed.
   * Returns false if the Map is at maximum capacity and cannot accept new entries.
   *
   * @returns true if new entries can be added, false if at maximum capacity
   */
  private static checkMapSize(): boolean {
    const currentSize = this.RATE_LIMITS.size;
    const threshold = Math.floor(this.MAX_RATE_LIMIT_ENTRIES * this.EMERGENCY_CLEANUP_THRESHOLD);

    if (currentSize >= this.MAX_RATE_LIMIT_ENTRIES) {
      console.error(`[SPAM] CRITICAL: Rate limit Map at maximum capacity (${currentSize}/${this.MAX_RATE_LIMIT_ENTRIES})`);

      // Attempt emergency cleanup to free space
      const removed = this.emergencyCleanup();

      // Check if we freed enough space after cleanup
      if (this.RATE_LIMITS.size >= this.MAX_RATE_LIMIT_ENTRIES) {
        console.error(`[SPAM] CRITICAL: Emergency cleanup failed to free sufficient space. Rejecting new entries.`);
        return false; // Prevent new entries
      }

      console.warn(`[SPAM] Emergency cleanup freed ${removed} entries. Allowing new entries.`);
      return true;
    } else if (currentSize >= threshold) {
      console.warn(`[SPAM] WARNING: Rate limit Map approaching capacity (${currentSize}/${this.MAX_RATE_LIMIT_ENTRIES})`);
      // Try regular cleanup first
      this.cleanupExpiredRateLimits();
      return true; // Still have space, allow new entries
    }

    return true; // Below threshold, allow new entries
  }

  /**
   * Start periodic cleanup scheduler
   *
   * IMPORTANT: In serverless environments, this must be called carefully:
   * - Call once during module initialization, not per request
   * - Multiple calls are safe due to singleton guard
   *
   * SERVERLESS/VERCEL LIMITATIONS:
   * - Process event handlers (beforeExit, SIGTERM) do NOT work reliably in serverless
   * - Cleanup happens automatically on cold starts when the instance is recreated
   * - Memory is released when the function instance terminates
   * - This is acceptable behavior for serverless deployments
   *
   * For production serverless deployments:
   * - Consider using Redis with TTL for distributed rate limiting
   * - Or use a scheduled cleanup job (e.g., Vercel Cron) for database-backed state
   * - Current in-memory approach is suitable for low-traffic or development
   */
  static startCleanupScheduler() {
    // Don't start timers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Singleton guard: prevent multiple scheduler instances
    if (this.isSchedulerRunning) {
      console.warn('[SPAM] Cleanup scheduler is already running');
      return;
    }

    // Clear any existing timer before creating new one (defensive)
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.isSchedulerRunning = true;

    // Run rate limit cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredRateLimits();
    }, this.CLEANUP_INTERVAL);

    console.log('[SPAM] Cleanup scheduler started');
  }

  /**
   * Stop cleanup scheduler
   */
  static stopCleanupScheduler() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.isSchedulerRunning = false;
    console.log('[SPAM] Cleanup scheduler stopped');
  }

  /**
   * Get current rate limit stats (for monitoring)
   */
  static getRateLimitStats(): {
    totalEntries: number;
    activeWindows: number;
  } {
    const now = Date.now();
    let activeWindows = 0;

    for (const limit of this.RATE_LIMITS.values()) {
      if (now - limit.windowStart <= limit.windowSize) {
        activeWindows++;
      }
    }

    return {
      totalEntries: this.RATE_LIMITS.size,
      activeWindows,
    };
  }
}
