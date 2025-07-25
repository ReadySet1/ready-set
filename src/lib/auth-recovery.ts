// src/lib/auth-recovery.ts
// Authentication error recovery and fallback mechanisms

import { createClient } from "@/utils/supabase/client";
import { validateUserRole, correctUserRole } from "./role-validation";
import { emitAuthEvent } from "@/utils/auth-events";

export interface RecoveryResult {
  success: boolean;
  recoveredRole: string | null;
  error?: string;
  recoveryMethod: 'cache' | 're-fetch' | 'correction' | 'fallback';
  timestamp: Date;
}

export interface RoleSyncIssue {
  userId: string;
  issue: 'missing_profile' | 'role_mismatch' | 'fetch_failure' | 'timeout';
  details: string;
  timestamp: Date;
}

// Track role sync issues for debugging
const roleSyncIssues: RoleSyncIssue[] = [];

// Add role sync issue to tracking
export function trackRoleSyncIssue(
  userId: string,
  issue: RoleSyncIssue['issue'],
  details: string
): void {
  const syncIssue: RoleSyncIssue = {
    userId,
    issue,
    details,
    timestamp: new Date(),
  };
  
  roleSyncIssues.push(syncIssue);
  
  // Keep only last 100 issues
  if (roleSyncIssues.length > 100) {
    roleSyncIssues.splice(0, roleSyncIssues.length - 100);
  }
  
  console.log(`[AuthRecovery] Tracked role sync issue:`, syncIssue);
}

// Get recent role sync issues
export function getRecentRoleSyncIssues(limit: number = 10): RoleSyncIssue[] {
  return roleSyncIssues
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

// Enhanced role recovery with multiple fallback strategies
export async function recoverUserRole(
  userId: string,
  expectedRole?: string,
  maxRetries: number = 3
): Promise<RecoveryResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[AuthRecovery] Attempting role recovery for user ${userId}`);
    
    const supabase = createClient();
    
    // Strategy 1: Try to fetch from cache first (if available)
    const cachedRole = await getCachedRole(userId);
    if (cachedRole) {
      console.log(`[AuthRecovery] Using cached role: ${cachedRole}`);
      return {
        success: true,
        recoveredRole: cachedRole,
        recoveryMethod: 'cache',
        timestamp: new Date(),
      };
    }
    
    // Strategy 2: Re-fetch profile with enhanced retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AuthRecovery] Role re-fetch attempt ${attempt}/${maxRetries}`);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', userId)
          .single();
          
        if (error) {
          console.error(`[AuthRecovery] Error fetching profile (attempt ${attempt}):`, error);
          
          if (error.code === 'PGRST116') {
            // No rows returned - profile doesn't exist
            trackRoleSyncIssue(userId, 'missing_profile', `Profile not found for user ${userId}`);
            
            if (attempt === maxRetries) {
              return {
                success: false,
                recoveredRole: null,
                error: 'Profile not found',
                recoveryMethod: 'fallback',
                timestamp: new Date(),
              };
            }
          } else {
            trackRoleSyncIssue(userId, 'fetch_failure', `Database error: ${error.message}`);
          }
          
          // Wait before retry with exponential backoff
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const recoveredRole = profile?.type || null;
        
        if (recoveredRole) {
          // Cache the recovered role
          await setCachedRole(userId, recoveredRole);
          
          const duration = Date.now() - startTime;
          console.log(`[AuthRecovery] Role recovery successful in ${duration}ms:`, {
            userId,
            recoveredRole,
            attempt,
          });
          
          return {
            success: true,
            recoveredRole,
            recoveryMethod: 're-fetch',
            timestamp: new Date(),
          };
        } else {
          trackRoleSyncIssue(userId, 'role_mismatch', 'Profile exists but role is null');
        }
        
      } catch (error) {
        console.error(`[AuthRecovery] Role re-fetch attempt ${attempt} failed:`, error);
        trackRoleSyncIssue(userId, 'fetch_failure', `Re-fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Strategy 3: If expected role is provided, try to correct/create profile
    if (expectedRole) {
      console.log(`[AuthRecovery] Attempting role correction to ${expectedRole}`);
      
      try {
        const correctionResult = await correctUserRole(userId, expectedRole);
        
        if (correctionResult.success) {
          // Cache the corrected role
          await setCachedRole(userId, correctionResult.newRole || 'client');
          
          console.log(`[AuthRecovery] Role correction successful: ${correctionResult.oldRole} -> ${correctionResult.newRole}`);
          
          return {
            success: true,
            recoveredRole: correctionResult.newRole,
            recoveryMethod: 'correction',
            timestamp: new Date(),
          };
        } else {
          trackRoleSyncIssue(userId, 'role_mismatch', `Role correction failed: ${correctionResult.error}`);
        }
      } catch (error) {
        console.error(`[AuthRecovery] Role correction failed:`, error);
        trackRoleSyncIssue(userId, 'fetch_failure', `Correction error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Strategy 4: Fallback to default role
    console.log(`[AuthRecovery] Using fallback role: client`);
    trackRoleSyncIssue(userId, 'timeout', 'All recovery strategies failed, using fallback');
    
    return {
      success: true,
      recoveredRole: 'client', // Default fallback
      recoveryMethod: 'fallback',
      timestamp: new Date(),
    };
    
  } catch (error) {
    console.error('[AuthRecovery] Role recovery failed:', error);
    trackRoleSyncIssue(userId, 'fetch_failure', `Recovery error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      recoveredRole: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      recoveryMethod: 'fallback',
      timestamp: new Date(),
    };
  }
}

// Simple role caching mechanism
const roleCache = new Map<string, { role: string; timestamp: number }>();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

async function getCachedRole(userId: string): Promise<string | null> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
    console.log(`[AuthRecovery] Using cached role for user ${userId}: ${cached.role}`);
    return cached.role;
  }
  return null;
}

async function setCachedRole(userId: string, role: string): Promise<void> {
  roleCache.set(userId, { role, timestamp: Date.now() });
  console.log(`[AuthRecovery] Cached role for user ${userId}: ${role}`);
}

// Clear role cache for a specific user or all users
export function clearRoleCache(userId?: string): void {
  if (userId) {
    roleCache.delete(userId);
    console.log(`[AuthRecovery] Cleared cached role for user ${userId}`);
  } else {
    roleCache.clear();
    console.log('[AuthRecovery] Cleared all role cache');
  }
}

// Enhanced authentication state recovery
export async function recoverAuthState(
  userId: string,
  userRole?: string
): Promise<{ success: boolean; recoveredRole: string | null; error?: string }> {
  console.log(`[AuthRecovery] Attempting auth state recovery for user ${userId}`);
  
  try {
    // First, try to validate the current role
    if (userRole) {
      const validationResult = await validateUserRole(userId, userRole);
      
      if (validationResult.isValid) {
        console.log(`[AuthRecovery] Current role is valid: ${userRole}`);
        return {
          success: true,
          recoveredRole: userRole,
        };
      }
      
      if (validationResult.needsCorrection) {
        console.log(`[AuthRecovery] Role needs correction: ${userRole} -> ${validationResult.expectedRole}`);
        
        const correctionResult = await correctUserRole(userId, validationResult.expectedRole!);
        
        if (correctionResult.success) {
          console.log(`[AuthRecovery] Role corrected successfully: ${correctionResult.oldRole} -> ${correctionResult.newRole}`);
          return {
            success: true,
            recoveredRole: correctionResult.newRole,
          };
        }
      }
    }
    
    // If validation fails or no role provided, attempt recovery
    const recoveryResult = await recoverUserRole(userId, userRole);
    
    if (recoveryResult.success) {
      console.log(`[AuthRecovery] Auth state recovery successful: ${recoveryResult.recoveredRole}`);
      
      // Emit auth sync event to update UI
      emitAuthEvent('auth-sync-requested', {
        reason: 'auth state recovery',
        userId,
        recoveredRole: recoveryResult.recoveredRole,
      }, 'client');
      
      return {
        success: true,
        recoveredRole: recoveryResult.recoveredRole,
      };
    } else {
      console.error(`[AuthRecovery] Auth state recovery failed: ${recoveryResult.error}`);
      return {
        success: false,
        recoveredRole: null,
        error: recoveryResult.error,
      };
    }
    
  } catch (error) {
    console.error('[AuthRecovery] Auth state recovery failed:', error);
    return {
      success: false,
      recoveredRole: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// User feedback for role sync issues
export function provideUserFeedback(issue: RoleSyncIssue): string {
  switch (issue.issue) {
    case 'missing_profile':
      return 'Your profile is being created. Please wait a moment and refresh the page.';
    case 'role_mismatch':
      return 'Your account permissions are being updated. Please refresh the page.';
    case 'fetch_failure':
      return 'We\'re having trouble loading your account information. Please try again.';
    case 'timeout':
      return 'The system is taking longer than expected to load your account. Please refresh the page.';
    default:
      return 'There was an issue with your account. Please refresh the page or contact support.';
  }
}

// Get user-friendly error message for recovery failures
export function getUserFriendlyErrorMessage(error: string): string {
  if (error.includes('Profile not found')) {
    return 'Your account profile is being set up. Please wait a moment and try again.';
  }
  
  if (error.includes('timeout') || error.includes('network')) {
    return 'The connection is taking longer than expected. Please check your internet connection and try again.';
  }
  
  if (error.includes('permission') || error.includes('unauthorized')) {
    return 'You don\'t have permission to access this area. Please contact support if you believe this is an error.';
  }
  
  return 'There was an issue with your account. Please refresh the page or contact support if the problem persists.';
}

// Monitor role sync health
export function getRoleSyncHealth(): {
  totalIssues: number;
  recentIssues: RoleSyncIssue[];
  healthScore: number;
} {
  const recentIssues = getRecentRoleSyncIssues(20);
  const totalIssues = roleSyncIssues.length;
  
  // Calculate health score based on recent issues
  const recentIssueCount = recentIssues.length;
  const criticalIssues = recentIssues.filter(issue => 
    issue.issue === 'missing_profile' || issue.issue === 'fetch_failure'
  ).length;
  
  let healthScore = 100;
  if (recentIssueCount > 0) {
    healthScore -= (recentIssueCount * 2); // -2 points per recent issue
    healthScore -= (criticalIssues * 5); // -5 points per critical issue
  }
  
  healthScore = Math.max(0, healthScore); // Don't go below 0
  
  return {
    totalIssues,
    recentIssues,
    healthScore,
  };
} 