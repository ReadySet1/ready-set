import { FileText, Clock } from "lucide-react";
import Link from "next/link";

export const QuickActionsCard = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center">
      <FileText className="mr-2 h-5 w-5 text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
    </div>

    <div className="space-y-3">
      <Link
        href="/dashboard"
        className="flex items-center rounded-lg border border-gray-200 p-3 text-gray-700 transition-colors hover:bg-gray-50"
      >
        <FileText className="mr-3 h-5 w-5 text-blue-600" />
        <span>View Dashboard</span>
      </Link>
      <Link
        href="/orders"
        className="flex items-center rounded-lg border border-gray-200 p-3 text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Clock className="mr-3 h-5 w-5 text-blue-600" />
        <span>My Orders</span>
      </Link>
    </div>
  </div>
);
