// src/utils/auth/hydration.ts
'use client'

import { UserType } from "@/types/user";

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
 * Gets server-side auth state from cookies set during login
 */
export const getServerAuthState = (): ServerAuthState | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('user-session-data='));
    
    if (!cookie) return null;
    
    const sessionDataStr = cookie.split('=')[1];
    if (!sessionDataStr) return null;
    const sessionData = JSON.parse(decodeURIComponent(sessionDataStr));
    
    // Validate session data structure
    if (!sessionData.userId || !sessionData.email || !sessionData.userRole) {
      return null;
    }
    
    // Check if session data is recent (within 5 minutes for hydration)
    const isRecent = Date.now() - sessionData.timestamp < 5 * 60 * 1000;
    if (!isRecent) {
      clearServerAuthState();
      return null;
    }
    
    // Validate userRole is a valid UserType
    const enumValues = Object.values(UserType);
    if (!enumValues.includes(sessionData.userRole)) {
      console.warn('Invalid userRole in session data:', sessionData.userRole);
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error('Error parsing server auth state:', error);
    return null;
  }
};

/**
 * Gets cached profile data from server-side prefetch
 */
export const getCachedProfileData = (userId: string): CachedProfileData | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`user-profile-${userId}=`));
    
    if (!cookie) return null;
    
    const profileDataStr = cookie.split('=')[1];
    if (!profileDataStr) return null;
    const profileData = JSON.parse(decodeURIComponent(profileDataStr));
    
    // Check if profile data is recent (within 10 minutes)
    const isRecent = Date.now() - profileData.timestamp < 10 * 60 * 1000;
    if (!isRecent) {
      clearCachedProfileData(userId);
      return null;
    }
    
    // Validate profile data structure
    if (!profileData.type || !profileData.email) {
      return null;
    }
    
    return profileData;
  } catch (error) {
    console.error('Error parsing cached profile data:', error);
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
    console.log('Cleared server auth state');
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
    console.log(`Cleared cached profile data for user ${userId}`);
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
  
  console.log('Cleared all auth hydration data');
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
  console.log('Starting auth state recovery...');
  
  const serverState = getServerAuthState();
  const profileData = serverState ? getCachedProfileData(serverState.userId) : null;
  
  const validation = validateHydrationData(serverState, profileData);
  if (!validation.isValid) {
    console.warn('Invalid hydration data detected:', validation.reason);
    clearAllHydrationData();
    return null;
  }
  
  if (serverState) {
    console.log('Auth state recovered from server data:', {
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
  
  console.log('No auth state to recover');
  return null;
};
