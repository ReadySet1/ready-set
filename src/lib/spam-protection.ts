// src/lib/spam-protection.ts

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
 */
function isValidIp(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified - matches most common forms)
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets are 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Extract and validate client IP from headers
 *
 * SECURITY NOTE: Only use this in environments where x-forwarded-for is set by
 * a trusted proxy (e.g., Vercel, Cloudflare). Do NOT use with user-facing proxies.
 *
 * @param forwardedFor - x-forwarded-for header value
 * @param realIp - x-real-ip header value
 * @returns Valid IP address or 'unknown-ip' constant
 */
export function extractClientIp(forwardedFor: string | null, realIp: string | null): string {
  // Try x-forwarded-for first (set by Vercel/trusted proxy)
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  // Fall back to x-real-ip
  if (realIp && isValidIp(realIp)) {
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
   */
  static detectSpamPatterns(message: string): string[] {
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
   * Start periodic cleanup scheduler
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
