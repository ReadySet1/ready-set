import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface ProfileErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ProfileErrorFallback = ({
  error,
  resetErrorBoundary,
}: ProfileErrorFallbackProps) => (
  <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <Shield className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="mb-2 text-center text-xl font-semibold text-slate-900">
        Profile Loading Error
      </h3>
      <p className="mb-6 text-center text-sm text-red-600">
        {error.message ||
          "An unexpected error occurred while loading your profile."}
      </p>
      <div className="flex justify-center space-x-4">
        <Button
          onClick={resetErrorBoundary}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          Try Again
        </Button>
        <Button
          onClick={() => window.location.href = "/"}
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Go Home
        </Button>
      </div>
    </motion.div>
  </div>
); 