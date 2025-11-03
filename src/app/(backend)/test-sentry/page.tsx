'use client';

/**
 * Sentry Test Page (Client-Side)
 *
 * This page provides a UI to test Sentry error tracking from the client side.
 * It allows testing various error scenarios and verifying that Sentry captures them.
 *
 * @route /test-sentry
 *
 * IMPORTANT: This page is disabled in production for security
 */

import { useState } from 'react';
import {
  captureException,
  captureMessage,
  setSentryUser,
  addSentryBreadcrumb,
} from '@/lib/monitoring/sentry';

export default function TestSentryPage() {
  const [result, setResult] = useState<string>('');

  // Production protection
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-700">This page is disabled in production.</p>
        </div>
      </div>
    );
  }

  // Test client-side error
  const testClientError = () => {
    try {
      throw new Error('Client-side test error - This is intentional');
    } catch (error) {
      captureException(error);
      setResult('Client error sent to Sentry ✓');
    }
  };

  // Test message capture
  const testMessage = () => {
    captureMessage('Test message from client', 'info', {
      page: 'test-sentry',
      timestamp: new Date().toISOString(),
    });
    setResult('Test message sent to Sentry ✓');
  };

  // Test warning
  const testWarning = () => {
    captureMessage('Test warning from client', 'warning', {
      page: 'test-sentry',
      severity: 'warning',
    });
    setResult('Test warning sent to Sentry ✓');
  };

  // Test user context
  const testUserContext = () => {
    setSentryUser({
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
    });
    setResult('User context set in Sentry ✓');
  };

  // Test breadcrumbs
  const testBreadcrumbs = () => {
    addSentryBreadcrumb('User clicked test button', {
      action: 'click',
      button: 'test-breadcrumbs',
    });
    addSentryBreadcrumb('Navigation event', { from: '/test', to: '/home' });
    addSentryBreadcrumb('API call started', { endpoint: '/api/test' }, 'info');

    // Now throw an error to see the breadcrumbs
    try {
      throw new Error('Test error with breadcrumbs');
    } catch (error) {
      captureException(error);
      setResult('Error with breadcrumbs sent to Sentry ✓');
    }
  };

  // Test unhandled error (let it propagate to error boundary)
  const testUnhandledError = () => {
    throw new Error(
      'Unhandled client error - This should be caught by error boundary'
    );
  };

  // Test API error
  const testApiError = async () => {
    try {
      const response = await fetch('/api/test-sentry?type=error');
      const data = await response.json();
      setResult(`API test: ${JSON.stringify(data)}`);
    } catch (error) {
      setResult(`API test failed: ${error}`);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            This page is disabled in production for security reasons.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sentry Error Tracking Test
          </h1>
          <p className="text-gray-600 mb-8">
            Use these buttons to test different Sentry error capture scenarios.
            Check your Sentry dashboard to verify the errors are being captured.
          </p>

          {result && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 font-medium">{result}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testClientError}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test Client Error
            </button>

            <button
              onClick={testMessage}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test Message
            </button>

            <button
              onClick={testWarning}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test Warning
            </button>

            <button
              onClick={testUserContext}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Set User Context
            </button>

            <button
              onClick={testBreadcrumbs}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test Breadcrumbs
            </button>

            <button
              onClick={testApiError}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test API Error
            </button>

            <button
              onClick={testUnhandledError}
              className="bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Test Unhandled Error
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">
              How to verify:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
              <li>Click any test button above</li>
              <li>Open your Sentry dashboard</li>
              <li>Navigate to Issues → All Issues</li>
              <li>You should see the test error appear within a few seconds</li>
              <li>Click on the issue to see full details and breadcrumbs</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="font-semibold text-yellow-900 mb-2">
              ⚠️ Important Notes:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
              <li>
                Make sure <code>NEXT_PUBLIC_SENTRY_DSN</code> is set in your
                .env.local
              </li>
              <li>This page is automatically disabled in production</li>
              <li>Check the browser console for additional debug info</li>
              <li>
                It may take a few seconds for errors to appear in Sentry
                dashboard
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
