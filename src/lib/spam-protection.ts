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
 * IMPORTANT LIMITATIONS:
 * - Rate limiting uses in-memory storage (not distributed)
 * - Rate limits reset on serverless function cold starts
 * - For production scale with multiple instances, consider Redis
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
  private static readonly SPAM_PATTERNS = [
    /\b(viagra|cialis|pharmacy|pills)\b/gi,
    /\b(casino|poker|gambling|lottery|jackpot)\b/gi,
    /\b(click here|click this|free money|make money fast)\b/gi,
    /\b(weight loss|lose weight|diet pills)\b/gi,
    /\b(earn \$|make \$\d+|guaranteed income)\b/gi,
    /\b(seo services|cheap seo|link building)\b/gi,
    /\b(cryptocurrency|bitcoin|investment opportunity)\b/gi,
    /https?:\/\/[^\s]+.*https?:\/\/[^\s]+.*https?:\/\/[^\s]+/gi, // 3+ URLs
    /<script|javascript:|onclick=/gi, // XSS attempts
    /\[url=|<a href=/gi, // BBCode/HTML links
  ];

  /**
   * Check rate limit for a given identifier (email, IP, or fingerprint)
   */
  static checkRateLimit(identifier: string): boolean {
    // Auto-initialize cleanup scheduler on first rate limit check
    if (!this.isSchedulerRunning) {
      this.startCleanupScheduler();
    }

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
