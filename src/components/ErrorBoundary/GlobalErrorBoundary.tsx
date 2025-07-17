// src/components/ErrorBoundary/GlobalErrorBoundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createErrorBoundaryLogger } from '@/lib/error-logging';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

/**
 * Enhanced global error boundary with comprehensive error handling and reporting
 */
class GlobalErrorBoundary extends Component<Props, State> {
  private errorLogger: (error: Error, errorInfo: any) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };

    // Initialize error logger
    this.errorLogger = createErrorBoundaryLogger(props.name || 'GlobalErrorBoundary');
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error with centralized error logging
    this.errorLogger(error, errorInfo);
    
    // Update state to include errorInfo
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Additional logging for debugging
    console.group('🚨 React Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // await sendErrorToTrackingService(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined
    });
  };

  handleReload = (): void => {
    // Reload the page to completely reset the app state
    window.location.reload();
  };

  handleGoHome = (): void => {
    // Navigate to home page
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default enhanced error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            {/* Error Icon and Title */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                An unexpected error occurred. Our team has been notified and is working on a fix.
              </p>
              
              {this.state.errorId && (
                <div className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  Error ID: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                    {this.state.errorId}
                  </code>
                </div>
              )}
            </div>

            {/* Error Details (Development/Debug Mode) */}
            {(this.props.showDetails || process.env.NODE_ENV === 'development') && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <details className="cursor-pointer">
                  <summary className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Bug className="h-4 w-4 mr-2" />
                    Error Details (Development Mode)
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Error Message
                      </h4>
                      <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {this.state.error.message}
                      </p>
                    </div>
                    
                    {this.state.error.stack && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Stack Trace
                        </h4>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Component Stack
                        </h4>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleRetry}
                variant="default"
                className="flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              
              <Button 
                onClick={this.handleReload}
                variant="outline"
                className="flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
              
              <Button 
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center justify-center"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>

            {/* Additional Help */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                <p className="mb-2">
                  If this problem persists, please contact our support team.
                </p>
                <div className="flex justify-center space-x-4 text-xs">
                  <button 
                    onClick={() => window.open('mailto:support@readysetcorp.com?subject=Error Report&body=Error ID: ' + this.state.errorId, '_blank')}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Email Support
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button 
                    onClick={() => window.open('/contact', '_blank')}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Contact Form
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary; 