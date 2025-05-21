import React from "react";
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
  className?: string;
  customButton?: React.ReactNode;
}

const ScheduleDialog: React.FC<AppointmentDialogProps> = ({
  buttonText = "Schedule a Call",
  dialogTitle = "Schedule an Appointment",
  dialogDescription = "Choose a convenient time for your appointment.",
  calendarUrl,
  customButton,
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {customButton || (
          <button className="rounded-lg border border-gray-200 bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50">
            {buttonText}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="mb-8 mt-16 border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:max-w-[90%] md:max-w-[75%] lg:max-w-[90%]">
        <DialogHeader className="bg-white dark:bg-gray-900">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="h-[70vh] min-h-[400px] w-full bg-white dark:bg-gray-900">
          <iframe
            src={calendarUrl}
            width="100%"
            height="100%"
            className="border-0 bg-white dark:bg-gray-900"
          ></iframe>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
