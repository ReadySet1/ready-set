// src/components/CateringRequest/OrderConfirmationModal.tsx

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  emailSent?: boolean;
  orderViewUrl?: string;
}

const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  customerName,
  customerEmail,
  orderId,
  emailSent = true,
  orderViewUrl,
}) => {
  const router = useRouter();

  const handleViewOrder = () => {
    onClose();
    if (orderViewUrl) {
      router.push(orderViewUrl);
    } else {
      router.push(`/order-status/${orderNumber}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Order Confirmed!
          </DialogTitle>
          <DialogDescription className="text-center">
            Your catering order has been successfully created
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
              Order Details
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Order Number:{" "}
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {orderNumber}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Customer:{" "}
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {customerName}
                </span>
              </div>
            </div>
          </div>

          {emailSent ? (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Check Your Email
                </p>
                <p className="mt-1 text-blue-700 dark:text-blue-300">
                  We've sent a confirmation email to{" "}
                  <strong>{customerEmail}</strong> with your order details and
                  delivery information.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Email Notification Pending
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Your order has been created successfully, but we couldn't send
                  the confirmation email. You can view your order details in your
                  dashboard.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
            <h5 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Next Steps:
            </h5>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {emailSent && <li>Check your email for order confirmation</li>}
              <li>Review order details in your dashboard</li>
              <li>Our team will process your order shortly</li>
              <li>You'll receive updates on your order status</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={handleViewOrder}
            className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5568d3] hover:to-[#653a8b] sm:w-auto"
            size="lg"
          >
            View Order Details
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto"
            size="lg"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderConfirmationModal;
