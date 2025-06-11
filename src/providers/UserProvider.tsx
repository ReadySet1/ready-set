"use client"

import React, { createContext, useContext, type ReactNode } from 'react'
import { useUser, type UseUserReturn } from '@/hooks/useUser'

const UserContext = createContext<UseUserReturn | undefined>(undefined)

export interface UserProviderProps {
  children: ReactNode
}

/**
 * User Context Provider
 * Provides user authentication state throughout the application
 */
export function UserProvider({ children }: UserProviderProps) {
  const userState = useUser()
  
  return (
    <UserContext.Provider value={userState}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Hook to access user context
 * Must be used within UserProvider
 */
export function useUserContext(): UseUserReturn {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider')
  }
  return context
}

/**
 * Type guards for user authentication checks
 */
export const userHelpers = {
  isAuthenticated: (user: UseUserReturn) => 
    !!user.profile && !!user.supabaseUser && !user.isLoading,
    
  isAdmin: (user: UseUserReturn) => 
    user.profile?.type === 'ADMIN' || user.profile?.type === 'SUPER_ADMIN',
    
  isDriver: (user: UseUserReturn) => 
    user.profile?.type === 'DRIVER',
    
  isVendor: (user: UseUserReturn) => 
    user.profile?.type === 'VENDOR',
    
  isClient: (user: UseUserReturn) => 
    user.profile?.type === 'CLIENT',
    
  hasActiveStatus: (user: UseUserReturn) => 
    user.profile?.status === 'ACTIVE'
}