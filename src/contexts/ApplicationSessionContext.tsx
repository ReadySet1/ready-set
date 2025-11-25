// src/contexts/ApplicationSessionContext.tsx

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { storeEncryptedSession, retrieveEncryptedSession } from '@/lib/session-encryption';
import { logError, ErrorSeverity, ErrorCategory } from '@/lib/error-logging';

interface ApplicationSession {
  sessionId: string | null;
  uploadToken: string | null;
  expiresAt: string | null;
  uploadCount: number;
  maxUploads: number;
}

interface SessionContextValue {
  session: ApplicationSession | null;
  isLoading: boolean;
  error: string | null;
  createSession: (formData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }) => Promise<void>;
  markSessionCompleted: (jobApplicationId: string) => Promise<void>;
  resetSession: () => void;
}

const ApplicationSessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useApplicationSession() {
  const context = useContext(ApplicationSessionContext);
  if (!context) {
    throw new Error('useApplicationSession must be used within ApplicationSessionProvider');
  }
  return context;
}

interface ApplicationSessionProviderProps {
  children: React.ReactNode;
}

export function ApplicationSessionProvider({ children }: ApplicationSessionProviderProps) {
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if session is expired
  const isSessionExpired = useCallback(() => {
    if (!session || !session.expiresAt) return true;
    return new Date(session.expiresAt) < new Date();
  }, [session]);

  // Create a new application session
  const createSession = useCallback(async (formData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }) => {
    // Don't create a new session if we already have a valid one
    if (session && !isSessionExpired()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/application-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const data = await response.json();

      const newSession: ApplicationSession = {
        sessionId: data.sessionId,
        uploadToken: data.uploadToken,
        expiresAt: data.expiresAt,
        uploadCount: 0,
        maxUploads: 10, // Default from backend
      };

      setSession(newSession);

      // Store in sessionStorage for UX (allows session restoration on page refresh)
      // SECURITY WARNING: sessionStorage provides NO protection against XSS attacks
      // uploadToken is stored here for UX only - consider this data public
      // Future: Migrate to httpOnly cookies for real security
      storeEncryptedSession('application_session', newSession);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);

      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating session:', err);
      }

      toast({
        title: 'Session Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session, isSessionExpired]);

  // Reset session
  const resetSession = useCallback(() => {
    setSession(null);
    setError(null);
    sessionStorage.removeItem('application_session');
  }, []);

  // Mark session as completed
  const markSessionCompleted = useCallback(async (jobApplicationId: string) => {
    if (!session || !session.sessionId || !session.uploadToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('No active session to mark as completed');
      }
      return;
    }

    try {
      const response = await fetch(`/api/application-sessions?id=${session.sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-upload-token': session.uploadToken,
        },
        body: JSON.stringify({
          completed: true,
          jobApplicationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark session as completed');
      }

      if (process.env.NODE_ENV === 'development') {
        // console.log('Session marked as completed');
      }

      // Clear the session after marking it complete
      resetSession();
    } catch (err) {
      // Log error for monitoring in production
      // This is not critical for user experience, so we don't throw
      logError(err, {
        source: 'ApplicationSessionContext.markSessionCompleted',
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        message: 'Failed to mark session as completed',
        additionalContext: {
          sessionId: session.sessionId,
          jobApplicationId
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.error('Error marking session as completed:', err);
      }
    }
  }, [session, resetSession]);


  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const parsedSession = retrieveEncryptedSession<ApplicationSession>('application_session');

      if (parsedSession && parsedSession.expiresAt) {
        // Check if stored session is expired
        if (new Date(parsedSession.expiresAt) > new Date()) {
          setSession(parsedSession);
        } else {
          sessionStorage.removeItem('application_session');
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error restoring session:', err);
      }
      sessionStorage.removeItem('application_session');
    }
  }, []);

  // Auto-clear expired sessions
  useEffect(() => {
    if (!session || !session.expiresAt) return;

    const checkExpiration = () => {
      if (isSessionExpired()) {
        resetSession();
        toast({
          title: 'Session Expired',
          description: 'Your upload session has expired. Please start a new application.',
          variant: 'destructive',
        });
      }
    };

    // Check immediately
    checkExpiration();

    // Check every minute
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [session, isSessionExpired, resetSession]);

  const value: SessionContextValue = {
    session,
    isLoading,
    error,
    createSession,
    markSessionCompleted,
    resetSession,
  };

  return (
    <ApplicationSessionContext.Provider value={value}>
      {children}
    </ApplicationSessionContext.Provider>
  );
}
