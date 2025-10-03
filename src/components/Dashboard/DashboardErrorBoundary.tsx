// src/components/Dashboard/DashboardErrorBoundary.tsx
"use client";

import React, { ReactNode } from "react";
import SectionErrorBoundary from "@/components/ErrorBoundary/SectionErrorBoundary";
import ComponentErrorBoundary from "@/components/ErrorBoundary/ComponentErrorBoundary";

interface DashboardSectionProps {
  children: ReactNode;
  sectionName: string;
  enableRetry?: boolean;
  showDetails?: boolean;
}

/**
 * Dashboard section wrapper with error boundary protection
 */
export function DashboardSection({
  children,
  sectionName,
  enableRetry = true,
  showDetails = false,
}: DashboardSectionProps) {
  return (
    <SectionErrorBoundary
      sectionName={sectionName}
      enableRetry={enableRetry}
      showDetails={showDetails}
    >
      {children}
    </SectionErrorBoundary>
  );
}

interface DashboardComponentProps {
  children: ReactNode;
  componentName: string;
  graceful?: boolean;
  enableRetry?: boolean;
}

/**
 * Dashboard component wrapper with error boundary protection
 */
export function DashboardComponent({
  children,
  componentName,
  graceful = false,
  enableRetry = true,
}: DashboardComponentProps) {
  return (
    <ComponentErrorBoundary
      componentName={componentName}
      graceful={graceful}
      enableRetry={enableRetry}
    >
      {children}
    </ComponentErrorBoundary>
  );
}
