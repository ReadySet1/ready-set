'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { ShieldAlert, Lock, CheckCircle2 } from 'lucide-react'

// Define home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
  admin: '/admin',
  super_admin: '/admin',
  driver: '/driver',
  helpdesk: '/helpdesk',
  vendor: '/client',
  client: '/client'
}

export default function ForcePasswordChangePage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  // Verify user has a valid session and needs password change
  useEffect(() => {
    const checkSession = async () => {
      const supabase = await createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No session, redirect to login
        router.replace('/sign-in')
        return
      }

      // Fetch user's profile to check if they actually need password change
      const { data: profile } = await supabase
        .from('profiles')
        .select('type, isTemporaryPassword')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile?.isTemporaryPassword) {
        // User doesn't need to change password, redirect to their dashboard
        const redirectPath = profile?.type
          ? USER_HOME_ROUTES[profile.type.toLowerCase()] || '/'
          : '/'
        router.replace(redirectPath)
        return
      }

      if (profile?.type) {
        setUserRole(profile.type.toLowerCase())
      }

      setIsLoading(false)
    }

    checkSession()
  }, [router])

  // Prevent back navigation
  useEffect(() => {
    const handlePopState = () => {
      // Push the current page back onto the history stack
      window.history.pushState(null, '', '/force-password-change')
    }

    // Push initial state
    window.history.pushState(null, '', '/force-password-change')
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = await createClient()

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        throw updateError
      }

      // Clear the temporary password flag
      const response = await fetch('/api/users/clear-temporary-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update password status')
      }

      setIsSuccess(true)

      // Show toast notification
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully changed. Welcome to Ready Set!',
      })

      // Redirect to appropriate dashboard based on user role
      setTimeout(() => {
        const redirectPath = userRole ? (USER_HOME_ROUTES[userRole] || '/') : '/'
        router.replace(redirectPath)
      }, 2000)

    } catch (err: unknown) {
      Sentry.captureException(err, {
        tags: { feature: 'force-password-change' },
        extra: { action: 'update-temporary-password' }
      })
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state while checking session
  if (isLoading) {
    return (
      <section className="bg-[#F4F7FF] pb-14 pt-[120px] dark:bg-dark sm:pt-[140px] md:pt-[160px] lg:pb-20 lg:pt-[180px]">
        <div className="container">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="py-8">
                <div className="flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
                <p className="text-center mt-4 text-gray-600">Loading...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <section className="bg-[#F4F7FF] pb-14 pt-[120px] dark:bg-dark sm:pt-[140px] md:pt-[160px] lg:pb-20 lg:pt-[180px]">
        <div className="container">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Password Updated!</CardTitle>
                <CardDescription>Your password has been successfully changed.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="border-green-400 bg-green-50 text-green-700">
                  <AlertDescription>Redirecting you to your dashboard...</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-[#F4F7FF] pb-14 pt-[120px] dark:bg-dark sm:pt-[140px] md:pt-[160px] lg:pb-20 lg:pt-[180px]">
      <div className="container">
        <div className="flex justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <ShieldAlert className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle>Change Your Password</CardTitle>
              <CardDescription>
                For security reasons, you must change your temporary password before continuing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 border-yellow-400 bg-yellow-50">
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-yellow-800">
                  Your account was created with a temporary password. Please set a new, secure password to protect your account.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleUpdatePassword}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">New Password</label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Enter new password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500">Must be at least 8 characters</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Confirm new password"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Updating Password...' : 'Set New Password'}
                  </Button>
                </div>
              </form>

              <p className="mt-4 text-center text-xs text-gray-500">
                This is a one-time requirement. After setting your new password, you can access the platform normally.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
