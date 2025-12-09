'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'

// Define home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
  admin: '/admin',
  super_admin: '/admin',
  driver: '/driver',
  helpdesk: '/helpdesk',
  vendor: '/client',
  client: '/client'
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  // Verify user has a valid recovery session and get their role
  useEffect(() => {
    const checkSession = async () => {
      const supabase = await createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // User should have a session after clicking the email link
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.')
        setIsSessionValid(false)
      } else {
        setIsSessionValid(true)

        // Fetch user's role from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profile?.type) {
          setUserRole(profile.type.toLowerCase())
        }
      }
    }

    checkSession()
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

      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)

      // Show toast notification
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated.',
      })

      // Redirect to appropriate dashboard based on user role
      setTimeout(() => {
        const redirectPath = userRole ? (USER_HOME_ROUTES[userRole] || '/') : '/'
        router.push(redirectPath)
      }, 2000)

    } catch (err: unknown) {
      Sentry.captureException(err, {
        tags: { feature: 'password-reset' },
        extra: { action: 'update-password' }
      })
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state while checking session
  if (isSessionValid === null) {
    return (
      <section className="bg-[#F4F7FF] pb-14 pt-[120px] dark:bg-dark sm:pt-[140px] md:pt-[160px] lg:pb-20 lg:pt-[180px]">
        <div className="container">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="py-8">
                <div className="flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
                <p className="text-center mt-4 text-gray-600">Verifying your session...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    )
  }

  // Invalid session state
  if (isSessionValid === false) {
    return (
      <section className="bg-[#F4F7FF] pb-14 pt-[120px] dark:bg-dark sm:pt-[140px] md:pt-[160px] lg:pb-20 lg:pt-[180px]">
        <div className="container">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Session Expired</CardTitle>
                <CardDescription>Your password reset link has expired or is invalid.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button asChild className="w-full">
                  <Link href="/forgot-password">Request New Reset Link</Link>
                </Button>
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
              <CardHeader>
                <CardTitle>Password Updated!</CardTitle>
                <CardDescription>Your password has been successfully changed.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 border-green-400 bg-green-50 text-green-700">
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
            <CardHeader>
              <CardTitle>Set New Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent>
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
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
