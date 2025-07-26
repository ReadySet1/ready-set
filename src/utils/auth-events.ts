export interface AuthEvent {
  type: 'login' | 'logout' | 'auth-state-changed';
  payload?: {
    user?: any;
    error?: string;
  };
}

export interface AuthEventDetail {
  type: string;
  payload?: any;
}

export interface AuthEventListener {
  (event: { detail: AuthEventDetail }): void;
}

/**
 * Subscribe to authentication events
 * @param listener Function to call when auth events occur
 * @returns Unsubscribe function
 */
export const onAuthEvent = (listener: AuthEventListener): (() => void) => {
  const handleEvent = (event: CustomEvent<AuthEventDetail>) => {
    listener(event);
  };

  // Listen for custom auth events
  window.addEventListener('auth-event', handleEvent as EventListener);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('auth-event', handleEvent as EventListener);
  };
};

/**
 * Dispatch an authentication event
 * @param type Event type
 * @param payload Event payload
 */
export const dispatchAuthEvent = (type: string, payload?: any): void => {
  const event = new CustomEvent('auth-event', {
    detail: { type, payload }
  });
  window.dispatchEvent(event);
}; 