'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUserContext, userHelpers } from '@/providers/UserProvider'
import { createClient } from '@/utils/supabase/client'

interface TestResult {
  test: string
  status: 'PASS' | 'FAIL' | 'PENDING'
  message: string
  details?: any
}

/**
 * Test component to verify user synchronization
 * Add this to any page to test the auth system
 */
export function UserSyncTest() {
  const user = useUserContext()
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (test: string, status: 'PASS' | 'FAIL' | 'PENDING', message: string, details?: any) => {
    setResults(prev => [...prev, { test, status, message, details }])
  }

  const runTests = async () => {
    setIsRunning(true)
    setResults([])

    try {
      // Test 1: Environment Configuration
      addResult('Environment Check', 'PENDING', 'Checking environment configuration...')
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const isLocalSupabase = supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1')
      
      if (isLocalSupabase) {
        addResult('Environment Check', 'PASS', 'Supabase configured for local development', { supabaseUrl })
      } else {
        addResult('Environment Check', 'FAIL', 'Supabase appears to be pointing to remote instance', { supabaseUrl })
      }

      // Test 2: Supabase Connection
      addResult('Supabase Connection', 'PENDING', 'Testing Supabase connection...')
      
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          addResult('Supabase Connection', 'FAIL', 'Failed to connect to Supabase', error.message)
        } else {
          addResult('Supabase Connection', 'PASS', 'Successfully connected to Supabase')
        }
      } catch (error) {
        addResult('Supabase Connection', 'FAIL', 'Supabase connection error', error instanceof Error ? error.message : String(error))
      }

      // Test 3: User Context State
      addResult('User Context', 'PENDING', 'Checking user context state...')
      
             if (user.isLoading) {
         addResult('User Context', 'PENDING', 'User context is loading...')
       } else if (userHelpers.isAuthenticated(user)) {
         addResult('User Context', 'PASS', 'User is authenticated', {
           supabaseId: user.supabaseUser?.id,
           email: user.supabaseUser?.email,
           profileId: user.profile?.id,
           profileName: user.profile?.name
         })
       } else if (!user.supabaseUser) {
         addResult('User Context', 'PASS', 'User context is null (not authenticated)')
       } else {
         addResult('User Context', 'FAIL', 'User context in unexpected state', user)
       }

      // Test 4: Database Connection Test
      addResult('Database Sync', 'PENDING', 'Testing database synchronization...')
      
      try {
        const response = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            addResult('Database Sync', 'PASS', 'Database sync endpoint is working', data)
          } else {
            addResult('Database Sync', 'FAIL', 'Database sync failed', data)
          }
        } else {
          addResult('Database Sync', 'FAIL', `Database sync endpoint returned ${response.status}`)
        }
      } catch (error) {
        addResult('Database Sync', 'FAIL', 'Database sync request failed', error instanceof Error ? error.message : String(error))
      }

      // Test 5: Local Database Verification
      addResult('Local Database', 'PENDING', 'Verifying local database connection...')
      
      try {
        const response = await fetch('/api/test/database-info')
        
        if (response.ok) {
          const data = await response.json()
          if (data.database === 'ready_set_dev') {
            addResult('Local Database', 'PASS', 'Connected to local development database', data)
          } else {
            addResult('Local Database', 'FAIL', `Connected to unexpected database: ${data.database}`, data)
          }
        } else {
          addResult('Local Database', 'FAIL', 'Failed to get database info')
        }
      } catch (error) {
        addResult('Local Database', 'FAIL', 'Database info request failed', error instanceof Error ? error.message : String(error))
      }

    } catch (error) {
      addResult('Test Runner', 'FAIL', 'Test execution failed', error instanceof Error ? error.message : String(error))
    }

    setIsRunning(false)
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'PASS': return 'bg-green-500'
      case 'FAIL': return 'bg-red-500'
      case 'PENDING': return 'bg-yellow-500'
    }
  }

  const getStatusEmoji = (status: TestResult['status']) => {
    switch (status) {
      case 'PASS': return '✅'
      case 'FAIL': return '❌'
      case 'PENDING': return '⏳'
    }
  }

  const passedTests = results.filter(r => r.status === 'PASS').length
  const failedTests = results.filter(r => r.status === 'FAIL').length
  const totalTests = results.length

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🧪 User Sync & Local Development Test</span>
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            variant={isRunning ? "secondary" : "default"}
          >
            {isRunning ? "Running Tests..." : "Run Tests"}
          </Button>
        </CardTitle>
        {results.length > 0 && (
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">Total: {totalTests}</Badge>
            <Badge className="bg-green-500">Passed: {passedTests}</Badge>
            <Badge className="bg-red-500">Failed: {failedTests}</Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
                 {/* Current User State */}
         <div className="mb-6 p-4 bg-gray-50 rounded-lg">
           <h3 className="font-semibold mb-2">Current User State:</h3>
           {user.isLoading ? (
             <p className="text-yellow-600">Loading user...</p>
           ) : userHelpers.isAuthenticated(user) ? (
             <div className="space-y-1 text-sm">
               <p><strong>Supabase ID:</strong> {user.supabaseUser?.id}</p>
               <p><strong>Email:</strong> {user.supabaseUser?.email}</p>
               <p><strong>Profile ID:</strong> {user.profile?.id || 'Not synced'}</p>
               <p><strong>Profile Name:</strong> {user.profile?.name || 'Not set'}</p>
               <p><strong>User Type:</strong> {user.profile?.type || 'Not set'}</p>
             </div>
           ) : !user.supabaseUser ? (
             <p className="text-gray-600">No user (not authenticated)</p>
           ) : (
             <p className="text-red-600">User in unexpected state</p>
           )}
         </div>

        {/* Test Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Test Results:</h3>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{getStatusEmoji(result.status)}</span>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                  <span className="font-semibold">{result.test}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                {result.details && (
                  <details className="text-xs bg-gray-100 p-2 rounded">
                    <summary className="cursor-pointer font-medium">Details</summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        {results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">Click "Run Tests" to verify your local development setup.</p>
            <p className="text-sm">This will test:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li>• Environment configuration</li>
              <li>• Supabase connection</li>
              <li>• User context state</li>
              <li>• Database synchronization</li>
              <li>• Local database connection</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}