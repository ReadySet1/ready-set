// src/utils/auth/hydration.ts
'use client'

import { UserType } from "@/types/user";
import { authLogger } from "@/utils/logger";

export interface ServerAuthState {
  userId: string;
  email: string;
  userRole: UserType;
  timestamp: number;
}

export interface CachedProfileData {
  type: UserType;
  email: string;
  name: string;
  timestamp: number;
}

/**
 * Auth State Hydration System
 * Bridges server-side auth state with client-side state management
 */

/**
 * Simple, bulletproof cookie extraction
 */
export const getServerAuthState = (): ServerAuthState | null => {
    
  if (typeof window === 'undefined') {
        return null;
  }
  
  try {
    // Find the session cookie directly
    const cookieString = document.cookie;
        
    const sessionMatch = cookieString.match(/user-session-data=([^;]+)/);
    if (!sessionMatch) {
            return null;
    }
    
    const encodedValue = sessionMatch[1];
    if (!encodedValue) {
            return null;
    }
    
        
    const decodedValue = decodeURIComponent(encodedValue);
        
    const sessionData = JSON.parse(decodedValue);
        
    // Validate required fields
    if (!sessionData.userId || !sessionData.email || !sessionData.userRole) {
            return null;
    }
    
    // Check age (10 minutes max)
    const ageMinutes = (Date.now() - sessionData.timestamp) / (1000 * 60);
        
    if (ageMinutes > 10) {
            clearServerAuthState();
      return null;
    }
    
    // Normalize userRole to lowercase to match TypeScript enum
    const normalizedRole = sessionData.userRole.toLowerCase();
    authLogger.debug('🔄 Normalizing userRole from', sessionData.userRole, 'to', normalizedRole);
    
    // Find matching enum value
    const enumValues = Object.values(UserType);
    const matchingEnum = enumValues.find(enumValue => 
      enumValue.toLowerCase() === normalizedRole
    );
    
    if (!matchingEnum) {
      console.warn('❌ No matching enum for role:', normalizedRole, 'Available:', enumValues);
      return null;
    }
    
    const result = {
      userId: sessionData.userId,
      email: sessionData.email,
      userRole: matchingEnum,
      timestamp: sessionData.timestamp
    };
    
    authLogger.debug('✅ Successfully parsed session data:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error in getServerAuthState:', error);
    return null;
  }
};

/**
 * Gets cached profile data from server-side prefetch
 */
export const getCachedProfileData = (userId: string): CachedProfileData | null => {
  if (typeof window === 'undefined') return null;
  
  try {
        
    const cookieString = document.cookie;
    const profileMatch = cookieString.match(new RegExp(`user-profile-${userId}=([^;]+)`));
    
    if (!profileMatch) {
            return null;
    }
    
    const encodedValue = profileMatch[1];
    if (!encodedValue) {
            return null;
    }
    
        
    const decodedValue = decodeURIComponent(encodedValue);
        
    const profileData = JSON.parse(decodedValue);
        
    // Check age (10 minutes max)
    const ageMinutes = (Date.now() - profileData.timestamp) / (1000 * 60);
        
    if (ageMinutes > 10) {
            clearCachedProfileData(userId);
      return null;
    }
    
    // Validate structure
    if (!profileData.type || !profileData.email) {
            return null;
    }
    
    authLogger.debug('✅ Successfully recovered profile data:', profileData);
    return profileData;
  } catch (error) {
    console.error('❌ Error in getCachedProfileData:', error);
    return null;
  }
};

/**
 * Hydrates client-side auth state from server-side data
 */
export const hydrateAuthState = (userId?: string) => {
  const serverState = getServerAuthState();
  const profileData = userId ? getCachedProfileData(userId) : null;
  
  return {
    serverState,
    profileData,
    hasHydrationData: !!(serverState || profileData)
  };
};

/**
 * Clears server auth state cookies
 */
export const clearServerAuthState = () => {
  if (typeof window === 'undefined') return;
  
  try {
    document.cookie = 'user-session-data=; path=/; max-age=0; samesite=lax';
      } catch (error) {
    console.error('Error clearing server auth state:', error);
  }
};

/**
 * Clears cached profile data for a specific user
 */
export const clearCachedProfileData = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  try {
    document.cookie = `user-profile-${userId}=; path=/; max-age=0; samesite=lax`;
      } catch (error) {
    console.error('Error clearing cached profile data:', error);
  }
};

/**
 * Clears all auth hydration data
 */
export const clearAllHydrationData = () => {
  clearServerAuthState();
  
  // Clear all user-profile cookies
  if (typeof window !== 'undefined') {
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.startsWith('user-profile-')) {
        document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
      }
    });
  }
  
  };

/**
 * Validates hydration data consistency
 */
export const validateHydrationData = (serverState: ServerAuthState | null, profileData: CachedProfileData | null) => {
  if (!serverState && !profileData) return { isValid: true, reason: 'No hydration data' };
  
  if (serverState && profileData) {
    // Check if server state and profile data match
    if (serverState.userRole !== profileData.type) {
      return { 
        isValid: false, 
        reason: `UserRole mismatch: server=${serverState.userRole}, profile=${profileData.type}` 
      };
    }
    
    if (serverState.email !== profileData.email) {
      return { 
        isValid: false, 
        reason: `Email mismatch: server=${serverState.email}, profile=${profileData.email}` 
      };
    }
  }
  
  return { isValid: true, reason: 'Hydration data is consistent' };
};



/**
 * Auth state recovery mechanism
 */
export const recoverAuthState = () => {
    
  // Check if we're on the client side
  if (typeof window === 'undefined') {
        return null;
  }
  
  try {
    const serverState = getServerAuthState();
        
    const profileData = serverState ? getCachedProfileData(serverState.userId) : null;
        
    const validation = validateHydrationData(serverState, profileData);
    if (!validation.isValid) {
      console.warn('❌ Invalid hydration data detected:', validation.reason);
      clearAllHydrationData();
      return null;
    }
    
    if (serverState) {
      authLogger.debug('✅ Auth state recovered successfully:', {
        userId: serverState.userId,
        email: serverState.email,
        userRole: serverState.userRole,
        hasProfileData: !!profileData
      });
      
      return {
        userId: serverState.userId,
        email: serverState.email,
        userRole: serverState.userRole,
        profileData
      };
    }
    
        return null;
  } catch (error) {
    console.error('❌ Critical error in recoverAuthState:', error);
    return null;
  }
};
