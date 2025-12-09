'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      const supabase = await createClient()
      
      // Use the resetPasswordForEmail function
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Make sure this redirectTo is set to your site's base URL + the confirm path
        redirectTo: `${window.location.origin}/auth/confirm?next=/account/update-password`,
      })
      
      if (error) {
        throw error
      }
      
      // Show success message
      setMessage('Check your email for a password reset link')
      setEmail('')
      
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.message || 'Failed to send password reset email')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <section className="bg-[#F4F7FF] py-14 dark:bg-dark lg:py-20">
      <div className="container">
        <div className="flex justify-center">
          <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>Enter your email to reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {message && (
            <Alert className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting || !!message}
                  placeholder="you@example.com"
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !!message}
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <div className="mt-4 text-center">
                <Link
                  href="/sign-in"
                  className="text-sm text-primary hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
        </div>
      </div>
    </section>
  )
}