// src/lib/spam-protection.ts

import { isIP } from 'net';

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
 * Validate if a string is a valid IPv4 or IPv6 address
 * Uses Node.js built-in isIP function for reliable validation
 */
function isValidIp(ip: string): boolean {
  // Use Node.js built-in isIP function
  // Returns 4 for IPv4, 6 for IPv6, 0 for invalid
  return isIP(ip) !== 0;
}

/**
 * Check if IP is in private/reserved range
 * Private IPs should not be used for rate limiting from x-forwarded-for
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateV4Ranges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // Loopback
    /^169\.254\./,              // Link-local
  ];

  // IPv6 private/special ranges
  const privateV6Ranges = [
    /^::1$/,                    // Loopback
    /^fe80:/,                   // Link-local
    /^fc00:/,                   // Unique local
    /^fd00:/,                   // Unique local
  ];

  for (const range of privateV4Ranges) {
    if (range.test(ip)) return true;
  }

  for (const range of privateV6Ranges) {
    if (range.test(ip)) return true;
  }

  return false;
}

/**
 * Extract and validate client IP from headers
 *
 * SECURITY NOTE: Only use this in environments where x-forwarded-for is set by
 * a trusted proxy (e.g., Vercel, Cloudflare). Do NOT use with user-facing proxies.
 *
 * Environment Variables:
 * - TRUST_PROXY: Set to 'true' to trust x-forwarded-for header (default: true for Vercel/production)
 * - Set to 'false' in development or untrusted environments
 *
 * DEPLOYMENT REQUIREMENTS:
 * - Must be deployed behind a trusted proxy (Vercel, Cloudflare, AWS ALB, etc.)
 * - Proxy must set x-forwarded-for with the real client IP
 * - Do NOT expose this endpoint directly to the internet without a proxy
 *
 * @param forwardedFor - x-forwarded-for header value
 * @param realIp - x-real-ip header value
 * @returns Valid IP address or 'unknown-ip' constant
 */
export function extractClientIp(forwardedFor: string | null, realIp: string | null): string {
  // Check if we should trust proxy headers (default true for production)
  const trustProxy = process.env.TRUST_PROXY !== 'false';

  // Try x-forwarded-for first (set by Vercel/trusted proxy)
  if (trustProxy && forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp && isValidIp(firstIp) && !isPrivateIp(firstIp)) {
      return firstIp;
    } else if (firstIp && isPrivateIp(firstIp)) {
      console.warn(`[SPAM] Rejected private IP from x-forwarded-for: ${firstIp.substring(0, 10)}...`);
    }
  }

  // Fall back to x-real-ip (also requires trust)
  if (trustProxy && realIp && isValidIp(realIp) && !isPrivateIp(realIp)) {
    return realIp;
  }

  // No valid IP found - use constant identifier
  // This prevents user-controlled values (like email) from being used for rate limiting
  return 'unknown-ip';
}

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
   */
  static checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    let rateLimit = this.RATE_LIMITS.get(identifier);

    if (!rateLimit || now - rateLimit.windowStart > this.RATE_LIMIT_CONFIG.windowMs) {
      // Check Map size before adding new entries (safety valve)
      this.checkMapSize();

      // Reset or create new window
      rateLimit = {
        identifier,
        count: 0,
        windowStart: now,
        windowSize: this.RATE_LIMIT_CONFIG.windowMs,
      };
      this.RATE_LIMITS.set(identifier, rateLimit);
    }

    rateLimit.count++;

    // Check if limit exceeded
    if (rateLimit.count > this.RATE_LIMIT_CONFIG.maxAttempts) {
      console.warn(`[SPAM] Rate limit exceeded for identifier ${identifier}`);
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
   * Check if Map size is approaching limit and trigger cleanup if needed
   */
  private static checkMapSize(): void {
    const currentSize = this.RATE_LIMITS.size;
    const threshold = Math.floor(this.MAX_RATE_LIMIT_ENTRIES * this.EMERGENCY_CLEANUP_THRESHOLD);

    if (currentSize >= this.MAX_RATE_LIMIT_ENTRIES) {
      console.error(`[SPAM] CRITICAL: Rate limit Map at maximum capacity (${currentSize}/${this.MAX_RATE_LIMIT_ENTRIES})`);
      this.emergencyCleanup();
    } else if (currentSize >= threshold) {
      console.warn(`[SPAM] WARNING: Rate limit Map approaching capacity (${currentSize}/${this.MAX_RATE_LIMIT_ENTRIES})`);
      // Try regular cleanup first
      this.cleanupExpiredRateLimits();
    }
  }

  /**
   * Start periodic cleanup scheduler
   *
   * IMPORTANT: In serverless environments, this must be called carefully:
   * - Call once during module initialization, not per request
   * - The timer will be cleared automatically on process exit
   * - Multiple calls are safe due to singleton guard
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

    // Cleanup on process exit (graceful shutdown)
    process.on('beforeExit', () => {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
        this.isSchedulerRunning = false;
      }
    });

    // Also cleanup on SIGTERM (common in serverless/container environments)
    process.on('SIGTERM', () => {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
        this.isSchedulerRunning = false;
      }
    });

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
