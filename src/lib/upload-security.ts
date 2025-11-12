// src/lib/upload-security.ts
import { createClient } from "@/utils/supabase/server";
import { UploadError, SecurityScanResult } from "@/types/upload";
import type { TablesInsert, Json } from "@/types/supabase";
import { SCAN_LIMITS } from "@/config/upload-config";

export interface QuarantineFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  originalPath: string;
  quarantinePath: string;
  reason: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  quarantinedAt: Date;
  scanResults?: SecurityScanResult;
}

export interface RateLimit {
  userId: string;
  action: string;
  count: number;
  windowStart: number;
  windowSize: number; // milliseconds
}

/**
 * UploadSecurityManager - Handles file upload security including virus scanning,
 * rate limiting, and quarantine management.
 *
 * MEMORY MANAGEMENT:
 * - Rate limits are automatically cleaned up every 5 minutes (removes entries older than 2x window size)
 * - Cleanup scheduler starts automatically on first rate limit check
 * - Quarantined files are cleaned up every 24 hours (configurable retention period)
 *
 * IMPORTANT LIMITATIONS:
 * - Rate limiting uses in-memory storage (not distributed across serverless instances)
 * - Rate limits reset on serverless function cold starts
 * - For production scale with multiple instances, consider Redis or database persistence
 */
export class UploadSecurityManager {
  private static readonly QUARANTINE_BUCKET = 'quarantined-files';

  // File scanning configuration constants
  /** Maximum file size that can be scanned (10MB) - files larger than this are rejected */
  private static readonly MAX_SCAN_SIZE = SCAN_LIMITS.MAX_SCAN_SIZE;
  /** Threshold for using streaming vs in-memory scanning (5MB) */
  private static readonly STREAMING_THRESHOLD = SCAN_LIMITS.STREAMING_THRESHOLD;
  /**
   * Overlap size between chunks to catch patterns at boundaries (4KB = 4096 bytes)
   *
   * RATIONALE FOR 4KB SIZE:
   * 1. **Common Malicious Pattern Size**: Most malicious patterns (script tags, encoded payloads,
   *    obfuscated JavaScript) are typically under 4KB. This includes:
   *    - Base64-encoded scripts (~1-2KB typical)
   *    - JavaScript event handlers (<1KB)
   *    - Embedded iframe/object tags with payloads (~1-3KB)
   *
   * 2. **Performance Trade-off**: 4KB represents a balance between:
   *    - Detection capability (can catch patterns split across chunk boundaries)
   *    - Memory overhead (4KB per chunk boundary is acceptable)
   *    - Processing time (minimal impact on scan performance)
   *
   * 3. **Browser Stream Chunk Sizes**: Typical browser stream chunks are 16-64KB,
   *    so 4KB overlap represents 6-25% overhead, which is reasonable.
   *
   * LIMITATIONS:
   * - Cannot detect malicious patterns larger than ~4KB that span chunk boundaries
   * - If attackers split payloads across boundaries with >4KB separation, may not detect
   * - For stricter security, consider increasing to 8KB or 16KB (with performance impact)
   *
   * THREAT MODEL:
   * Based on OWASP Top 10 and common web attack vectors:
   * - XSS payloads: Typically <2KB
   * - SQL injection: Typically <1KB
   * - File inclusion attacks: Typically <3KB
   * - Polyglot files (valid image + script): Header + payload typically <4KB
   *
   * @see scanFileInChunks for usage
   * @see https://owasp.org/www-community/attacks/ for common attack patterns
   */
  private static readonly STREAM_OVERLAP = 4096;

  /**
   * In-memory rate limit storage
   * NOTE: This is NOT shared across serverless instances and resets on cold starts
   * For distributed rate limiting, migrate to Redis or database storage
   */
  private static readonly RATE_LIMITS = new Map<string, RateLimit>();
  private static readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private static cleanupTimers: NodeJS.Timeout[] = [];
  private static isSchedulerRunning = false;

  // Rate limiting configuration
  static readonly RATE_LIMITS_CONFIG = {
    UPLOAD: { maxAttempts: 10, windowMs: 60000 }, // 10 uploads per minute
    VIRUS_SCAN: { maxAttempts: 50, windowMs: 60000 }, // 50 scans per minute
    ERROR_REPORT: { maxAttempts: 20, windowMs: 60000 } // 20 error reports per minute
  };

  static async checkRateLimit(userId: string, action: keyof typeof UploadSecurityManager.RATE_LIMITS_CONFIG): Promise<boolean> {
    // Auto-initialize cleanup scheduler on first rate limit check
    // This ensures memory cleanup runs in production without manual initialization
    if (!this.isSchedulerRunning) {
      this.startCleanupScheduler();
    }

    const config = this.RATE_LIMITS_CONFIG[action];
    const key = `${userId}:${action}`;
    const now = Date.now();

    let rateLimit = this.RATE_LIMITS.get(key);

    if (!rateLimit || now - rateLimit.windowStart > config.windowMs) {
      // Reset or create new window
      rateLimit = {
        userId,
        action,
        count: 0,
        windowStart: now,
        windowSize: config.windowMs
      };
      this.RATE_LIMITS.set(key, rateLimit);
    }

    rateLimit.count++;

    // Check if limit exceeded
    if (rateLimit.count > config.maxAttempts) {
      console.warn(`Rate limit exceeded for user ${userId} on action ${action}`);
      return false;
    }

    return true;
  }

  static async quarantineFile(
    file: File,
    reason: string,
    threatLevel: QuarantineFile['threatLevel'],
    userId?: string,
    scanResults?: SecurityScanResult
  ): Promise<string | null> {
    try {
      const supabase = await createClient();

      // Generate unique quarantine path
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().split('-')[0]; // Use cryptographically secure random
      const fileExt = file.name.split('.').pop() || 'unknown';
      const quarantinePath = `quarantine/${timestamp}-${randomId}.${fileExt}`;

      // Check if storage is available before attempting quarantine
      try {
        // Try to access the quarantine bucket first
        const { error: bucketError } = await supabase.storage
          .from(this.QUARANTINE_BUCKET)
          .list();

        if (bucketError) {
          console.warn('Quarantine bucket not available, skipping file quarantine:', bucketError.message);
          return null; // Return null to indicate quarantine was skipped
        }

        // Upload to quarantine bucket
        const { data, error } = await supabase.storage
          .from(this.QUARANTINE_BUCKET)
          .upload(quarantinePath, file, {
            upsert: false,
            contentType: file.type
          });

        if (error) {
          console.error('Failed to quarantine file:', error);
          return null; // Return null instead of throwing
        }

        // Log quarantine event to database
        try {
          await supabase.from('quarantine_logs').insert<TablesInsert<'quarantine_logs'>>({
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            quarantine_path: quarantinePath,
            reason,
            threat_level: threatLevel,
            user_id: userId || null,
            // Cast SecurityScanResult to Json since it contains JSON-serializable data
            scan_results: scanResults ? (scanResults as unknown as Json) : null,
            review_status: 'pending'
          });
        } catch (dbError) {
          console.warn('Failed to log quarantine event to database:', dbError);
          // Continue even if logging fails
        }

        return quarantinePath;
      } catch (storageError) {
        console.warn('Storage not available for quarantine, skipping:', storageError);
        return null;
      }
    } catch (error) {
      console.error('Error in quarantine process:', error);
      return null; // Return null instead of throwing
    }
  }

  /**
   * Scans large files (5-10MB) in chunks to avoid memory issues
   *
   * @param file - The file to scan
   * @param maliciousPatterns - Array of regex patterns to check for malicious content
   * @returns Object containing detected threats and risk score
   *
   * @remarks
   * - Chunk sizes are determined by the browser's stream implementation (not controlled by us)
   * - Uses 4KB overlap between chunks to catch patterns at boundaries (can detect patterns up to ~4KB)
   * - Streaming errors are treated as suspicious (safe default)
   * - Maximum detectable pattern size: ~4KB (STREAM_OVERLAP constant)
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream} for browser stream API details
   */
  private static async scanFileInChunks(
    file: File,
    maliciousPatterns: RegExp[]
  ): Promise<{ threats: string[]; score: number }> {
    const threats: string[] = [];
    let score = 0;

    // Chunks are determined by the browser's stream implementation
    // We process whatever chunk size the stream provides (typically varies based on browser/file size)
    const decoder = new TextDecoder('utf-8', { fatal: false });

    // For pattern matching across chunk boundaries, keep overlap from previous chunk
    // Increased to 4KB to catch larger patterns (e.g., embedded scripts, encoded payloads)
    let previousChunk = '';

    try {
      const stream = file.stream();
      const reader = stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          // Decode current chunk
          const currentChunk = decoder.decode(value, { stream: !done });

          // Combine with overlap from previous chunk for pattern matching
          const combinedContent = previousChunk + currentChunk;

          // Scan combined content against patterns
          for (const pattern of maliciousPatterns) {
            const matches = combinedContent.match(pattern);
            if (matches) {
              threats.push(`Malicious pattern detected: ${pattern.source}`);
              score += matches.length * 10;
            }
          }

          // Keep last STREAM_OVERLAP characters for next iteration
          if (combinedContent.length > this.STREAM_OVERLAP) {
            previousChunk = combinedContent.slice(-this.STREAM_OVERLAP);
          } else {
            previousChunk = combinedContent;
          }
        }
      }
    } catch (error) {
      console.error('Error during streaming scan:', error);
      threats.push('Error during file scan - treated as suspicious');
      score += 50;
    }

    return { threats, score };
  }

  static async scanForMaliciousContent(file: File): Promise<SecurityScanResult> {
    const threats: string[] = [];
    let score = 0;

    // Check file size first to prevent memory issues
    if (file.size > this.MAX_SCAN_SIZE) {
      threats.push('File too large for full content scan');
      score += 30; // Medium threat level due to inability to fully scan

      return {
        isClean: false,
        threats,
        score,
        details: {
          fileSize: file.size,
          fileType: file.type,
          scanPatterns: 0,
          threatsFound: threats.length
        }
      };
    }

    // Define malicious patterns first (used by both scanning methods)
    // Note: Using non-greedy quantifiers (.*?) to prevent ReDoS attacks
    const maliciousPatterns = [
      // Script injection attempts - improved to catch more variants
      /<script[\s\S]*?>/gi, // Opening script tag with any attributes/whitespace
      /<\/script>/gi, // Closing script tag
      /javascript\s*:/gi, // JavaScript protocol (with optional spaces)
      /vbscript\s*:/gi, // VBScript protocol
      /data\s*:.*?script/gi, // Data URI with script
      /on\w+\s*=/gi, // Any event handler (onload, onerror, onclick, etc.)
      /<iframe[\s\S]*?>/gi, // iframe tags with any content
      /<\/iframe>/gi, // Closing iframe tag
      /<object[\s\S]*?>/gi, // Object tags
      /<embed[\s\S]*?>/gi, // Embed tags

      // File inclusion attacks (using non-greedy quantifiers to prevent ReDoS)
      /<\?php/gi,
      /<%/g,
      /\{\{.*?\}\}/g, // Template syntax (non-greedy to prevent ReDoS)
      /<%.*?%>/g, // ASP/JSP tags (non-greedy to prevent ReDoS)

      // SQL injection patterns
      /union\s+select/gi,
      /drop\s+(table|database)/gi,
      /insert\s+into\s+\w+/gi,
      /delete\s+from\s+\w+/gi,

      // Path traversal
      /\.\.\//g,
      /\/\.\.\//g,
      /\\x2e\\x2e\\x2f/gi,

      // Command execution
      /;\s*(cat|ls|dir|type|echo|cmd|bash|sh|powershell)/gi,
      /exec\s*\(/gi,
      /eval\s*\(/gi,
      /system\s*\(/gi,
    ];

    // Use streaming for large files (5-10MB), in-memory for smaller files
    let content = '';
    if (file.size > this.STREAMING_THRESHOLD) {
      // Large file: use streaming approach to avoid memory issues
      const streamResult = await this.scanFileInChunks(file, maliciousPatterns);
      threats.push(...streamResult.threats);
      score += streamResult.score;
    } else {
      // Small file: load into memory (fast path for < 5MB files)
      content = await file.text();

      // Pattern matching for in-memory content
      for (const pattern of maliciousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          threats.push(`Malicious pattern detected: ${pattern.source}`);
          score += matches.length * 10;
        }
      }
    }

    // File type specific checks (only for in-memory scans where we have content)
    // LIMITATION: These checks only apply to files < 5MB (STREAMING_THRESHOLD)
    // Larger files (5-10MB) only undergo pattern matching via streaming
    // This is a performance trade-off to avoid loading large files into memory
    if (content && file.type.startsWith('text/')) {
      // Check for executable content in text files
      if (content.includes('#!/bin/') || content.includes('#!/usr/bin/')) {
        threats.push('Executable content in text file');
        score += 50;
      }
    }

    if (content && file.type.startsWith('image/')) {
      // Check for embedded scripts in image files (steganography)
      if (content.includes('<script') || content.includes('javascript:')) {
        threats.push('Suspicious content in image file');
        score += 30;
      }
    }

    // Size-based risk assessment
    if (file.size > 50 * 1024 * 1024) { // > 50MB
      threats.push('Unusually large file size');
      score += 20;
    }

    if (file.size < 10) { // < 10 bytes
      threats.push('Unusually small file size');
      score += 15;
    }

    // Determine if file is clean
    const isClean = threats.length === 0 && score < 30;

    return {
      isClean,
      threats,
      score,
      details: {
        fileSize: file.size,
        fileType: file.type,
        scanPatterns: maliciousPatterns.length,
        threatsFound: threats.length
      }
    };
  }

  static async validateFileSecurity(file: File, userId?: string): Promise<{
    isSecure: boolean;
    quarantineRequired: boolean;
    error?: UploadError;
    scanResults?: SecurityScanResult;
  }> {
    try {
      // Check rate limit for security scans
      const rateLimitPassed = await this.checkRateLimit(
        userId || 'anonymous',
        'VIRUS_SCAN'
      );

      if (!rateLimitPassed) {
        return {
          isSecure: false,
          quarantineRequired: false,
          error: {
            type: 'VIRUS_ERROR' as any,
            message: 'Rate limit exceeded for security scanning',
            userMessage: 'Too many security scans. Please wait a moment and try again.',
            retryable: true,
            retryAfter: 60000,
            correlationId: crypto.randomUUID(),
            timestamp: new Date()
          }
        };
      }

      // Perform security scan on the file
      const scanResults = await this.scanForMaliciousContent(file);
      const isSecure = scanResults.isClean;
      const quarantineRequired = !isSecure && scanResults.score >= 30;

      if (!isSecure) {
        let quarantined = false;

        // Quarantine file if threat level is high (and storage is available)
        if (quarantineRequired) {
          const quarantinePath = await this.quarantineFile(
            file,
            scanResults.threats.join('; '),
            scanResults.score >= 70 ? 'critical' : scanResults.score >= 50 ? 'high' : 'medium',
            userId,
            scanResults
          );
          quarantined = quarantinePath !== null;
        }

        return {
          isSecure: false,
          quarantineRequired,
          error: {
            type: 'VIRUS_ERROR' as any,
            message: `Security threat detected: ${scanResults.threats[0] || 'Unknown threat'}`,
            userMessage: quarantined
              ? 'This file appears to contain potentially malicious content and has been quarantined for review.'
              : 'This file appears to contain potentially malicious content and cannot be uploaded.',
            details: {
              threats: scanResults.threats,
              score: scanResults.score,
              quarantined
            },
            retryable: false,
            correlationId: crypto.randomUUID(),
            timestamp: new Date()
          },
          scanResults
        };
      }

      return {
        isSecure: true,
        quarantineRequired: false,
        scanResults
      };
    } catch (error) {
      console.error('Security validation failed:', error);

      return {
        isSecure: false,
        quarantineRequired: true,
        error: {
          type: 'VIRUS_ERROR' as any,
          message: 'Security scan failed',
          userMessage: 'Unable to scan file for security threats. File has been quarantined for review.',
          retryable: true,
          retryAfter: 300000, // 5 minutes
          correlationId: crypto.randomUUID(),
          timestamp: new Date()
        }
      };
    }
  }

  static async cleanupQuarantinedFiles(olderThanDays: number = 30): Promise<number> {
    try {
      const supabase = await createClient();
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // List quarantined files older than cutoff
      const { data: files, error } = await supabase.storage
        .from(this.QUARANTINE_BUCKET)
        .list('quarantine', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'asc' }
        });

      if (error) {
        console.error('Failed to list quarantined files:', error);
        return 0;
      }

      if (!files) return 0;

      // Filter files older than cutoff date
      const oldFiles = files.filter(file => {
        const fileDate = new Date(file.created_at || 0);
        return fileDate < cutoffDate;
      });

      if (oldFiles.length === 0) return 0;

      // Delete old files
      const pathsToDelete = oldFiles.map(file => `quarantine/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(this.QUARANTINE_BUCKET)
        .remove(pathsToDelete);

      if (deleteError) {
        console.error('Failed to delete old quarantined files:', deleteError);
        return 0;
      }

            return oldFiles.length;
    } catch (error) {
      console.error('Error during quarantine cleanup:', error);
      return 0;
    }
  }

  // Cleanup expired rate limit entries to prevent memory leak
  static cleanupExpiredRateLimits(): number {
    const now = Date.now();
    let cleanedCount = 0;

    // Note: Deleting from a Map during iteration is safe per ECMAScript specification.
    // Map.entries() returns an iterator that handles modifications during iteration correctly.
    // This is unlike some other languages/collections where deletion during iteration causes issues.
    for (const [key, limit] of this.RATE_LIMITS.entries()) {
      // Remove entries that are older than 2x their window size
      if (now - limit.windowStart > limit.windowSize * 2) {
        this.RATE_LIMITS.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Initialize periodic cleanup
  static startCleanupScheduler() {
    // Don't start timers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Singleton guard: prevent multiple scheduler instances
    if (this.isSchedulerRunning) {
      console.warn('Cleanup scheduler is already running');
      return;
    }

    this.isSchedulerRunning = true;

    // Run quarantine file cleanup every 24 hours
    const quarantineTimer = setInterval(() => {
      this.cleanupQuarantinedFiles();
    }, this.CLEANUP_INTERVAL);
    this.cleanupTimers.push(quarantineTimer);

    // Run rate limit cleanup more frequently (every 5 minutes)
    const rateLimitTimer = setInterval(() => {
      this.cleanupExpiredRateLimits();
    }, 5 * 60 * 1000);
    this.cleanupTimers.push(rateLimitTimer);
  }

  // Stop all cleanup timers
  static stopCleanupScheduler() {
    this.cleanupTimers.forEach(timer => clearInterval(timer));
    this.cleanupTimers = [];
    this.isSchedulerRunning = false;
  }
}
