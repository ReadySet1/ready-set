import { User } from "lucide-react";

interface ProfileHeaderProps {
  profile: any;
  isEditing: boolean;
  saving: boolean;
  onEditToggle: () => void;
}

export const ProfileHeader = ({
  profile,
  isEditing,
  saving,
  onEditToggle,
}: ProfileHeaderProps) => (
  <div className="mb-8">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <div className="mt-2 flex items-center gap-4">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            <User className="mr-1 h-4 w-4" />
            CLIENT
          </span>
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            PENDING
          </span>
        </div>
        <p className="mt-1 text-gray-600">
          <User className="mr-1 inline h-4 w-4" />
          {profile.name || "User Name"}
        </p>
      </div>
      <button
        onClick={onEditToggle}
        disabled={saving}
        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
      >
        <svg
          className="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Profile
      </button>
    </div>
  </div>
); 