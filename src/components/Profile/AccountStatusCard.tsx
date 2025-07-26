import { User, Clock } from "lucide-react";

interface AccountStatusCardProps {
  profile: any;
}

export const AccountStatusCard = ({ profile }: AccountStatusCardProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center">
      <User className="mr-2 h-5 w-5 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-900">Account Status</h2>
    </div>

    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Account Type
        </label>
        <div className="flex items-center py-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            <User className="mr-1 h-4 w-4" />
            CLIENT
          </span>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Status
        </label>
        <div className="flex items-center py-2">
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            <Clock className="mr-1 h-4 w-4" />
            PENDING
          </span>
        </div>
      </div>
    </div>
  </div>
); 