// src/components/Auth/SignUp/RegistrationSuccessModal.tsx

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
import { CheckCircle2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

interface RegistrationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userType: string;
  emailSent?: boolean;
}

const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  userType,
  emailSent = true,
}) => {
  const router = useRouter();

  const handleGoToLogin = () => {
    onClose();
    router.push("/sign-in");
  };

  const userTypeLabel = userType.charAt(0).toUpperCase() + userType.slice(1);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Registration Successful!
          </DialogTitle>
          <DialogDescription className="text-center">
            Welcome to Ready Set Platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
              Account Details
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Name:{" "}
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {userName}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Email:{" "}
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {userEmail}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Account Type:{" "}
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {userTypeLabel}
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
                  We've sent a confirmation email to <strong>{userEmail}</strong>.
                  Please verify your email address to activate your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Email Notification Pending
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Your account has been created, but we couldn't send the confirmation email.
                  Please contact support if you need assistance.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
            <h5 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Next Steps:
            </h5>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300">
              <li>Check your email for the confirmation link</li>
              <li>Click the link to verify your email address</li>
              <li>Log in with your credentials</li>
              <li>Complete your profile setup</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={handleGoToLogin}
            className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5568d3] to-[#653a8b] sm:w-auto"
            size="lg"
          >
            Go to Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationSuccessModal;
