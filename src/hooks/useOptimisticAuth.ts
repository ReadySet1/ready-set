// src/hooks/useOptimisticAuth.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react';
import { UserType } from '@/types/user';
import { User } from '@supabase/supabase-js';

export interface OptimisticAuthState {
  user: User | null;
  userRole: UserType | null;
  isLoading: boolean;
  isOptimistic: boolean;
  optimisticTimestamp: number | null;
}

export interface OptimisticUpdate {
  user: User;
  userRole: UserType;
  confidence: 'high' | 'medium' | 'low';
  source: 'login' | 'hydration' | 'session' | 'recovery';
}

interface UseOptimisticAuthOptions {
  initialState?: Partial<OptimisticAuthState>;
  optimisticTimeout?: number; // ms before reverting optimistic state
  confidenceThreshold?: 'high' | 'medium' | 'low';
}

/**
 * Hook for managing optimistic auth state updates
 * Provides immediate UI feedback while auth operations complete
 */
export const useOptimisticAuth = (options: UseOptimisticAuthOptions = {}) => {
  const {
    initialState = {},
    optimisticTimeout = 10000, // 10 seconds
    confidenceThreshold = 'medium'
  } = options;

  const [authState, setAuthState] = useState<OptimisticAuthState>({
    user: null,
    userRole: null,
    isLoading: true,
    isOptimistic: false,
    optimisticTimestamp: null,
    ...initialState
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<OptimisticUpdate | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const applyOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    console.log('Applying optimistic auth update:', update);

    // Check if update meets confidence threshold
    const confidenceLevels = ['low', 'medium', 'high'];
    const updateLevel = confidenceLevels.indexOf(update.confidence);
    const thresholdLevel = confidenceLevels.indexOf(confidenceThreshold);

    if (updateLevel < thresholdLevel) {
      console.log('Optimistic update below confidence threshold, skipping');
      return;
    }

    // Store pending update
    pendingUpdateRef.current = update;

    // Apply optimistic state
    setAuthState(prev => ({
      ...prev,
      user: update.user,
      userRole: update.userRole,
      isLoading: false,
      isOptimistic: true,
      optimisticTimestamp: Date.now()
    }));

    // Set timeout to revert optimistic state if not confirmed
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      console.log('Optimistic auth update timed out, reverting...');
      setAuthState(prev => ({
        ...prev,
        isOptimistic: false,
        optimisticTimestamp: null,
        isLoading: true // Resume loading state
      }));
      pendingUpdateRef.current = null;
    }, optimisticTimeout);
  }, [confidenceThreshold, optimisticTimeout]);

  const confirmOptimisticUpdate = useCallback((confirmedUser: User | null, confirmedRole: UserType | null) => {
    console.log('Confirming optimistic auth update:', { confirmedUser: !!confirmedUser, confirmedRole });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const pendingUpdate = pendingUpdateRef.current;
    pendingUpdateRef.current = null;

    setAuthState(prev => {
      // Check if confirmed state matches optimistic prediction
      const matchesOptimistic = pendingUpdate && 
        confirmedUser?.id === pendingUpdate.user.id &&
        confirmedRole === pendingUpdate.userRole;

      if (matchesOptimistic) {
        console.log('✅ Optimistic update confirmed successfully');
      } else {
        console.log('⚠️ Optimistic update mismatch, using confirmed state');
      }

      return {
        ...prev,
        user: confirmedUser,
        userRole: confirmedRole,
        isLoading: false,
        isOptimistic: false,
        optimisticTimestamp: null
      };
    });
  }, []);

  const revertOptimisticUpdate = useCallback((reason?: string) => {
    console.log('Reverting optimistic auth update:', reason || 'No reason provided');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pendingUpdateRef.current = null;

    setAuthState(prev => ({
      ...prev,
      user: null,
      userRole: null,
      isLoading: true,
      isOptimistic: false,
      optimisticTimestamp: null
    }));
  }, []);

  const updateAuthState = useCallback((updates: Partial<OptimisticAuthState>) => {
    setAuthState(prev => ({
      ...prev,
      ...updates,
      isOptimistic: false,
      optimisticTimestamp: null
    }));

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, []);

  // Helper to create optimistic updates from various sources
  const createOptimisticUpdate = useCallback((
    user: User,
    userRole: UserType,
    source: OptimisticUpdate['source']
  ): OptimisticUpdate => {
    // Determine confidence based on source
    let confidence: OptimisticUpdate['confidence'];
    
    switch (source) {
      case 'login':
        confidence = 'high'; // Login action provides reliable data
        break;
      case 'hydration':
        confidence = 'high'; // Server-side hydration is reliable
        break;
      case 'session':
        confidence = 'medium'; // Session data may be stale
        break;
      case 'recovery':
        confidence = 'low'; // Recovery may not reflect current state
        break;
      default:
        confidence = 'medium';
    }

    return {
      user,
      userRole,
      confidence,
      source
    };
  }, []);

  return {
    authState,
    applyOptimisticUpdate,
    confirmOptimisticUpdate,
    revertOptimisticUpdate,
    updateAuthState,
    createOptimisticUpdate,
    isPendingOptimistic: !!pendingUpdateRef.current,
    optimisticAge: authState.optimisticTimestamp 
      ? Date.now() - authState.optimisticTimestamp 
      : null
  };
};

export default useOptimisticAuth;
