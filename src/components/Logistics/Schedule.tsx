import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AppointmentDialogProps {
  buttonText?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  calendarUrl: string;
  customButton?: React.ReactNode;
  className?: string;
}

const ScheduleDialog: React.FC<AppointmentDialogProps> = ({
  buttonText = "Schedule a Call",
  dialogTitle = "Schedule an Appointment",
  dialogDescription = "Choose a convenient time for your appointment.",
  calendarUrl,
  customButton,
  className,
}) => {
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {customButton || (
          <button
            className={
              className ||
              "rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50"
            }
          >
            {buttonText}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="mb-8 mt-16 border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:max-w-[90%] md:max-w-[75%] lg:max-w-[90%]">
        <DialogHeader className="bg-white dark:bg-gray-900">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="relative h-[70vh] min-h-[400px] w-full bg-white dark:bg-gray-900">
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-yellow-400" />
            </div>
          )}
          {iframeError ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <svg
                className="mb-4 h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="mb-4 text-gray-700 dark:text-gray-300">
                Unable to load the scheduling calendar.
              </p>
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-yellow-400 px-6 py-3 font-medium text-gray-800 transition-colors hover:bg-yellow-500"
              >
                Open Calendar in New Tab
              </a>
            </div>
          ) : (
            <iframe
              src={calendarUrl}
              width="100%"
              height="100%"
              className="border-0 bg-white dark:bg-gray-900"
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
