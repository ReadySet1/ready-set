'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getCockpitCTALabel,
  getNextStatus,
  isDeliveryCompleted,
  getStatusLabel,
} from '@/lib/delivery-status-transitions';

interface StatusButtonProps {
  currentStatus: string | null | undefined;
  orderNumber: string;
  onConfirm: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Full-width pill CTA button for advancing delivery status.
 * Opens an AlertDialog confirmation before firing the update.
 */
export function StatusButton({
  currentStatus,
  orderNumber,
  onConfirm,
  isLoading = false,
  disabled = false,
}: StatusButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isDeliveryCompleted(currentStatus)) return null;

  const label = getCockpitCTALabel(currentStatus);
  const nextStatus = getNextStatus(currentStatus);
  const nextLabel = nextStatus ? getStatusLabel(nextStatus) : '';

  return (
    <>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setDialogOpen(true)}
        className="w-full h-14 rounded-full bg-[#FBD113] text-gray-900 font-bold text-base
                   active:scale-[0.97] transition-transform
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Updating...
          </>
        ) : (
          label
        )}
      </button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Status</AlertDialogTitle>
            <AlertDialogDescription>
              Update order #{orderNumber} to &ldquo;{nextLabel}&rdquo;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDialogOpen(false);
                onConfirm();
              }}
              className="bg-[#FBD113] text-gray-900 hover:bg-[#e6c011]"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
