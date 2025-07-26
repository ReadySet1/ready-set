import { Calendar } from "lucide-react";

export const AccountTimelineCard = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center">
      <Calendar className="mr-2 h-5 w-5 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-900">Account Timeline</h2>
    </div>

    <div className="space-y-4">
      <div className="flex items-start space-x-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
          <Calendar className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            Account created and pending approval.
          </p>
          <p className="text-xs text-gray-500">Account setup in progress</p>
        </div>
      </div>
    </div>
  </div>
);
