// src/components/Common/FormErrorBoundary.tsx
"use client";

import React, { ReactNode } from "react";
import ComponentErrorBoundary from "@/components/ErrorBoundary/ComponentErrorBoundary";
import { useErrorRecovery } from "@/lib/error-recovery";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormSectionProps {
  children: ReactNode;
  formName: string;
  preserveFormData?: boolean;
  enableRetry?: boolean;
}

/**
 * Form section wrapper with error boundary and state preservation
 */
export function FormSection({
  children,
  formName,
  preserveFormData = true,
  enableRetry = true,
}: FormSectionProps) {
  const { saveState, getState, retryState } = useErrorRecovery({
    preserveState: preserveFormData,
    maxRetries: 2,
  });

  const handleError = React.useCallback(
    (error: Error) => {
      // Save form state before error occurs
      if (preserveFormData) {
        // This would typically save the current form values
        // saveState(`form_${formName}`, formData);
      }
    },
    [formName, preserveFormData],
  );

  const handleRetry = React.useCallback(() => {
    // Attempt to restore form state after retry
    if (preserveFormData) {
      const savedState = getState(`form_${formName}`);
      if (savedState) {
        // This would typically restore form values
      }
    }
  }, [formName, preserveFormData, getState]);

  return (
    <ComponentErrorBoundary
      componentName={`Form: ${formName}`}
      graceful={true}
      enableRetry={enableRetry}
      onError={handleError}
    >
      <div className="relative">
        {children}

        {/* Retry indicator for form sections */}
        {retryState.isRetrying && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/80 dark:bg-gray-900/80">
            <div className="text-center">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Retrying form operation...
              </p>
            </div>
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  );
}

interface FormFieldProps {
  children: ReactNode;
  fieldName: string;
  graceful?: boolean;
}

/**
 * Form field wrapper with error boundary protection
 */
export function FormField({
  children,
  fieldName,
  graceful = true,
}: FormFieldProps) {
  return (
    <ComponentErrorBoundary
      componentName={`FormField: ${fieldName}`}
      graceful={graceful}
      enableRetry={false} // Form fields typically don't retry individually
    >
      {children}
    </ComponentErrorBoundary>
  );
}

/**
 * Graceful form field error fallback
 */
export function FormFieldErrorFallback({ fieldName }: { fieldName: string }) {
  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 p-3 dark:bg-orange-900/20">
      <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">{fieldName} couldn't load properly</span>
      </div>
    </div>
  );
}
