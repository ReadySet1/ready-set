// src/lib/role-validation.ts
// Role validation and recovery service

import { createClient } from "@/utils/supabase/client";
import { UserType } from "@/types/user";

export interface RoleValidationResult {
  isValid: boolean;
  currentRole: string | null;
  expectedRole: string | null;
  needsCorrection: boolean;
  error?: string;
  timestamp: Date;
}

export interface RoleCorrectionResult {
  success: boolean;
  oldRole: string | null;
  newRole: string | null;
  error?: string;
  timestamp: Date;
}

// Enhanced role validation with retry logic
export async function validateUserRole(
  userId: string,
  expectedRole?: string,
  maxRetries: number = 3
): Promise<RoleValidationResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[RoleValidation] Validating role for user ${userId}`);
    
    const supabase = createClient();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[RoleValidation] Role validation attempt ${attempt}/${maxRetries}`);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', userId)
          .single();
          
        if (error) {
          console.error(`[RoleValidation] Error fetching profile (attempt ${attempt}):`, error);
          
          if (error.code === 'PGRST116') {
            // No rows returned - profile doesn't exist
            console.log(`[RoleValidation] No profile found for user ${userId}`);
            return {
              isValid: false,
              currentRole: null,
              expectedRole: expectedRole || null,
              needsCorrection: false,
              error: 'Profile not found',
              timestamp: new Date(),
            };
          }
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry with exponential backoff
          const delay = 500 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const currentRole = profile?.type || null;
        const isValid = !expectedRole || currentRole === expectedRole;
        const needsCorrection = expectedRole && currentRole !== expectedRole;
        
        const duration = Date.now() - startTime;
        console.log(`[RoleValidation] Role validation completed in ${duration}ms:`, {
          userId,
          currentRole,
          expectedRole,
          isValid,
          needsCorrection,
        });
        
        return {
          isValid,
          currentRole,
          expectedRole: expectedRole || null,
          needsCorrection: Boolean(needsCorrection),
          timestamp: new Date(),
        };
        
      } catch (error) {
        console.error(`[RoleValidation] Role validation attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          return {
            isValid: false,
            currentRole: null,
            expectedRole: expectedRole || null,
            needsCorrection: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          };
        }
        
        // Wait before retry with exponential backoff
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      isValid: false,
      currentRole: null,
      expectedRole: expectedRole || null,
      needsCorrection: false,
      error: 'All validation attempts failed',
      timestamp: new Date(),
    };
    
  } catch (error) {
    console.error('[RoleValidation] Role validation failed:', error);
    return {
      isValid: false,
      currentRole: null,
      expectedRole: expectedRole || null,
      needsCorrection: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

// Automatic role correction
export async function correctUserRole(
  userId: string,
  newRole: string,
  maxRetries: number = 3
): Promise<RoleCorrectionResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[RoleValidation] Correcting role for user ${userId} to ${newRole}`);
    
    const supabase = createClient();
    
    // First, get the current role
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', userId)
      .single();
      
    if (fetchError) {
      console.error('[RoleValidation] Error fetching current profile:', fetchError);
      return {
        success: false,
        oldRole: null,
        newRole: null,
        error: fetchError.message,
        timestamp: new Date(),
      };
    }
    
    const oldRole = currentProfile?.type || null;
    
    // Don't update if role is already correct
    if (oldRole === newRole) {
      console.log(`[RoleValidation] Role already correct: ${newRole}`);
      return {
        success: true,
        oldRole,
        newRole,
        timestamp: new Date(),
      };
    }
    
    // Update the role with retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[RoleValidation] Role correction attempt ${attempt}/${maxRetries}`);
        
        const { error } = await supabase
          .from('profiles')
          .update({ 
            type: newRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
          
        if (error) {
          console.error(`[RoleValidation] Error updating role (attempt ${attempt}):`, error);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Wait before retry with exponential backoff
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[RoleValidation] Role correction completed in ${duration}ms:`, {
          userId,
          oldRole,
          newRole,
        });
        
        // Log the role change for debugging
        console.log(`[RoleValidation] Role changed for user ${userId}: ${oldRole} -> ${newRole}`);
        
        return {
          success: true,
          oldRole,
          newRole,
          timestamp: new Date(),
        };
        
      } catch (error) {
        console.error(`[RoleValidation] Role correction attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            oldRole,
            newRole: null,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          };
        }
        
        // Wait before retry with exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      oldRole,
      newRole: null,
      error: 'All correction attempts failed',
      timestamp: new Date(),
    };
    
  } catch (error) {
    console.error('[RoleValidation] Role correction failed:', error);
    return {
      success: false,
      oldRole: null,
      newRole: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

// Enhanced role validation for dashboard access
export async function validateDashboardAccess(
  userId: string,
  dashboardPath: string,
  userRole?: string
): Promise<RoleValidationResult> {
  console.log(`[RoleValidation] Validating dashboard access for user ${userId} to ${dashboardPath}`);
  
  // Determine expected role based on dashboard path
  let expectedRole: string | null = null;
  
  if (dashboardPath.startsWith('/admin')) {
    expectedRole = 'admin';
  } else if (dashboardPath.startsWith('/driver')) {
    expectedRole = 'driver';
  } else if (dashboardPath.startsWith('/helpdesk')) {
    expectedRole = 'helpdesk';
  } else if (dashboardPath.startsWith('/vendor')) {
    expectedRole = 'vendor';
  } else if (dashboardPath.startsWith('/client')) {
    expectedRole = 'client';
  }
  
  if (!expectedRole) {
    console.log(`[RoleValidation] No specific role required for path: ${dashboardPath}`);
    return {
      isValid: true,
      currentRole: userRole || null,
      expectedRole: null,
      needsCorrection: false,
      timestamp: new Date(),
    };
  }
  
  // Validate the user's role
  const validationResult = await validateUserRole(userId, expectedRole);
  
  if (validationResult.needsCorrection) {
    console.log(`[RoleValidation] Role mismatch detected, attempting correction`);
    
    // Attempt to correct the role
    const correctionResult = await correctUserRole(userId, expectedRole);
    
    if (correctionResult.success) {
      console.log(`[RoleValidation] Role corrected successfully: ${correctionResult.oldRole} -> ${correctionResult.newRole}`);
      
      return {
        isValid: true,
        currentRole: correctionResult.newRole,
        expectedRole,
        needsCorrection: false,
        timestamp: new Date(),
      };
    } else {
      console.error(`[RoleValidation] Role correction failed:`, correctionResult.error);
      
      return {
        isValid: false,
        currentRole: validationResult.currentRole,
        expectedRole,
        needsCorrection: true,
        error: `Role correction failed: ${correctionResult.error}`,
        timestamp: new Date(),
      };
    }
  }
  
  return validationResult;
}

// Helper function to determine if user should be admin based on email
export function shouldBeAdmin(email: string): boolean {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const adminDomains = process.env.NEXT_PUBLIC_ADMIN_DOMAINS?.split(',').map(d => d.trim().toLowerCase()) || [];
  
  const emailLower = email.toLowerCase();
  
  // Check exact email match (including existing ADMIN_EMAIL)
  if (adminEmail && emailLower === adminEmail) {
    return true;
  }
  
  if (adminEmails.includes(emailLower)) {
    return true;
  }
  
  // Check domain match
  const domain = emailLower.split('@')[1];
  if (domain && adminDomains.includes(domain)) {
    return true;
  }
  
  return false;
}

// Enhanced role detection for new users
export async function detectUserRole(user: any): Promise<string> {
  if (!user?.email) {
    return 'client';
  }
  
  // Check if user should be admin
  if (shouldBeAdmin(user.email)) {
    return 'admin';
  }
  
  // Check user metadata for role hints
  const userType = user.user_metadata?.user_type || user.user_metadata?.userType;
  if (userType) {
    const normalizedType = userType.toLowerCase();
    if (['admin', 'super_admin', 'driver', 'helpdesk', 'vendor', 'client'].includes(normalizedType)) {
      return normalizedType;
    }
  }
  
  // Default to client
  return 'client';
}

// Role validation middleware for API routes
export async function validateRoleForAPI(
  userId: string,
  requiredRole: string
): Promise<{ isValid: boolean; currentRole: string | null; error?: string }> {
  const validationResult = await validateUserRole(userId, requiredRole);
  
  if (validationResult.needsCorrection) {
    // Attempt to correct the role
    const correctionResult = await correctUserRole(userId, requiredRole);
    
    if (correctionResult.success) {
      return {
        isValid: true,
        currentRole: correctionResult.newRole,
      };
    } else {
      return {
        isValid: false,
        currentRole: validationResult.currentRole,
        error: `Role validation failed: ${correctionResult.error}`,
      };
    }
  }
  
  return {
    isValid: validationResult.isValid,
    currentRole: validationResult.currentRole,
    error: validationResult.error,
  };
} 