// src/components/Profile/PasswordChangeSuccessModal.tsx

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield } from "lucide-react";

interface PasswordChangeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  autoDismissSeconds?: number;
}

const PasswordChangeSuccessModal: React.FC<PasswordChangeSuccessModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  autoDismissSeconds = 0,
}) => {
  const [countdown, setCountdown] = useState(autoDismissSeconds);

  useEffect(() => {
    if (!isOpen || autoDismissSeconds <= 0) {
      setCountdown(autoDismissSeconds);
      return;
    }

    setCountdown(autoDismissSeconds);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, autoDismissSeconds, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Password Changed Successfully
          </DialogTitle>
          <DialogDescription className="text-center">
            Your password has been updated
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
              Account Details
            </h4>
            <div className="text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">
                Email:{" "}
              </span>
              <span className="text-slate-900 dark:text-slate-100">
                {userEmail}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                Security Tip
              </p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                For added security, you may want to sign out of other devices
                where you're currently logged in.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={onClose}
            className="w-full bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:w-auto"
            size="lg"
          >
            Done
            {countdown > 0 && ` (${countdown})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordChangeSuccessModal;
