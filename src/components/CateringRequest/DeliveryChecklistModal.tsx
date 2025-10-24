'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

interface DeliveryChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHECKLIST_ITEMS = [
  'Verify pickup location and delivery address details',
  'Confirm headcount and order total accuracy',
  'Double-check order number from brokerage service',
  'Verify pickup and delivery time windows',
  'Check if a host is needed and for how long',
  'Note any special delivery or setup instructions',
  'Confirm payment details are accurate',
  'Include any necessary dietary restrictions or allergen information',
];

export function DeliveryChecklistModal({
  isOpen,
  onClose,
}: DeliveryChecklistModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-800">
            8-Point Delivery Checklist
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Follow these guidelines to ensure flawless delivery and setup for your
            catering order.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {CHECKLIST_ITEMS.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-gray-100"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
                {index + 1}
              </div>
              <p className="flex-1 pt-1 text-gray-700">{item}</p>
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500 opacity-0 transition-opacity hover:opacity-100" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Pro Tip:</strong> Review this checklist before submitting your
            catering request to ensure all details are accurate and complete.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
