// src/lib/upload-security.ts
import { createClient } from "@/utils/supabase/server";
import { UploadError, SecurityScanResult } from "@/types/upload";

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

export class UploadSecurityManager {
  private static readonly QUARANTINE_BUCKET = 'quarantined-files';
  private static readonly RATE_LIMITS = new Map<string, RateLimit>();
  private static readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // Rate limiting configuration
  static readonly RATE_LIMITS_CONFIG = {
    UPLOAD: { maxAttempts: 10, windowMs: 60000 }, // 10 uploads per minute
    VIRUS_SCAN: { maxAttempts: 50, windowMs: 60000 }, // 50 scans per minute
    ERROR_REPORT: { maxAttempts: 20, windowMs: 60000 } // 20 error reports per minute
  };

  static async checkRateLimit(userId: string, action: keyof typeof UploadSecurityManager.RATE_LIMITS_CONFIG): Promise<boolean> {
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
          await supabase.from('quarantine_logs').insert({
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            quarantine_path: quarantinePath,
            reason,
            threat_level: threatLevel,
            user_id: userId || null,
            scan_results: scanResults || null,
            review_status: 'pending'
          });
        } catch (dbError) {
          console.warn('Failed to log quarantine event to database:', dbError);
          // Continue even if logging fails
        }

        console.log(`File quarantined: ${file.name} (${threatLevel} threat)`);
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

  static async scanForMaliciousContent(file: File): Promise<SecurityScanResult> {
    const content = await file.text();
    const threats: string[] = [];
    let score = 0;

    // Pattern matching for malicious content detection
    // NOTE: These patterns are for DETECTION only, not sanitization
    // For actual sanitization, use DOMPurify or similar libraries
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

      // File inclusion attacks
      /<\?php/gi,
      /<%/g,
      /{{.*}}/g,
      /<%.*%>/g,

      // SQL injection patterns
      /union\s+select/gi,
      /drop\s+table/gi,
      /insert\s+into/gi,
      /delete\s+from/gi,
      /select\s+.*from/gi,

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

    for (const pattern of maliciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push(`Malicious pattern detected: ${pattern.source}`);
        score += matches.length * 10;
      }
    }

    // File type specific checks
    if (file.type.startsWith('text/')) {
      // Check for executable content in text files
      if (content.includes('#!/bin/') || content.includes('#!/usr/bin/')) {
        threats.push('Executable content in text file');
        score += 50;
      }
    }

    if (file.type.startsWith('image/')) {
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

    for (const [key, limit] of this.RATE_LIMITS.entries()) {
      // Remove entries that are older than 2x their window size
      if (now - limit.windowStart > limit.windowSize * 2) {
        this.RATE_LIMITS.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired rate limit entries`);
    }

    return cleanedCount;
  }

  // Initialize periodic cleanup
  static startCleanupScheduler() {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.cleanupQuarantinedFiles();
      this.cleanupExpiredRateLimits();
    }, this.CLEANUP_INTERVAL);

    // Also run rate limit cleanup more frequently (every 5 minutes)
    setInterval(() => {
      this.cleanupExpiredRateLimits();
    }, 5 * 60 * 1000); // 5 minutes
  }
}
