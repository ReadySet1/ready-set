// src/utils/auth-events.ts
// Enhanced event system for authentication state changes with immediate synchronization

const authEventTarget = typeof window !== 'undefined' ? new EventTarget() : null;

export type AuthEventType = 
  | 'login' 
  | 'logout' 
  | 'session-refresh' 
  | 'session-expired'
  | 'auth-state-check'
  | 'auth-confirmation-required'
  | 'auth-sync-requested';

export interface AuthEventDetail {
  type: AuthEventType;
  payload?: any;
  timestamp?: Date;
  source?: 'server' | 'client' | 'listener';
}

// Enhanced event emission with detailed tracking
export function emitAuthEvent(type: AuthEventType, payload?: any, source: 'server' | 'client' | 'listener' = 'client') {
  if (!authEventTarget) return;
  
  console.log(`[AuthEvents] Emitting ${type} event`, { payload, source, timestamp: new Date() });
  
  const event = new CustomEvent<AuthEventDetail>('auth-event', {
    detail: { 
      type, 
      payload, 
      timestamp: new Date(),
      source 
    },
  });
  authEventTarget.dispatchEvent(event);
}

export function onAuthEvent(
  handler: (event: CustomEvent<AuthEventDetail>) => void
): () => void {
  if (!authEventTarget) return () => {};
  const listener = (event: Event) => {
    handler(event as CustomEvent<AuthEventDetail>);
  };
  authEventTarget.addEventListener('auth-event', listener);
  // Return unsubscribe function
  return () => {
    authEventTarget.removeEventListener('auth-event', listener);
  };
}

// Authentication state persistence utilities
const AUTH_STATE_KEY = 'ready-set-auth-pending';
const AUTH_CHECK_KEY = 'ready-set-auth-check';

export interface PendingAuthState {
  timestamp: number;
  userId?: string;
  email?: string;
  source: 'server-login' | 'client-login' | 'redirect';
}

// Store pending authentication state
export function setPendingAuthState(state: Omit<PendingAuthState, 'timestamp'>) {
  if (typeof window === 'undefined') return;
  
  const pendingState: PendingAuthState = {
    ...state,
    timestamp: Date.now()
  };
  
  console.log('[AuthEvents] Setting pending auth state:', pendingState);
  sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(pendingState));
}

// Get and clear pending authentication state
export function getPendingAuthState(): PendingAuthState | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = sessionStorage.getItem(AUTH_STATE_KEY);
    if (!stored) return null;
    
    const state = JSON.parse(stored) as PendingAuthState;
    
    // Clear stale state (older than 30 seconds)
    if (Date.now() - state.timestamp > 30000) {
      sessionStorage.removeItem(AUTH_STATE_KEY);
      return null;
    }
    
    console.log('[AuthEvents] Retrieved pending auth state:', state);
    return state;
  } catch (error) {
    console.error('[AuthEvents] Error retrieving pending auth state:', error);
    sessionStorage.removeItem(AUTH_STATE_KEY);
    return null;
  }
}

// Clear pending authentication state
export function clearPendingAuthState() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_STATE_KEY);
  console.log('[AuthEvents] Cleared pending auth state');
}

// Authentication confirmation utilities
export async function confirmAuthenticationState(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    console.log('[AuthEvents] Confirming authentication state...');
    
    // Import Supabase client dynamically to avoid SSR issues
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[AuthEvents] Error confirming auth state:', error);
      return false;
    }
    
    const isAuthenticated = !!session?.user;
    console.log('[AuthEvents] Authentication state confirmed:', isAuthenticated);
    
    if (isAuthenticated) {
      // Store successful auth check timestamp
      sessionStorage.setItem(AUTH_CHECK_KEY, Date.now().toString());
      
      // Emit auth confirmation event
      emitAuthEvent('auth-state-check', { 
        confirmed: true, 
        user: session.user,
        session: session 
      }, 'client');
    }
    
    return isAuthenticated;
  } catch (error) {
    console.error('[AuthEvents] Error during auth confirmation:', error);
    return false;
  }
}

// Request immediate auth synchronization
export function requestAuthSync(reason: string = 'manual') {
  console.log(`[AuthEvents] Requesting auth sync: ${reason}`);
  emitAuthEvent('auth-sync-requested', { reason, timestamp: Date.now() }, 'client');
} 