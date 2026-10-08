'use client';

/**
 * In-app explanation shown inside the native driver wrapper when background
 * location can't start: why we need location, what to pick, and ONE button
 * that goes to the right place (OS dialog, app Settings, or a re-check). The
 * bridge (src/lib/tracking/capacitor-tracking.ts) publishes the issue; this
 * component only renders it. Never shows in a plain browser — the issue store
 * is only ever written inside the Capacitor shell.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getNativeLocationIssue,
  getNativeLocationIssueCopy,
  subscribeNativeLocationIssue,
} from '@/lib/tracking/native-location-issue';
import {
  resolveNativeLocationIssue,
  retryNativeShiftTracking,
} from '@/lib/tracking/native-shift-tracking';

const getServerIssue = () => null;

export function NativeLocationPrompt() {
  const issue = useSyncExternalStore(
    subscribeNativeLocationIssue,
    getNativeLocationIssue,
    getServerIssue,
  );

  // Coming back from Settings (or the Location quick toggle) resumes the
  // WebView: re-check then, so the prompt clears without another tap. The
  // re-check never opens an OS dialog by itself.
  useEffect(() => {
    if (!issue) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void retryNativeShiftTracking();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [issue]);

  if (!issue) return null;
  const copy = getNativeLocationIssueCopy(issue);

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* A plain button, not AlertDialogAction: the dialog closes only when
              the bridge clears the issue, not on tap. */}
          <Button onClick={() => void resolveNativeLocationIssue()}>
            {copy.actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
