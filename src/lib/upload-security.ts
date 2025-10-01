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
  ): Promise<string> {
    try {
      const supabase = await createClient();

      // Generate unique quarantine path
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileExt = file.name.split('.').pop() || 'unknown';
      const quarantinePath = `quarantine/${timestamp}-${randomId}.${fileExt}`;

      // Upload to quarantine bucket
      const { data, error } = await supabase.storage
        .from(this.QUARANTINE_BUCKET)
        .upload(quarantinePath, file, {
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.error('Failed to quarantine file:', error);
        throw error;
      }

      // Log quarantine event
      const quarantineRecord: QuarantineFile = {
        id: `${timestamp}-${randomId}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        originalPath: 'upload-attempt',
        quarantinePath,
        reason,
        threatLevel,
        userId,
        quarantinedAt: new Date(),
        scanResults
      };

      console.log('File quarantined:', quarantineRecord);

      return quarantinePath;
    } catch (error) {
      console.error('Error quarantining file:', error);
      throw new Error('Failed to quarantine suspicious file');
    }
  }

  static async scanForMaliciousContent(file: File): Promise<SecurityScanResult> {
    const content = await file.text();
    const threats: string[] = [];
    let score = 0;

    // Basic pattern matching for malicious content
    const maliciousPatterns = [
      // Script injection attempts
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,

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

      // Perform security scan
      const scanResults = await this.scanForMaliciousContent(file);

      // Determine security status
      const isSecure = scanResults.isClean;
      const quarantineRequired = !isSecure && scanResults.score >= 30;

      if (!isSecure) {
        // Quarantine file if threat level is high
        if (quarantineRequired) {
          await this.quarantineFile(
            file,
            scanResults.threats.join('; '),
            scanResults.score >= 70 ? 'critical' : scanResults.score >= 50 ? 'high' : 'medium',
            userId,
            scanResults
          );
        }

        return {
          isSecure: false,
          quarantineRequired,
          error: {
            type: 'VIRUS_ERROR' as any,
            message: `Security threat detected: ${scanResults.threats[0] || 'Unknown threat'}`,
            userMessage: 'This file appears to contain potentially malicious content and cannot be uploaded.',
            details: {
              threats: scanResults.threats,
              score: scanResults.score,
              quarantined: quarantineRequired
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

      console.log(`Cleaned up ${oldFiles.length} quarantined files older than ${olderThanDays} days`);
      return oldFiles.length;
    } catch (error) {
      console.error('Error during quarantine cleanup:', error);
      return 0;
    }
  }

  // Initialize periodic cleanup
  static startCleanupScheduler() {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.cleanupQuarantinedFiles();
    }, this.CLEANUP_INTERVAL);

    console.log('Upload security cleanup scheduler started');
  }
}
