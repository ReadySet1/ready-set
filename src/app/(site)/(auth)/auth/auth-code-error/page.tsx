'use client';

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import React from "react";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get('error');
  const errorCode = searchParams.get('errorCode');
  const errorType = searchParams.get('errorType');

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Authentication Error</CardTitle>
        <CardDescription>
          There was a problem with your authentication request.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertTitle>Error {errorCode && `(${errorCode})`}</AlertTitle>
            <AlertDescription>
              {errorMessage}
              {errorType && (
                <div className="mt-2 text-xs text-gray-500">
                  Error type: {errorType}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <p className="mb-4">
          This could be due to:
        </p>
        <ul className="list-disc pl-5 mb-4 space-y-1">
          <li>An expired authentication link</li>
          <li>Invalid OAuth configuration</li>
          <li>Missing or incorrect permissions</li>
          <li>Server connectivity issues</li>
        </ul>
        
        <p>Please try signing in again or contact support if the problem persists.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button asChild variant="outline">
          <Link href="/">Go Home</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-in">Try Again</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <React.Suspense fallback={<div>Loading error details...</div>}>
        <AuthCodeErrorContent />
      </React.Suspense>
    </div>
  );
}